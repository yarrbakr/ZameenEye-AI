import { Router } from "express"
import { spatialCheckController } from "../controllers/spatialCheck.controller"

const router = Router()
router.post("/spatial-check", spatialCheckController)

export default router