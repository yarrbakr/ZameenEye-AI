import os, csv, io, json, time, logging
from datetime import datetime, timezone
from pathlib import Path
import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

FIRMS_MAP_KEY = os.environ.get("FIRMS_MAP_KEY", "PASTE_YOUR_KEY_HERE")
BACKEND_INGEST_URL = os.environ.get("BACKEND_INGEST_URL", "http://localhost:3000/ingest/firms")
SOURCE = "VIIRS_SNPP_NRT"
BOUNDING_BOX = "60,5,90,35"
DAY_RANGE = 1
POLL_INTERVAL_SECONDS = 900
CONFIDENCE_MAP = {"low": 30, "nominal": 60, "high": 90}

DATA_DIR = Path(__file__).parent / "data_lake"
DATA_DIR.mkdir(exist_ok=True)
LATEST_FILE = DATA_DIR / "latest_hotspots.json"
LOG_FILE = DATA_DIR / "ingestion_log.jsonl"

FIRMS_URL = "https://firms.modis.gov/api/area/csv/{map_key}/{source}/{bbox}/{day_range}"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("firms_ingestion")

@retry(reraise=True, stop=stop_after_attempt(4),
       wait=wait_exponential(multiplier=2, min=2, max=30),
       retry=retry_if_exception_type((requests.exceptions.RequestException,)))
def fetch_firms_csv() -> str:
    url = FIRMS_URL.format(map_key=FIRMS_MAP_KEY, source=SOURCE,
                            bbox=BOUNDING_BOX, day_range=DAY_RANGE)
    logger.info("Requesting FIRMS data...")
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    if resp.text.strip().lower().startswith(("invalid", "error")):
        raise ValueError(f"FIRMS API error payload: {resp.text[:200]}")
    return resp.text

def parse_firms_csv(raw_csv: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(raw_csv))
    records = []
    for row in reader:
        try:
            raw_confidence = row.get("confidence", "unknown")
            numeric_confidence = CONFIDENCE_MAP.get(str(raw_confidence).lower(), None)

            records.append({
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "brightness": float(row.get("bright_ti4", row.get("brightness", 0)) or 0),
                "confidence_raw": raw_confidence,
                "confidence": numeric_confidence,
                "acq_date": row.get("acq_date"),
                "acq_time": row.get("acq_time"),
                "satellite": row.get("satellite", SOURCE),
                "frp": float(row.get("frp", 0) or 0),
                "daynight": row.get("daynight"),
            })
        except (KeyError, ValueError) as e:
            logger.warning("Skipping malformed row: %s (%s)", row, e)
    return records

def save_snapshot(records: list[dict]) -> None:
    snapshot = {
        "fetched_at_utc": datetime.now(timezone.utc).isoformat(),
        "bounding_box": BOUNDING_BOX, "source": SOURCE,
        "record_count": len(records), "records": records,
    }
    LATEST_FILE.write_text(json.dumps(snapshot, indent=2))
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps({"fetched_at_utc": snapshot["fetched_at_utc"],
                             "record_count": len(records)}) + "\n")
    logger.info("Saved %d hotspot records -> %s", len(records), LATEST_FILE)


def push_to_backend(records: list[dict]) -> None:
    if not records:
        logger.info("No records to push.")
        return

    # Build payload matching Kai's exact expected shape
    formatted_records = [
        {
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "brightness": r["brightness"],
            "frp": r["frp"],
            "confidence": r["confidence_raw"],  # sending raw value per her sample — confirm with her
            "acq_date": r["acq_date"],
            "acq_time": r["acq_time"],
            "satellite": r["satellite"],
        }
        for r in records
    ]

    try:
        resp = requests.post(BACKEND_INGEST_URL, json={"records": formatted_records}, timeout=15)
        resp.raise_for_status()
        result = resp.json()
        logger.info("Backend response: inserted=%s skipped=%s total=%s",
                    result.get("inserted"), result.get("skipped"), result.get("total"))
    except requests.exceptions.RequestException as e:
        logger.error("Failed to push records to backend: %s", e)

def run_once() -> list[dict]:
    records = parse_firms_csv(fetch_firms_csv())
    save_snapshot(records)
    push_to_backend(records)
    return records

def run_forever():
    logger.info("Starting continuous FIRMS sync every %ds", POLL_INTERVAL_SECONDS)
    while True:
        try:
            run_once()
        except Exception as e:
            logger.error("Fetch cycle failed after retries: %s", e)
        time.sleep(POLL_INTERVAL_SECONDS)

if __name__ == "__main__":
    if FIRMS_MAP_KEY == "PASTE_YOUR_KEY_HERE":
        logger.warning("Set FIRMS_MAP_KEY env var first!")
    run_forever()