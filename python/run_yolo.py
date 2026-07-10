"""
Train YOLOv8n on the Wildfire (smoke) dataset — portable across machines.

Run from the python/ folder:
    python run_yolo.py

Best weights land in:  runs/detect/wildfire_amd/weights/best.pt
"""
from pathlib import Path

import torch
from ultralytics import YOLO

HERE = Path(__file__).resolve().parent          # .../python
DATASET = HERE / "cv" / "Wildfire-1"

# Ultralytics resolves a *relative* `path:` against its own datasets dir, not the yaml
# file location — so we emit a machine-correct ABSOLUTE path at runtime. Written to a
# gitignored file (data.local.yaml) so the tracked data.yaml template stays clean and no
# machine-specific path ever gets committed.
DATA_YAML = HERE / "data.local.yaml"
DATA_YAML.write_text(
    f"path: {DATASET.as_posix()}\n"
    "train: train\n"
    "val: valid\n"
    "test: test\n"
    "nc: 1\n"
    "names: ['smoke']\n"
)

# device 0 = the AMD Instinct GPU (ROCm rides torch's CUDA API); CPU fallback otherwise.
device = 0 if torch.cuda.is_available() else "cpu"
print(
    f"🚀 Training on device={device} "
    f"({'AMD GPU via ROCm' if device == 0 else 'CPU (fallback — slow)'})"
)

model = YOLO("yolov8n.pt")                       # base weights auto-download on first run

model.train(
    data=str(DATA_YAML),
    epochs=50,
    imgsz=640,
    workers=2,
    device=device,
    name="wildfire_amd",
)

print(f"✅ Training finished — best weights: {model.trainer.save_dir}/weights/best.pt")
