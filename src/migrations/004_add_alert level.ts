import { DataSource } from "typeorm"

// Adds disaster_event.alert_level (LOW / MEDIUM / HIGH).
// Written as plain up/down functions to match THIS project's custom runner, which
// calls `migration.up(dataSource)` (see src/scripts/runner.ts and the other
// migrations). CLAUDE.md is explicit: do not use TypeORM class-style migrations here.
export const up = async (dataSource: DataSource) => {
    // 1. Create the enum type if it doesn't already exist (safe to re-run)
    await dataSource.query(`
        DO $$ BEGIN
            CREATE TYPE "public"."disaster_event_alert_level_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // 2. Add the column with a safe default (idempotent)
    await dataSource.query(`
        ALTER TABLE "disaster_event"
        ADD COLUMN IF NOT EXISTS "alert_level" "public"."disaster_event_alert_level_enum"
        NOT NULL DEFAULT 'LOW'
    `)
}

export const down = async (dataSource: DataSource) => {
    await dataSource.query(`ALTER TABLE "disaster_event" DROP COLUMN IF EXISTS "alert_level"`)
    await dataSource.query(`DROP TYPE IF EXISTS "public"."disaster_event_alert_level_enum"`)
}
