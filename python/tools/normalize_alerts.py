#!/usr/bin/env python3
"""
Normalize spatial_inference output -> canonical raw_payload used by backend/dashboard.

Drop-in translator for demo workflows. Keeps original alert for traceability and
emits a compact "raw_payload" object with both WKT and GeoJSON variants plus
canonical hazard_type and confidence as integer percent.

Usage:
  python python/tools/normalize_alerts.py input.json output.json
Or to stream:
  cat inference_raw.json | python python/tools/normalize_alerts.py - -

This script is intentionally standalone so you can run it locally for the demo
without changing any core inference code.
"""
from __future__ import annotations
import sys
import json
from typing import Any, Dict, Optional


def map_hazard(label: str) -> str:
    if not label:
        return "other"
    l = label.lower()
    if "fire" in l or "wildfire" in l:
        return "fire"
    if "flood" in l:
        return "flood"
    if "storm" in l:
        return "storm"
    if "none" in l:
        return "none"
    return "other"


def parse_wkt_point(wkt: str) -> Optional[list[float]]:
    if not wkt:
        return None
    try:
        # supports "SRID=4326;POINT(lon lat)" or "POINT(lon lat)"
        if ";" in wkt:
            wkt = wkt.split(";", 1)[1]
        wkt = wkt.strip()
        if not wkt.upper().startswith("POINT"):
            return None
        inner = wkt[wkt.find("(")+1:wkt.find(")")]
        lon, lat = inner.strip().split()
        return [float(lon), float(lat)]
    except Exception:
        return None


def normalize_alert(alert: Dict[str, Any]) -> Dict[str, Any]:
    hazard_raw = alert.get("hazard_type") or alert.get("label") or ""
    hazard = map_hazard(hazard_raw)

    conf = alert.get("confidence")
    # if float 0..1 -> percent
    if isinstance(conf, float) and 0 <= conf <= 1:
        conf_pct = int(conf * 100)
    else:
        try:
            conf_pct = int(conf) if conf is not None else None
        except Exception:
            conf_pct = None

    coords = parse_wkt_point(alert.get("geom"))
    geojson = {"type": "Point", "coordinates": coords} if coords else None

    return {
        "hazard_type": hazard,
        "confidence": conf_pct,
        "intensity": alert.get("intensity"),
        "detected_at": alert.get("detected_at"),
        "geom_wkt": alert.get("geom"),
        "geom_geojson": geojson,
        # keep original for traceability
        "raw_original": alert,
    }


def main() -> None:
    inpath = sys.argv[1] if len(sys.argv) > 1 else "-"
    outpath = sys.argv[2] if len(sys.argv) > 2 else "-"

    if inpath == "-":
        data = json.load(sys.stdin)
    else:
        with open(inpath, "r", encoding="utf-8") as f:
            data = json.load(f)

    # support either a list of alerts or single alert
    alerts = data if isinstance(data, list) else [data]

    normalized = []
    for a in alerts:
        normalized.append({
            "source": a.get("source", "spatial_inference"),
            "raw_payload": normalize_alert(a)
        })

    if outpath == "-":
        json.dump(normalized, sys.stdout, indent=2, ensure_ascii=False)
    else:
        with open(outpath, "w", encoding="utf-8") as f:
            json.dump(normalized, f, indent=2, ensure_ascii=False)
        print(f"Wrote {len(normalized)} normalized events to {outpath}")


if __name__ == "__main__":
    main()
