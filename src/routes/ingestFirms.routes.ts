import { Router } from "express"
import { ingestFirmsController } from "../controllers/ingestFirms.controller"

// Defines the actual URL path for FIRMS ingestion.
// Mounted in app.ts alongside spatialRoutes and (eventually) Abu Bakr's webhook router,
// all sharing the same Express app instance rather than separate servers.
const router = Router()
router.post("/ingest/firms", ingestFirmsController)

export default router