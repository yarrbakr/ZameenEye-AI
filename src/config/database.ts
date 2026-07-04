import { DataSource } from "typeorm"
import * as dotenv from "dotenv"
import { User } from "../entities/user"
import { DisasterEvent } from "../entities/disasterEvent"
import { Land } from "../entities/land"
import { Tenant } from "../entities/tenant"
dotenv.config()

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    synchronize: false,
    logging: true,
    entities: [Tenant, User, Land, DisasterEvent + "/../entities/*.ts"],
})