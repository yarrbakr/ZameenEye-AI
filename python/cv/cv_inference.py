"""
ZameenEye AI — Computer Vision Hazard Detection
Runs YOLOv8 inference on satellite/aerial imagery to detect hazard indicators
(fire/smoke signatures). Designed to run locally first for logic verification,
then on AMD GPU for the hackathon's hardware validation requirement.

Usage:
    python cv_inference.py --image sample_images/fire_01.jpg
    python cv_inference.py --dir sample_images/  (batch mode)
"""

import argparse
import json
import time
from pathlib import Path
from datetime import datetime, timezone

from ultralytics import YOLO


def load_model(weights: str = "yolov8n.pt"):
    """
    Loads the YOLO model. Starts with the generic pretrained COCO model
    (yolov8n.pt, auto-downloads on first run) for a working baseline.

    Swap 'weights' to a wildfire/smoke-specific fine-tuned model if you find
    one on Roboflow Universe or Hugging Face for stronger domain relevance.
    """
    print(f"Loading model: {weights}")
    model = YOLO(weights)
    return model


def run_inference(model, image_path: str, confidence_threshold: float = 0.25):
    """
    Runs detection on a single image. Returns structured results matching
    the confidence-tier pattern already used in the backend (raw_payload style).
    """
    start = time.time()
    results = model(image_path, conf=confidence_threshold)
    elapsed = time.time() - start

    result = results[0]
    detections = []

    for box in result.boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf = float(box.conf[0])
        xyxy = box.xyxy[0].tolist()  # bounding box coordinates

        detections.append({
            "class": cls_name,
            "confidence": round(conf * 100, 2),  # matches your 0-100 confidence scale
            "bounding_box": {
                "x1": round(xyxy[0], 1),
                "y1": round(xyxy[1], 1),
                "x2": round(xyxy[2], 1),
                "y2": round(xyxy[3], 1),
            },
        })

    output = {
        "image": str(image_path),
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "inference_time_seconds": round(elapsed, 3),
        "detection_count": len(detections),
        "detections": detections,
    }

    # Save annotated image (visual proof for the demo video)
    annotated_path = Path(image_path).parent / f"annotated_{Path(image_path).name}"
    result.save(filename=str(annotated_path))
    output["annotated_image"] = str(annotated_path)

    return output


def run_batch(model, image_dir: str, confidence_threshold: float = 0.25):
    """Runs inference across every image in a directory, prints a summary."""
    image_dir = Path(image_dir)
    image_files = list(image_dir.glob("*.jpg")) + list(image_dir.glob("*.png"))

    if not image_files:
        print(f"No images found in {image_dir}")
        return []

    all_results = []
    for img in image_files:
        print(f"\nProcessing: {img.name}")
        result = run_inference(model, str(img), confidence_threshold)
        print(json.dumps(result, indent=2))
        all_results.append(result)

    return all_results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ZameenEye CV hazard detection")
    parser.add_argument("--image", type=str, help="Path to a single image")
    parser.add_argument("--dir", type=str, help="Path to a directory of images (batch mode)")
    parser.add_argument("--weights", type=str, default="yolov8n.pt", help="Model weights")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    args = parser.parse_args()

    model = load_model(args.weights)

    if args.image:
        result = run_inference(model, args.image, args.conf)
        print("\n=== RESULT ===")
        print(json.dumps(result, indent=2))
    elif args.dir:
        results = run_batch(model, args.dir, args.conf)
        print(f"\n=== SUMMARY: {len(results)} images processed ===")
    else:
        print("Provide --image <path> or --dir <path>")