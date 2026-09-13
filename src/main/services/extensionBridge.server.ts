import { timingSafeEqual } from 'crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import type { ExtensionBridgeStatus } from '@shared/models'
import { AppError } from '../errors'
import { logError } from '../logging/logger'
import {
  ensureExtensionBridgeToken,
  readExtensionBridgeSettings,
  regenerateExtensionBridgeToken,
  writeExtensionBridgeSettings
} from './extensionBridgeSettings'
import {
  extensionBridgeService,
  ExtensionBridgeCaptureInputSchema,
  type ExtensionBridgeLookupType
} from './extensionBridge.service'

/** Maps AppError codes the capture/lookup path can throw to HTTP statuses; an unmapped code is a 500. */
const ERROR_STATUS: Record<string, number> = {
  NO_SOURCE_FOLDER: 409,
  DUPLICATE_MEDIA: 409,
  PAYLOAD_TOO_LARGE: 413
}

let currentServer: Server | null = null

// 256 MB is generous for any real video capture over base64. Exposed as a
// mutable `let` (with a test-only setter below) so tests can exercise the
// 413 path without actually sending a quarter-gigabyte body over HTTP.
let maxBodyBytes = 256 * 1024 * 1024

/** Test-only: temporarily override the request body size cap. */
export function setMaxBodyBytesForTesting(bytes: number): void {
  maxBodyBytes = bytes
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    let bytes = 0
    let rejected = false
    req.on('data', (chunk) => {
      // Once over the cap, stop retaining further chunks (the memory-safety
      // goal) but keep draining the stream instead of req.destroy()'ing it -
      // destroying the request tears down the underlying socket immediately,
      // which drops the connection before the 413 response below can be
      // written back, so the client sees a raw socket error instead of a
      // clean HTTP error.
      if (rejected) return
      bytes += chunk.length
      if (bytes > maxBodyBytes) {
        rejected = true
        reject(new AppError('PAYLOAD_TOO_LARGE', 'Request body too large'))
        return
      }
      data += chunk
    })
    req.on('end', () => {
      if (!rejected) resolve(data)
    })
    req.on('error', reject)
  })
}

function isAuthorized(req: IncomingMessage, token: string): boolean {
  if (!token) return false
  const header = req.headers['authorization']
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  const provided = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(token)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

function isLookupType(value: string | null): value is ExtensionBridgeLookupType {
  return value === 'artist' || value === 'tag' || value === 'series' || value === 'character'
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { token } = readExtensionBridgeSettings()
  if (!isAuthorized(req, token)) {
    sendJson(res, 401, { error: 'Invalid or missing token' })
    return
  }

  const url = new URL(req.url ?? '/', 'http://127.0.0.1')

  try {
    if (req.method === 'GET' && url.pathname === '/lookup') {
      const type = url.searchParams.get('type')
      if (!isLookupType(type)) {
        sendJson(res, 400, { error: 'Invalid lookup type' })
        return
      }
      const matches = await extensionBridgeService.lookup(type, url.searchParams.get('query') ?? '')
      sendJson(res, 200, { matches })
      return
    }

    if (req.method === 'POST' && url.pathname === '/capture') {
      // readBody's own rejections (e.g. PAYLOAD_TOO_LARGE) must propagate to
      // the outer try/catch's AppError handling, not be swallowed here as
      // "Invalid JSON body" - only JSON.parse failures belong to this catch.
      const rawBody = await readBody(req)
      let body: unknown
      try {
        body = JSON.parse(rawBody)
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON body' })
        return
      }
      const parsed = ExtensionBridgeCaptureInputSchema.safeParse(body)
      if (!parsed.success) {
        sendJson(res, 400, { error: parsed.error.message })
        return
      }
      const result = await extensionBridgeService.capture(parsed.data)
      sendJson(res, 200, result)
      return
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (err) {
    if (err instanceof AppError) {
      sendJson(res, ERROR_STATUS[err.code] ?? 500, { error: err.message })
      return
    }
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Internal error' })
  }
}

export function isExtensionBridgeRunning(): boolean {
  return currentServer !== null
}

export function startExtensionBridgeServer(options: { port?: number } = {}): Promise<{
  port: number
}> {
  if (currentServer) {
    const address = currentServer.address()
    return Promise.resolve({ port: typeof address === 'object' && address ? address.port : 0 })
  }

  const settings = ensureExtensionBridgeToken()
  const port = options.port ?? settings.port

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      handleRequest(req, res).catch((err) =>
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      )
    })
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject)
      // A later socket-level error with no 'error' handler at all becomes an
      // unhandled event -> uncaughtException -> fatal error dialog in this
      // app (see index.ts). A background feature failing shouldn't be able
      // to crash the whole app, so keep a persistent handler for the rest of
      // this server's life.
      server.on('error', (err) => {
        logError('extensionBridge', 'Extension bridge server error', err)
      })
      currentServer = server
      // Only persist `enabled: true` once the server has actually bound to the
      // port - if listen() fails (e.g. EADDRINUSE), the settings must not claim
      // the bridge is enabled with nothing listening.
      writeExtensionBridgeSettings({ ...readExtensionBridgeSettings(), enabled: true })
      const address = server.address()
      resolve({ port: typeof address === 'object' && address ? address.port : port })
    })
  })
}

export function stopExtensionBridgeServer(): Promise<void> {
  const settings = readExtensionBridgeSettings()
  writeExtensionBridgeSettings({ ...settings, enabled: false })

  if (!currentServer) return Promise.resolve()
  const server = currentServer
  currentServer = null
  return new Promise((resolve) => server.close(() => resolve()))
}

export function getExtensionBridgeStatus(): ExtensionBridgeStatus {
  const settings = readExtensionBridgeSettings()
  return {
    enabled: settings.enabled,
    running: isExtensionBridgeRunning(),
    token: settings.token || null,
    port: settings.port,
    backgroundModeEnabled: settings.backgroundModeEnabled
  }
}

export async function setExtensionBridgeEnabled(enabled: boolean): Promise<ExtensionBridgeStatus> {
  if (enabled) {
    await startExtensionBridgeServer()
  } else {
    await stopExtensionBridgeServer()
  }
  return getExtensionBridgeStatus()
}

export function setExtensionBridgeBackgroundMode(enabled: boolean): ExtensionBridgeStatus {
  const settings = readExtensionBridgeSettings()
  writeExtensionBridgeSettings({ ...settings, backgroundModeEnabled: enabled })
  return getExtensionBridgeStatus()
}

export function regenerateExtensionBridgeTokenAction(): ExtensionBridgeStatus {
  regenerateExtensionBridgeToken()
  return getExtensionBridgeStatus()
}
