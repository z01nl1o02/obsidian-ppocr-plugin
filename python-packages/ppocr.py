from paddleocr import PaddleOCR
import fire

def main(image_path):
    ocr = PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        engine="paddle",
    )
    result = ocr.predict(image_path)
    for res in result:
        #res.print()
        #res.save_to_img("output")
        #res.save_to_json("output")
        print('\n'.join(res['rec_texts']))

if __name__=="__main__":
    fire.Fire(main)
