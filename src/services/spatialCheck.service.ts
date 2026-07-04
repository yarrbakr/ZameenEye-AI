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
        `SELECT source, detected_at, raw_payload
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
        land: {
            id: land.id,
            label: land.label,
            country: land.country,
        },
        owner: {
            name: land.owner_name,
            phone_number: land.phone_number,
            role: land.owner_role,
            preferred_language: land.preferred_language,
        },
        has_active_hazard: hasActiveHazard,
        intersecting_events: intersectingEvents.map((e: any) => ({
            source: e.source,
            detected_at: e.detected_at,
            raw_payload: e.raw_payload,
        })),
    }
}