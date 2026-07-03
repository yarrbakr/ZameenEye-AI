import { DataSource } from "typeorm"
import * as dotenv from "dotenv"

dotenv.config()

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    synchronize: false,
    logging: true,
    entities: [__dirname + "/../entities/*.ts"],
    migrations: [__dirname + "/../migrations/*.ts"],
})