import { DataSource } from "typeorm"

export const up = async (dataSource: DataSource) => {
    await dataSource.query(`
        ALTER TABLE "user"
        ADD COLUMN "preferred_language" varchar
        CHECK ("preferred_language" IN ('urdu', 'hindi', 'swahili', 'tamil'))
    `)
}

export const down = async (dataSource: DataSource) => {
    await dataSource.query(`ALTER TABLE "user" DROP COLUMN "preferred_language"`)
}