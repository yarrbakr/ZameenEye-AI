import { DataSource } from "typeorm"

export const up = async (dataSource: DataSource) => {
    await dataSource.query(`
        CREATE TABLE "tenant" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "name" varchar NOT NULL,
            "type" varchar CHECK ("type" IN ('agency', 'farmer_org')) NOT NULL,
            "country" varchar CHECK ("country" IN ('Pakistan', 'India', 'Kenya')) NOT NULL,
            "created_at" timestamp DEFAULT now()
        )
    `)

    await dataSource.query(`
        CREATE TABLE "user" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "tenantId" uuid REFERENCES "tenant"("id") ON DELETE RESTRICT NOT NULL,
            "phone_number" varchar UNIQUE NOT NULL,
            "role" varchar CHECK ("role" IN ('agency_admin', 'farmer')) NOT NULL,
            "name" varchar NOT NULL,
            "created_at" timestamp DEFAULT now()
        )
    `)

    await dataSource.query(`
        CREATE TABLE "land" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "tenantId" uuid REFERENCES "tenant"("id") ON DELETE RESTRICT NOT NULL,
            "ownerId" uuid REFERENCES "user"("id") ON DELETE RESTRICT NOT NULL,
            "label" varchar NOT NULL,
            "geom" geometry(Polygon, 4326) NOT NULL,
            "created_at" timestamp DEFAULT now()
        )
    `)

    await dataSource.query(`
        CREATE TABLE "disaster_event" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "source" varchar CHECK ("source" IN ('nasa_firms', 'unosat', 'copernicus')) NOT NULL,
            "geom" geometry(Point, 4326) NOT NULL,
            "raw_payload" jsonb NOT NULL,
            "detected_at" timestamp NOT NULL,
            "created_at" timestamp DEFAULT now()
        )
    `)

    // Foreign key indexes
    await dataSource.query(`CREATE INDEX "idx_user_tenant" ON "user" ("tenantId")`)
    await dataSource.query(`CREATE INDEX "idx_land_tenant" ON "land" ("tenantId")`)
    await dataSource.query(`CREATE INDEX "idx_land_owner" ON "land" ("ownerId")`)

    // Spatial indexes (GIST) — required for PostGIS queries to actually use the index
    await dataSource.query(`CREATE INDEX "idx_land_geom" ON "land" USING GIST ("geom")`)
    await dataSource.query(`CREATE INDEX "idx_disaster_event_geom" ON "disaster_event" USING GIST ("geom")`)
}

export const down = async (dataSource: DataSource) => {
    await dataSource.query(`DROP INDEX IF EXISTS "idx_disaster_event_geom"`)
    await dataSource.query(`DROP INDEX IF EXISTS "idx_land_geom"`)
    await dataSource.query(`DROP INDEX IF EXISTS "idx_land_owner"`)
    await dataSource.query(`DROP INDEX IF EXISTS "idx_land_tenant"`)
    await dataSource.query(`DROP INDEX IF EXISTS "idx_user_tenant"`)

    await dataSource.query(`DROP TABLE IF EXISTS "disaster_event"`)
    await dataSource.query(`DROP TABLE IF EXISTS "land"`)
    await dataSource.query(`DROP TABLE IF EXISTS "user"`)
    await dataSource.query(`DROP TABLE IF EXISTS "tenant"`)
}