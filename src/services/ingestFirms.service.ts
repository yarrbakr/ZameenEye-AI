import { AppDataSource } from "../config/database"

// Defensive fallback in case a raw category string ever slips through,
// even though Thammnah's ingestion script is expected to send numeric confidence.
// VIIRS NRT data natively reports confidence as low/nominal/high, not a number,
// so this exists purely as a safety net, not the primary path.
const CONFIDENCE_CATEGORY_MAP: Record<string, number> = {
    low: 30,
    nominal: 60,
    high: 90,
}

// Accepts either a number (expected, normal case) or a category string (fallback case).
// Throws if it gets something unrecognized, so a bad value fails loudly instead of
// silently becoming NaN or undefined further down the pipeline.
const normalizeConfidence = (confidence: number | string): number => {
    if (typeof confidence === "number") return confidence
    const mapped = CONFIDENCE_CATEGORY_MAP[confidence.toLowerCase()]
    if (mapped === undefined) {
        throw new Error(`Unrecognized confidence value: ${confidence}`)
    }
    return mapped
}

// FIRMS reports date and time as two separate fields:
//   acq_date: "2026-07-04"
//   acq_time: "1030"  (UTC, in HHMM format, sometimes without leading zero)
// This combines them into one proper ISO 8601 UTC timestamp, so we always store
// detected_at consistently, avoiding the kind of format drift seen earlier
// between the seed data's top-level column vs. its raw_payload copy.
const buildDetectedAt = (acqDate: string, acqTime: string): string => {
    const hours = acqTime.padStart(4, "0").slice(0, 2)
    const minutes = acqTime.padStart(4, "0").slice(2, 4)
    return `${acqDate}T${hours}:${minutes}:00Z`
}

// Shape of a single record as sent by Thammnah's firms_fetch.py output.
// frp and brightness are both optional since FIRMS doesn't always populate both,
// hence the fallback logic below when picking which one becomes "intensity".
type FirmsRecord = {
    latitude: number
    longitude: number
    brightness?: number
    frp?: number
    confidence: number | string
    acq_date: string
    acq_time: string
    satellite?: string
}

// Takes a batch of raw FIRMS records and writes each one into disaster_event,
// normalizing field names/values along the way so downstream consumers
// (like /spatial-check) always see a consistent shape regardless of which
// raw FIRMS fields happened to be present for a given record.
export const ingestFirmsRecords = async (records: FirmsRecord[]) => {
    let inserted = 0
    let skipped = 0

    for (const record of records) {
        try {
            // Normalize confidence to a number so the 70-threshold check in
            // spatialCheck.service.ts always compares number > number, never
            // a string sneaking through and silently evaluating false.
            const confidence = normalizeConfidence(record.confidence)

            // Prefer FRP (fire radiative power) as the intensity metric when present,
            // since it's generally considered more meaningful than raw brightness.
            // Falls back to brightness if FRP is missing or zero.
            const intensity = record.frp && record.frp > 0 ? record.frp : record.brightness ?? 0

            // Combine FIRMS' separate date/time fields into one clean timestamp.
            const detectedAt = buildDetectedAt(record.acq_date, record.acq_time)

            // PostGIS expects WKT (Well-Known Text) format for geometry input.
            // Note: WKT is (longitude, latitude) order, NOT (latitude, longitude).
            const pointWKT = `POINT(${record.longitude} ${record.latitude})`

            await AppDataSource.query(
                `INSERT INTO "disaster_event" (source, geom, raw_payload, detected_at)
                 VALUES ($1, ST_SetSRID(ST_GeomFromText($2), 4326), $3, $4)`,
                [
                    "nasa_firms",
                    pointWKT,
                    // raw_payload keys are intentionally normalized (confidence, intensity,
                    // detected_at) rather than dumping FIRMS' raw field names, so Thammnah's
                    // prompt builder never needs source-specific parsing logic.
                    JSON.stringify({
                        confidence,
                        intensity,
                        detected_at: detectedAt,
                    }),
                    detectedAt,
                ]
            )
            inserted++
        } catch (err: any) {
            // One malformed record (bad confidence value, missing date, etc.) should
            // never fail the entire batch. Log it, skip it, keep processing the rest.
            console.warn(`Skipping malformed FIRMS record: ${err.message}`)
            skipped++
        }
    }

    // Summary returned to the caller so it's obvious if some records silently failed,
    // rather than just returning a bare success with no visibility into partial failures.
    return { inserted, skipped, total: records.length }
}