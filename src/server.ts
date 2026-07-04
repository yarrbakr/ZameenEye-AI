import * as dotenv from "dotenv"
dotenv.config()

import app from "./app"
import { AppDataSource } from "./config/database"

const PORT = process.env.PORT || 3000

const startServer = async () => {
    try {
        await AppDataSource.initialize()
        console.log("DB connected")

        app.listen(PORT, () => {
            console.log(` Server running on port ${PORT}`)
        })
    } catch (err) {
        console.error(" Failed to start server:", err)
        process.exit(1)
    }
}

startServer()