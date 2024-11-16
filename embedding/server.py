from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from keras_facenet import FaceNet
import numpy as np
import cv2 as cv
from io import BytesIO
import uvicorn
import os

app = FastAPI()
embedder = FaceNet()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"], 
)

@app.post("/process-image/")
async def process_image(
    file: UploadFile = File(...),
    dim: int = Form(...)
):
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

            full_embedding = embedder.embeddings(face_img_resized)[0]
            normalized_embedding = ((full_embedding + 1) / 2) * 255
            embedding_length = len(normalized_embedding)

            indices = [
                int(round(i * (embedding_length - 1) / (dim - 1))) if dim > 1 else 0
                for i in range(dim)
            ]

            reduced_embedding = [normalized_embedding[idx] for idx in indices]
            formatted_embedding = [int(round(val)) for val in reduced_embedding]
            embeddings.append(formatted_embedding)
        
        return JSONResponse(content={
            "num_faces": num_faces,
            "embeddings": embeddings
        })
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
