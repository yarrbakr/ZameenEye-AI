# ZameenEye CV — Satellite Segmentation (AMD GPU lane)

Runs a segmentation model over satellite / aerial imagery to propose **regions**
(fields, water bodies, structures, burn / flood extents) as candidate hazard & land
features. Device-agnostic: the **same** script runs on CPU (dev) and on the **AMD GPU**
(prod) — it auto-detects the GPU through torch, so there is no code change to deploy.

> Owner: CV/AMD lane (Kai deploys on the AMD box). Written by the voice/DevOps lane as
> the inference artifact to hand over — needs **no AMD registration to write or test**.

## Why this is AMD-ready
`pick_device()` uses `torch.cuda.is_available()`. On a **ROCm** PyTorch build that
returns `True`, and device `0` is the AMD GPU (ROCm rides torch's CUDA API). So on the
AMD box you just install the ROCm torch build and run — the script picks the GPU itself.

## Install on the AMD box
```bash
pip install ultralytics opencv-python-headless pillow numpy
# match rocm6.x to the box's ROCm version:
pip install torch torchvision --index-url https://download.pytorch.org/whl/rocm6.2
```

## Run
```bash
# segment everything (fast, good default)
python -m cv.segment --image /data/tile.png --model FastSAM-s.pt --out cv_out

# full Meta SAM (heavier, strongest masks)
python -m cv.segment --image https://example.com/tile.png --model sam_b.pt --out cv_out
```
Run from `python/` so `python -m cv.segment` resolves.

**Outputs**
| file | what |
|---|---|
| `cv_out/overlay.png` | masks drawn on the image (eyeball check / pitch slide) |
| `cv_out/segments.json` | per-segment `area_px`, `bbox_xyxy`, pixel `polygon` |

## Confirm it actually used the AMD GPU
- `segments.json` → `"device"` prints `0` on GPU, `cpu` otherwise. On the AMD box it must say `0`.
- `rocm-smi` should show GPU utilization during the run.

## Models
| model | speed | notes |
|---|---|---|
| `FastSAM-s.pt` | fast | segment-everything, great default (auto-downloads) |
| `FastSAM-x.pt` | med | better masks |
| `sam_b.pt` | slow(CPU)/fast(GPU) | full Meta SAM (ViT-B), strongest masks — good AMD showcase |
| `yolov8x-seg.pt` | fast | instance seg **with labels**, but COCO classes → retrain on satellite tiles to be useful |

## How this feeds the product (roadmap — honest)
`segments.json` is in **pixel space**. To turn a mask into a `disaster_event` / land
polygon in Supabase PostGIS you need the image's **geo-transform** (lat/lon per pixel):
read it from a GeoTIFF with `rasterio`/GDAL and map the polygon points to coordinates.
That geo-referencing step is the follow-up; this script delivers the segmentation, which
is the part that needs the AMD GPU.
