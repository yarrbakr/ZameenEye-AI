import { AppDataSource } from "../config/database"
import * as fs from "fs"
import * as path from "path"

const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations")
const SEEDS_DIR = path.resolve(__dirname, "../seeds")

// ─── DB INIT ───────────────────────────────────────────

const initDB = async () => {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize()
        console.log("✅ DB connected")
    }
}

// ─── TRACKING TABLES ───────────────────────────────────

const ensureTrackingTables = async () => {
    await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS "_migrations" (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            ran_at TIMESTAMP DEFAULT now()
        )
    `)
    await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS "_seeds" (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            ran_at TIMESTAMP DEFAULT now()
        )
    `)
}

// ─── HELPERS ───────────────────────────────────────────

const getRanMigrations = async (): Promise<string[]> => {
    const rows = await AppDataSource.query(`SELECT name FROM "_migrations" ORDER BY ran_at`)
    return rows.map((r: any) => r.name)
}

const getRanSeeds = async (): Promise<string[]> => {
    const rows = await AppDataSource.query(`SELECT name FROM "_seeds" ORDER BY ran_at`)
    return rows.map((r: any) => r.name)
}

const getFiles = (dir: string) => {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
        .filter(f => f.endsWith(".ts") || f.endsWith(".js"))
        .sort()  // timestamp prefix keeps order correct
}

// ─── MIGRATIONS ────────────────────────────────────────

const runMigrations = async () => {
    await initDB()
    await ensureTrackingTables()

    const ran = await getRanMigrations()
    const files = getFiles(MIGRATIONS_DIR)
    const pending = files.filter(f => !ran.includes(f))

    if (pending.length === 0) {
        console.log("✅ No pending migrations")
        return
    }

    for (const file of pending) {
        console.log(`⏳ Running migration: ${file}`)
        const migration = require(path.join(MIGRATIONS_DIR, file))

        try {
            await migration.up(AppDataSource)
            await AppDataSource.query(
                `INSERT INTO "_migrations" (name) VALUES ($1)`,
                [file]
            )
            console.log(`✅ Done: ${file}`)
        } catch (err) {
            console.error(`❌ Failed: ${file}`, err)
            throw err
        }
    }
}

const revertMigration = async () => {
    await initDB()
    await ensureTrackingTables()

    const ran = await getRanMigrations()
    if (ran.length === 0) {
        console.log("Nothing to revert")
        return
    }

    const last = ran[ran.length - 1]
    console.log(`⏳ Reverting: ${last}`)
    const migration = require(path.join(MIGRATIONS_DIR, last))

    await migration.down(AppDataSource)
    await AppDataSource.query(`DELETE FROM "_migrations" WHERE name = $1`, [last])
    console.log(`✅ Reverted: ${last}`)
}

const revertAllMigrations = async () => {
    await initDB()
    await ensureTrackingTables()

    const ran = await getRanMigrations()
    for (const name of [...ran].reverse()) {
        console.log(`⏳ Reverting: ${name}`)
        const migration = require(path.join(MIGRATIONS_DIR, name))
        await migration.down(AppDataSource)
        await AppDataSource.query(`DELETE FROM "_migrations" WHERE name = $1`, [name])
        console.log(`✅ Reverted: ${name}`)
    }
}

// show checklist of all migrations
const statusMigrations = async () => {
    await initDB()
    await ensureTrackingTables()

    const ran = await getRanMigrations()
    const files = getFiles(MIGRATIONS_DIR)

    console.log("\n📋 Migration Status:")
    console.log("─────────────────────────────────")
    if (files.length === 0) {
        console.log("No migration files found")
    }
    for (const file of files) {
        const status = ran.includes(file) ? "✅ ran" : "⏳ pending"
        console.log(`${status}  →  ${file}`)
    }
    console.log("─────────────────────────────────\n")
}

// ─── SEEDS ─────────────────────────────────────────────

const runSeeds = async () => {
    await initDB()
    await ensureTrackingTables()

    const ran = await getRanSeeds()
    const files = getFiles(SEEDS_DIR)
    const pending = files.filter(f => !ran.includes(f))

    if (pending.length === 0) {
        console.log("✅ No pending seeds")
        return
    }

    for (const file of pending) {
        console.log(`⏳ Running seed: ${file}`)
        const seed = require(path.join(SEEDS_DIR, file))

        try {
            await seed.up(AppDataSource)
            await AppDataSource.query(
                `INSERT INTO "_seeds" (name) VALUES ($1)`,
                [file]
            )
            console.log(`✅ Done: ${file}`)
        } catch (err) {
            console.error(`❌ Failed: ${file}`, err)
            throw err
        }
    }
}

const revertSeed = async () => {
    await initDB()
    await ensureTrackingTables()

    const ran = await getRanSeeds()
    if (ran.length === 0) {
        console.log("Nothing to revert")
        return
    }

    const last = ran[ran.length - 1]
    console.log(`⏳ Reverting seed: ${last}`)
    const seed = require(path.join(SEEDS_DIR, last))

    await seed.down(AppDataSource)
    await AppDataSource.query(`DELETE FROM "_seeds" WHERE name = $1`, [last])
    console.log(`✅ Reverted: ${last}`)
}

const statusSeeds = async () => {
    await initDB()
    await ensureTrackingTables()

    const ran = await getRanSeeds()
    const files = getFiles(SEEDS_DIR)

    console.log("\n📋 Seed Status:")
    console.log("─────────────────────────────────")
    if (files.length === 0) {
        console.log("No seed files found")
    }
    for (const file of files) {
        const status = ran.includes(file) ? "✅ ran" : "⏳ pending"
        console.log(`${status}  →  ${file}`)
    }
    console.log("─────────────────────────────────\n")
}

// ─── CLI ───────────────────────────────────────────────

const main = async () => {
    const command = process.argv[2]

    try {
        switch (command) {
            case "migration:run":       await runMigrations();      break
            case "migration:revert":    await revertMigration();    break
            case "migration:revert:all":await revertAllMigrations();break
            case "migration:status":    await statusMigrations();   break
            case "seed:run":            await runSeeds();            break
            case "seed:revert":         await revertSeed();          break
            case "seed:status":         await statusSeeds();         break
            default:
                console.log(`
Unknown command: ${command}

Available commands:
  migration:run         run pending migrations
  migration:revert      revert last migration
  migration:revert:all  revert all migrations
  migration:status      show checklist of all migrations

  seed:run              run pending seeds
  seed:revert           revert last seed
  seed:status           show checklist of all seeds
                `)
        }
    } catch (err) {
        console.error("Error:", err)
        process.exit(1)
    } finally {
        if (AppDataSource.isInitialized) await AppDataSource.destroy()
        process.exit(0)
    }
}

main()