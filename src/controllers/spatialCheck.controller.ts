import { Request, Response } from "express"
import { checkLandIntersection } from "../services/spatialCheck.service"

export const spatialCheckController = async (req: Request, res: Response) => {
    const { landId } = req.body

    if (!landId) {
        return res.status(400).json({ error: "landId is required" })
    }

    try {
        const result = await checkLandIntersection(landId)
        return res.status(200).json(result)
    } catch (err: any) {
        return res.status(500).json({ error: err.message })
    }
}