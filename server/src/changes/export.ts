import archiver from 'archiver'
import { PassThrough } from 'stream'
import type { Session } from '../types'

export async function generateZip(session: Session): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const passThrough = new PassThrough()
    const chunks: Buffer[] = []

    passThrough.on('data', (chunk: Buffer) => chunks.push(chunk))
    passThrough.on('end', () => resolve(Buffer.concat(chunks)))
    passThrough.on('error', reject)

    archive.pipe(passThrough)
    archive.on('error', reject)

    for (const change of session.changes) {
      for (const file of change.files) {
        // Strip leading slash if present so archive paths are relative
        const archivePath = file.path.replace(/^\//, '')
        archive.append(file.content, { name: archivePath })
      }
    }

    void archive.finalize()
  })
}
