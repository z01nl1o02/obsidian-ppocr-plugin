
import requests
import json
import os
from typing import List, Dict, Any, Optional

class PaddleOCRClient:
    """
    PP-OCR Flask 服务的 Python 客户端
    """

    def __init__(self, base_url: str = "http://localhost:5000", timeout: int = 30):
        """
        初始化客户端
        :param base_url: OCR 服务的基础 URL
        :param timeout: 请求超时时间（秒）
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = requests.Session()

    def recognize_from_file(self, image_path: str) -> List[Dict[str, Any]]:
        """
        从本地图片文件进行识别
        :param image_path: 图片的本地路径
        :return: 识别结果列表
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")

        with open(image_path, 'rb') as f:
            files = {'image': (os.path.basename(image_path), f, 'image/jpeg')}
            return self._send_request(files)

    def recognize_from_bytes(self, image_data: bytes, filename: str = "image.jpg") -> List[Dict[str, Any]]:
        """
        从二进制数据进行识别
        :param image_data: 图片的二进制数据
        :param filename: 文件名（用于确定格式）
        :return: 识别结果列表
        """
        files = {'image': (filename, image_data, 'image/jpeg')}
        return self._send_request(files)

    def _send_request(self, files: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        发送 POST 请求到 OCR 服务
        :param files: 包含图片文件的字典
        :return: 解析后的识别结果
        """
        url = f"{self.base_url}/ocr"
        
        try:
            response = self.session.post(url, files=files, timeout=self.timeout)
            response.raise_for_status()  # 如果状态码不是 200，抛出异常
            
            result = response.json()
            
            if not result.get('success'):
                raise Exception(f"OCR Service Error: {result.get('error', 'Unknown error')}")
                
            return result.get('data', [])
            
        except requests.exceptions.ConnectionError:
            raise ConnectionError(f"Could not connect to OCR service at {url}. Is the server running?")
        except requests.exceptions.Timeout:
            raise TimeoutError(f"Request to OCR service timed out after {self.timeout} seconds.")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request failed: {str(e)}")

def main():
    """
    主函数：演示如何使用客户端
    """
    # 初始化客户端
    client = PaddleOCRClient(base_url="http://localhost:5000")
    
    # 示例：识别本地图片
    # 请替换为实际存在的图片路径
    test_image_path = "Q2.jpg"
    
    if os.path.exists(test_image_path):
        try:
            print(f"Starting OCR for: {test_image_path}")
            results = client.recognize_from_file(test_image_path)
            
            print("\n--- Recognition Results ---")
            if not results:
                print("No text detected.")
            else:
                for i, item in enumerate(results):
                    text = item.get('text', '')
                    confidence = item.get('confidence', 0)
                    print(f"[{i+1}] Text: {text}")
                    print(f"    Confidence: {confidence:.4f}")
                    print("-" * 20)
                    
        except Exception as e:
            print(f"Error during recognition: {e}")
    else:
        print(f"Test image '{test_image_path}' not found. Please provide a valid image path.")

if __name__ == "__main__":
    main()

