from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from keras_facenet import FaceNet
import numpy as np
import cv2 as cv
from io import BytesIO
import uvicorn
import os

app = FastAPI()
embedder = FaceNet()

@app.post("/process-image/")
async def process_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv.imdecode(nparr, cv.IMREAD_COLOR)

        image_rgb = cv.cvtColor(image, cv.COLOR_BGR2RGB)
        detections = embedder.extract(image, threshold=0.95)

        num_faces = len(detections)
        embeddings = []
        if not os.path.exists("./detected_faces"):
            os.makedirs("./detected_faces")
        os.system("rm -r ./detected_faces/*")
        
        for i, detection in enumerate(detections):
            x, y, w, h = detection['box']
            x, y = abs(x), abs(y)
            
            face_img = image_rgb[y:y + h, x:x + w]
            face_img_resized = cv.resize(face_img, (160, 160))        
            face_img_resized = face_img_resized.astype('float32')
            face_img_resized = np.expand_dims(face_img_resized, axis=0)

            face_save_path = os.path.join("./detected_faces", f"face_{i + 1}.jpg")
            face_img_resized2 = cv.cvtColor(face_img_resized[0], cv.COLOR_RGB2BGR)
            cv.imwrite(face_save_path, face_img_resized2)
            print(f"Saved face {i + 1} at {face_save_path}")

            embedding = embedder.embeddings(face_img_resized)[0]
            formatted_embedding = [round(float(val), 4) for val in embedding]
            embeddings.append(formatted_embedding)
        
        return JSONResponse(content={
            "num_faces": num_faces,
            "embeddings": embeddings
        })
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
