"""ZameenEye CV lane — satellite-image segmentation (deploy target: AMD GPU cloud)."""
from .segment import segment_image, load_model, pick_device

__all__ = ["segment_image", "load_model", "pick_device"]
