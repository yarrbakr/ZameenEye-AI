import { AppDataSource } from "../config/database"

const CONFIDENCE_THRESHOLD = 70
const CLOUD_COVER_THRESHOLD = 60 // 60% limit recommended by architecture sync

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

    // 1. Fetch the intersecting events along with our newly migrated 'alert_level' column
    const intersectingEvents = await AppDataSource.query(
        `SELECT source, raw_payload, alert_level
         FROM "disaster_event"
         WHERE ST_Intersects(
             geom,
             (SELECT geom FROM "land" WHERE id = $1)
         )`,
        [landId]
    )

    // 2. Process events and filter out cloud-obscured data/noise
    let maxAlertLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW"
    
    const processedEvents = intersectingEvents.map((e: any) => {
        const cloudCover = e.raw_payload?.cloud_cover_percentage || 0
        let currentAlertLevel = e.alert_level || "LOW"

        // Senior Architect Ali's Noise Filter Check:
        if (cloudCover > CLOUD_COVER_THRESHOLD) {
            console.warn(`[Spatial Check] High cloud cover (${cloudCover}%) detected on event. Downgrading to LOW risk to prevent false notifications.`);
            currentAlertLevel = "LOW"
        }

        // Track the highest risk tier currently impacting the farmer's property
        if (currentAlertLevel === "HIGH") maxAlertLevel = "HIGH"
        else if (currentAlertLevel === "MEDIUM" && maxAlertLevel !== "HIGH") maxAlertLevel = "MEDIUM"

        return {
            source: e.source,
            alert_level: currentAlertLevel,
            raw_payload: e.raw_payload,
        }
    })

    // 3. Determine if an active critical push notification is necessary
    const hasActiveHazard = processedEvents.some(
        (e: any) => e.raw_payload?.confidence > CONFIDENCE_THRESHOLD && e.alert_level === "HIGH"
    )

    return {
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
            preferred_language: land.preferred_language ?? "english",
        },
        has_active_hazard: hasActiveHazard,
        // Global severity tracking token passed to Abu Bakr & Thammnah
        overall_alert_level: maxAlertLevel, 
        intersecting_events: processedEvents,
    }
}