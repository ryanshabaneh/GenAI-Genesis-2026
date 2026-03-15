// server/src/routes/export.ts
// POST /api/export — packages all accepted code changes for a session into a zip
// and streams it back as a binary download.
// Only 'zip' format is supported right now — format param is validated to keep
// the API extensible for future formats (patch, tar) without breaking callers.

import { Router } from 'express'
import type { Request, Response } from 'express'
import { getSession } from '../session/store'
import { generateZip } from '../changes/export'

const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { sessionId, format } = req.body as {
    sessionId?: string
    format?: string
  }

  if (!sessionId || format !== 'zip') {
    res.status(400).json({ error: 'sessionId and format: "zip" are required' })
    return
  }

  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  // Guard: nothing to export yet — avoids generating an empty zip
  if (session.changes.length === 0) {
    res.status(400).json({ error: 'No accepted changes to export' })
    return
  }

  try {
    const buffer = await generateZip(session)
    res.setHeader('Content-Type', 'application/zip')
    // Content-Disposition triggers a browser download with a sensible filename
    res.setHeader('Content-Disposition', 'attachment; filename="shipyard-changes.zip"')
    res.send(buffer)
  } catch (err) {
    console.error('Export error:', err)
    res.status(500).json({ error: 'Export failed' })
  }
})

export default router
