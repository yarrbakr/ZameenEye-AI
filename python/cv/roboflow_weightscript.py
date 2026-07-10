"""
One-off helper to (re)download the Wildfire dataset from Roboflow.

NOTE: the dataset is ALREADY vendored in this repo at python/cv/Wildfire-1, so you do not
need this script to train — run_yolo.py works straight off the checked-in data. This is
kept only for pulling a fresh export.

SECURITY: the API key must come from the environment; never hardcode it. The previously
committed key was leaked in git history and MUST be rotated in the Roboflow dashboard.

    ROBOFLOW_API_KEY=<key>  python cv/roboflow_weightscript.py
"""
import os
import sys

from roboflow import Roboflow

api_key = os.getenv("ROBOFLOW_API_KEY")
if not api_key:
    sys.exit("Set ROBOFLOW_API_KEY in your environment (the old hardcoded key was leaked "
             "and must be rotated).")

rf = Roboflow(api_key=api_key)
project = rf.workspace("kainat-khan-2r7d9").project("wildfire-4tdl8-i19mt")
version = project.version(1)

print("Downloading the dataset export...")
version.download("yolov8")
print("Download complete!")
