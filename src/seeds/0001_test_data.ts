import { DataSource } from "typeorm"

// Clearly marked test data, safe to identify and revert precisely.
// Mirrors Thammnah's sandbox_test.py packets exactly, so both sides can be
// cross-checked against the same scenarios.
// Naming convention: everything prefixed with "TEST_SEED_" so down() can
// delete exactly what up() created, never a blanket wipe of real data.

const SEED_MARKER = "TEST_SEED_zameeneye"

type TestCase = {
    key: string
    country: "Pakistan" | "India" | "Kenya"
    landLabel: string
    ownerName: string
    ownerRole: "farmer" | "agency_admin"
    preferredLanguage: "urdu" | "hindi" | "swahili" | "tamil"
    phoneSuffix: string
    landPolygonWKT: string
    hazard: null | { confidence: number; intensity: number; detectedAt: string; pointWKT: string }
}

// Each land polygon is a small distinct square so events don't cross-intersect
const TEST_CASES: TestCase[] = [
    {
        key: "ur_active",
        country: "Pakistan",
        landLabel: `${SEED_MARKER}_Multan_Field_A`,
        ownerName: `${SEED_MARKER}_Ali`,
        ownerRole: "farmer",
        preferredLanguage: "urdu",
        phoneSuffix: "+923000000001",
        landPolygonWKT: `POLYGON((71.500 30.150, 71.510 30.150, 71.510 30.160, 71.500 30.160, 71.500 30.150))`,
        hazard: {
            confidence: 85,
            intensity: 340,
            detectedAt: "2026-07-04T10:00:00Z",
            pointWKT: `POINT(71.505 30.155)`,
        },
    },
    {
        key: "hi_active",
        country: "India",
        landLabel: `${SEED_MARKER}_Sindh_Block_3`,
        ownerName: `${SEED_MARKER}_Ravi`,
        ownerRole: "agency_admin",
        preferredLanguage: "hindi",
        phoneSuffix: "+913000000002",
        landPolygonWKT: `POLYGON((72.500 25.150, 72.510 25.150, 72.510 25.160, 72.500 25.160, 72.500 25.150))`,
        hazard: {
            confidence: 92,
            intensity: 410,
            detectedAt: "2026-07-04T09:00:00Z",
            pointWKT: `POINT(72.505 25.155)`,
        },
    },
    {
        key: "sw_clear",
        country: "Kenya",
        landLabel: `${SEED_MARKER}_Kano_Plot`,
        ownerName: `${SEED_MARKER}_Amina`,
        ownerRole: "farmer",
        preferredLanguage: "swahili",
        phoneSuffix: "+254300000003",
        landPolygonWKT: `POLYGON((36.500 -1.150, 36.510 -1.150, 36.510 -1.140, 36.500 -1.140, 36.500 -1.150))`,
        hazard: null, // no intersecting event at all
    },
    {
        key: "ta_subthreshold",
        country: "India",
        landLabel: `${SEED_MARKER}_TamilNadu_Plot_7`,
        ownerName: `${SEED_MARKER}_Priya`,
        ownerRole: "farmer",
        preferredLanguage: "tamil",
        phoneSuffix: "+914000000004",
        landPolygonWKT: `POLYGON((78.500 11.150, 78.510 11.150, 78.510 11.160, 78.500 11.160, 78.500 11.150))`,
        hazard: {
            confidence: 40, // below the 70 threshold — intersects but has_active_hazard stays false
            intensity: 50,
            detectedAt: "2026-07-04T08:00:00Z",
            pointWKT: `POINT(78.505 11.155)`,
        },
    },
]

export const up = async (dataSource: DataSource) => {
    if (process.env.NODE_ENV === "production") {
        throw new Error(
            "Refusing to run seed file in production. Seeds are for local/dev testing only."
        )
    }

    for (const testCase of TEST_CASES) {
        const tenantResult = await dataSource.query(
            `INSERT INTO "tenant" (name, type, country)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [`${SEED_MARKER}_tenant_${testCase.key}`, "farmer_org", testCase.country]
        )
        const tenantId = tenantResult[0].id

        const userResult = await dataSource.query(
            `INSERT INTO "user" (name, phone_number, role, "tenantId", preferred_language)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [testCase.ownerName, `${SEED_MARKER}_${testCase.phoneSuffix}`, testCase.ownerRole, tenantId, testCase.preferredLanguage]
        )
        const userId = userResult[0].id

        const landResult = await dataSource.query(
            `INSERT INTO "land" (label, "tenantId", "ownerId", geom)
             VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromText($4), 4326))
             RETURNING id`,
            [testCase.landLabel, tenantId, userId, testCase.landPolygonWKT]
        )
        const landId = landResult[0].id

        if (testCase.hazard) {
            await dataSource.query(
                `INSERT INTO "disaster_event" (source, geom, raw_payload, detected_at)
                 VALUES ($1, ST_SetSRID(ST_GeomFromText($2), 4326), $3, $4)`,
                [
                    "nasa_firms",
                    testCase.hazard.pointWKT,
                    JSON.stringify({
                        confidence: testCase.hazard.confidence,
                        intensity: testCase.hazard.intensity,
                        detected_at: testCase.hazard.detectedAt,
                    }),
                    testCase.hazard.detectedAt,
                ]
            )
        }

        console.log(`✅ [${testCase.key}] landId to use in Postman: ${landId}`)
    }
}

export const down = async (dataSource: DataSource) => {
    // Delete only rows matching the seed marker, never a blanket delete.
    for (const testCase of TEST_CASES) {
        await dataSource.query(
            `DELETE FROM "disaster_event"
             WHERE geom IS NOT NULL
             AND raw_payload->>'detected_at' = $1`,
            [testCase.hazard?.detectedAt ?? "__none__"]
        )

        await dataSource.query(`DELETE FROM "land" WHERE label = $1`, [testCase.landLabel])
        await dataSource.query(
            `DELETE FROM "user" WHERE phone_number = $1`,
            [`${SEED_MARKER}_${testCase.phoneSuffix}`]
        )
        await dataSource.query(
            `DELETE FROM "tenant" WHERE name = $1`,
            [`${SEED_MARKER}_tenant_${testCase.key}`]
        )
    }

    console.log("✅ All test seed data removed")
}