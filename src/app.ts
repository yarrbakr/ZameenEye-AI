import "reflect-metadata"
import express from "express"
import spatialRoutes from "./routes/spatial.routes"
import ingestFirmsRoutes from "./routes/ingestFirms.routes"

const app = express()

app.use(express.json())

app.use("/", spatialRoutes)
app.use("/", ingestFirmsRoutes)
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" })
})

export default app