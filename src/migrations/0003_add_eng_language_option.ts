// src/migrations/0004_add_english_language_option.ts
import { DataSource } from "typeorm"

export const up = async (dataSource: DataSource) => {
    await dataSource.query(`
        ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_preferred_language_check"
    `)
    await dataSource.query(`
        ALTER TABLE "user"
        ADD CONSTRAINT "user_preferred_language_check"
        CHECK ("preferred_language" IN ('urdu', 'hindi', 'swahili', 'tamil', 'english'))
    `)
}

export const down = async (dataSource: DataSource) => {
    await dataSource.query(`
        ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_preferred_language_check"
    `)
    await dataSource.query(`
        ALTER TABLE "user"
        ADD CONSTRAINT "user_preferred_language_check"
        CHECK ("preferred_language" IN ('urdu', 'hindi', 'swahili', 'tamil'))
    `)
}