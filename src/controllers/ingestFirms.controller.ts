import { Request, Response } from "express"
import { ingestFirmsRecords } from "../services/ingestFirms.service"

// Receives a batch of raw FIRMS records (from Thammnah's firms_fetch.py push,
// or manual testing via Postman) and hands them off to the service layer,
// which does the actual normalization and database insertion.
export const ingestFirmsController = async (req: Request, res: Response) => {
    const { records } = req.body

    // Basic shape validation before touching the database at all.
    // Rejects empty/missing/non-array payloads early with a clear error,
    // rather than letting a confusing failure happen deeper in the service.
    if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: "records must be a non-empty array" })
    }

    try {
        // Delegates to the service, which returns a summary of what happened
        // (inserted/skipped/total) rather than a bare success, so partial
        // failures within a batch are visible to whoever called this endpoint.
        const result = await ingestFirmsRecords(records)
        return res.status(200).json(result)
    } catch (err: any) {
        // Catches anything unexpected (e.g. a DB connection issue), not
        // per-record failures, those are already handled inside the service.
        return res.status(500).json({ error: err.message })
    }
}