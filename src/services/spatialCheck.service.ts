import { AppDataSource } from "../config/database"

const CONFIDENCE_THRESHOLD = 70

export const checkLandIntersection = async (landId: string) => {
    const landResult = await AppDataSource.query(
        `SELECT l.id, l.label, t.country, u.name AS owner_name, u.phone_number, 
                u.role AS owner_role, u.preferred_language
         FROM "land" l
         JOIN "tenant" t ON l."tenantId" = t.id
         JOIN "user" u ON l."ownerId" = u.id
         WHERE l.id = $1`,
        [landId]
    )

    if (!landResult.length) {
        throw new Error("Land not found")
    }

    const land = landResult[0]

    const intersectingEvents = await AppDataSource.query(
        `SELECT source, raw_payload
         FROM "disaster_event"
         WHERE ST_Intersects(
             geom,
             (SELECT geom FROM "land" WHERE id = $1)
         )`,
        [landId]
    )

    const hasActiveHazard = intersectingEvents.some(
        (e: any) => e.raw_payload?.confidence > CONFIDENCE_THRESHOLD
    )

    return {
        // Genuinely new field: when THIS /spatial-check call ran.
        // Distinct from raw_payload.detected_at, which is the real-world
        // FIRMS satellite detection time. Thammnah's prompt logic should
        // keep using raw_payload.detected_at, this field is purely for
        // knowing how fresh a given check result is, not hazard timing.
        checked_at: new Date().toISOString(),
        land: {
            id: land.id,
            label: land.label,
            country: land.country,
        },
        owner: {
            name: land.owner_name,
            phone_number: land.phone_number,
            role: land.owner_role,
            // Falls back to "english" when a farmer hasn't set a language
            // preference yet. Everyone with an actual preference set still
            // gets that language, this only covers the null case.
            preferred_language: land.preferred_language ?? "english",
        },
        has_active_hazard: hasActiveHazard,
        // Note: no more top-level detected_at per event, that was a duplicate
        // of raw_payload.detected_at and drifted due to Postgres timestamp
        // conversion. raw_payload.detected_at is now the single source of truth
        // for event timing.
        intersecting_events: intersectingEvents.map((e: any) => ({
            source: e.source,
            raw_payload: e.raw_payload,
        })),
    }
}