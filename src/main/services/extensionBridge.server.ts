import { timingSafeEqual } from 'crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import type { ExtensionBridgeStatus } from '@shared/models'
import { AppError } from '../errors'
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
  DUPLICATE_MEDIA: 409
}

let currentServer: Server | null = null

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function isAuthorized(req: IncomingMessage, token: string): boolean {
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
      let body: unknown
      try {
        body = JSON.parse(await readBody(req))
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
