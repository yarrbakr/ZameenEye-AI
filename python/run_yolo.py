from ultralytics import YOLO

# Load the base model weights
model = YOLO(r"C:\Users\Kainat\ZameenEye-AI\python\cv\yolov8n.pt")

print("🚀 Starting training loop on the Wildfire dataset...")

# Train using the yaml file we just created
results = model.train(
    data=r"C:\Users\Kainat\ZameenEye-AI\python\data.yaml",
    epochs=50,
    imgsz=640,
    workers=2
)

print("✅ Custom training finished! Your 'best.pt' file has been generated.")