"""
ZameenEye CV — satellite-image segmentation inference (SAM / FastSAM / YOLOv8-seg).

CV/AMD lane (Kai deploys this on the AMD GPU cloud). Written to be deploy-ready and
DEVICE-AGNOSTIC: it auto-detects an AMD (ROCm) or NVIDIA GPU via torch and falls back
to CPU, so the SAME script runs on a laptop (dev) and on the AMD box (prod) with no
code change.

What it does: takes a satellite/aerial image (local path OR url), runs a segmentation
model to find regions (fields, water bodies, structures, burn/flood extents...), and
writes:
  <out>/overlay.png    the image with masks drawn on top (eyeball check / pitch slide)
  <out>/segments.json  structured per-segment output (area, bbox, pixel polygon) — the
                       shape that can feed disaster_event / land features downstream.

Honest scope: SAM/FastSAM segment regions ZERO-SHOT — they do NOT label "this is a burn
scar." Semantic labelling (train YOLO-seg on tiles, or intersect masks with FIRMS/UNOSAT)
is a follow-up. This script delivers the segmentation itself.

CLI:
  python -m cv.segment --image path/or/URL --model FastSAM-s.pt --out cv_out
  python -m cv.segment --image tile.png     --model sam_b.pt          # full Meta SAM
"""
from __future__ import annotations

import os
import json
import time
import argparse
from typing import Optional

import numpy as np


def pick_device(explicit: Optional[str] = None):
    """Auto-detect the compute device.

    On an AMD **ROCm** PyTorch build, ``torch.cuda.is_available()`` returns True and
    device ``0`` targets the AMD GPU (ROCm rides torch's CUDA API), so 'cuda'/0 == the
    AMD card. That's what makes deploying on AMD a no-code-change operation.
    """
    if explicit:
        return explicit
    try:
        import torch
        if torch.cuda.is_available():
            return 0  # first GPU: AMD on a ROCm build, NVIDIA otherwise
    except Exception:
        pass
    return "cpu"


def load_model(model_name: str):
    """Return (model, family) — the ultralytics class is chosen from the weight name."""
    name = os.path.basename(model_name).lower()
    if "fastsam" in name:  # FastSAM-s.pt / FastSAM-x.pt  (check BEFORE 'sam')
        from ultralytics import FastSAM
        return FastSAM(model_name), "fastsam"
    if "sam" in name:  # sam_b.pt / sam_l.pt / mobile_sam.pt
        from ultralytics import SAM
        return SAM(model_name), "sam"
    from ultralytics import YOLO  # yolov8x-seg.pt etc.
    return YOLO(model_name), "yolo"


def segment_image(image, model_name: str = "FastSAM-s.pt", out_dir: str = "cv_out",
                  device=None, imgsz: int = 1024, conf: float = 0.4,
                  save_overlay: bool = True) -> dict:
    """Run segmentation on one image; write overlay + segments.json; return a summary dict."""
    device = pick_device(device)
    os.makedirs(out_dir, exist_ok=True)
    model, family = load_model(model_name)

    # No prompts -> "segment everything" for SAM/FastSAM; standard instance seg for YOLO.
    kwargs = dict(device=device, imgsz=imgsz, verbose=False)
    if family in ("yolo", "fastsam"):
        kwargs.update(conf=conf, retina_masks=True)

    t0 = time.time()
    results = model(image, **kwargs)
    elapsed = time.time() - t0
    r = results[0]

    segments = []
    if r.masks is not None:
        names = r.names or {}
        boxes = r.boxes
        for i, poly in enumerate(r.masks.xy):  # polygons in pixel coords
            p = np.asarray(poly, dtype="float64")
            if len(p) < 3:
                continue
            x, y = p[:, 0], p[:, 1]
            area = 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))  # shoelace
            seg = {
                "id": i,
                "area_px": round(float(area), 1),
                "bbox_xyxy": [round(float(x.min()), 1), round(float(y.min()), 1),
                              round(float(x.max()), 1), round(float(y.max()), 1)],
                "polygon": [[round(float(a), 1), round(float(b), 1)] for a, b in p.tolist()],
            }
            # class/confidence only make sense for a trained YOLO model.
            if family == "yolo" and boxes is not None and getattr(boxes, "cls", None) is not None and i < len(boxes.cls):
                cid = int(boxes.cls[i])
                seg["class"] = names.get(cid, str(cid))
                seg["confidence"] = round(float(boxes.conf[i]), 3)
            segments.append(seg)

    h, w = r.orig_shape
    summary = {
        "image": str(image),
        "model": model_name,
        "device": str(device),
        "image_size": {"w": int(w), "h": int(h)},
        "num_segments": len(segments),
        "inference_seconds": round(elapsed, 3),
        "segments": segments,
    }

    with open(os.path.join(out_dir, "segments.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    if save_overlay:
        overlay_bgr = r.plot()  # numpy BGR image with masks drawn
        from PIL import Image
        Image.fromarray(overlay_bgr[:, :, ::-1]).save(os.path.join(out_dir, "overlay.png"))  # BGR->RGB

    return summary


def main():
    ap = argparse.ArgumentParser(description="ZameenEye satellite segmentation inference (AMD-ready)")
    ap.add_argument("--image", required=True, help="Path or URL to a satellite/aerial image")
    ap.add_argument("--model", default="FastSAM-s.pt",
                    help="Weight name: FastSAM-s.pt (fast, everything) | sam_b.pt (full SAM) | yolov8x-seg.pt")
    ap.add_argument("--out", default="cv_out", help="Output directory")
    ap.add_argument("--device", default=None,
                    help="Force device: cpu | 0 | cuda  (default: auto-detect AMD/NVIDIA/CPU)")
    ap.add_argument("--imgsz", type=int, default=1024)
    ap.add_argument("--conf", type=float, default=0.4)
    args = ap.parse_args()

    s = segment_image(args.image, args.model, args.out, args.device, args.imgsz, args.conf)
    print(f"[cv] device={s['device']}  model={s['model']}  image={s['image_size']['w']}x{s['image_size']['h']}")
    print(f"[cv] segments={s['num_segments']}  inference={s['inference_seconds']}s")
    print(f"[cv] wrote {os.path.join(args.out, 'overlay.png')} + {os.path.join(args.out, 'segments.json')}")


if __name__ == "__main__":
    main()
