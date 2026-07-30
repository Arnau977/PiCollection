import { protocol } from 'electron'
import { createReadStream, promises as fs } from 'fs'
import { extname } from 'path'
import { Readable } from 'stream'
import { resolveThumbnail } from './thumbnails/thumbnails'
import { canFallBackToOriginal } from './thumbnails/thumbnailCache'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime'
}

export function registerMediaProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false
      }
    }
  ])
}

function resolveFilePathFromUrl(requestUrl: string): string {
  const url = new URL(requestUrl)
  let filePath = decodeURIComponent(url.pathname)
  if (/^\/[A-Za-z]:[\\/]/.test(filePath)) {
    filePath = filePath.slice(1)
  }
  return filePath
}

function mimeTypeFor(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

async function serveFile(filePath: string, range: string | null): Promise<Response> {
  const mimeType = mimeTypeFor(filePath)

  let stat
  try {
    stat = await fs.stat(filePath)
  } catch {
    return new Response('Not found', { status: 404 })
  }

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range)
    const start = match ? parseInt(match[1], 10) : 0
    const end = match?.[2] ? parseInt(match[2], 10) : stat.size - 1
    const chunkSize = end - start + 1

    const stream = createReadStream(filePath, { start, end })
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': mimeType
      }
    })
  }

  const stream = createReadStream(filePath)
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Length': String(stat.size),
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes'
    }
  })
}

export function registerMediaProtocolHandler(): void {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    const filePath = resolveFilePathFromUrl(request.url)

    if (url.hostname === 'thumb') {
      const thumbnailPath = await resolveThumbnail(filePath)
      if (thumbnailPath) return serveFile(thumbnailPath, null)

      // No thumbnail available: images can still be scaled down by the browser,
      // but a video would just stall an <img>, so report it as missing instead.
      return canFallBackToOriginal(extname(filePath))
        ? serveFile(filePath, request.headers.get('range'))
        : new Response('No thumbnail', { status: 404 })
    }

    if (url.hostname !== 'media') {
      return new Response('Not found', { status: 404 })
    }

    return serveFile(filePath, request.headers.get('range'))
  })
}
