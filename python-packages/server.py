import io
import logging
import time

import numpy as np
from flask import Flask, jsonify, request
from paddleocr import PaddleOCR
from PIL import Image, UnidentifiedImageError
from threading import Lock

app = Flask(__name__)

# 显式配置日志级别，保证识别耗时日志可见
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# 限制请求体大小（16MB），超限返回 413
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    engine="paddle",
)

# PaddleOCR predict 非线程安全，串行化推理；Flask 本身仍可多线程接收请求
_predict_lock = Lock()


def _error(message: str, status: int):
    """统一的错误响应契约：success 标志 + error 信息"""
    return jsonify({"success": False, "error": message}), status


def _validate_image(img_bytes: bytes):
    """前置校验图片有效性，无效时返回 (None, 错误响应)；有效时返回 (numpy 数组, None)"""
    if not img_bytes:
        return None, _error("Empty image payload", 400)
    try:
        pil_image = Image.open(io.BytesIO(img_bytes))
        pil_image.load()  # 强制解码，尽早暴露截断/损坏的图片
    except (UnidentifiedImageError, OSError):
        return None, _error("Invalid or corrupted image data", 400)
    width, height = pil_image.size
    if width < 1 or height < 1:
        return None, _error("Image has invalid dimensions", 400)
    return np.array(pil_image.convert('RGB')), None


@app.errorhandler(413)
def too_large(_e):
    return _error("Request entity too large (max 16MB)", 413)


@app.route('/ocr', methods=['POST'])
def ocr_recognize():
    if 'image' not in request.files:
        return _error("No image provided", 400)

    img_bytes = request.files['image'].read()

    # 前置校验：格式/尺寸无效直接返回 400，而不是让 predict 静默忽略
    image, err = _validate_image(img_bytes)
    if err is not None:
        return err

    # 执行识别（串行化 + 耗时日志）
    start = time.perf_counter()
    with _predict_lock:
        result = ocr.predict(image)
    elapsed = time.perf_counter() - start

    # 解析结果
    data = []
    for line in result:
        for text, score in zip(line['rec_texts'], line['rec_scores']):
            data.append({"text": text, "confidence": float(score)})

    app.logger.info(
        "OCR done: %d bytes, %.2fs, %d lines", len(img_bytes), elapsed, len(data)
    )
    return jsonify({"success": True, "data": data})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
