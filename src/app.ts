import "reflect-metadata"
import express from "express"
import spatialRoutes from "./routes/spatial.routes"

const app = express()

app.use(express.json())

app.use("/", spatialRoutes)

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" })
})

export default app