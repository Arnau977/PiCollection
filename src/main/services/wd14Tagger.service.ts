import { spawn, type ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { createInterface } from 'readline'
import { app } from 'electron'
import { join } from 'path'
import { getModelFilePaths, getPythonExecutablePath } from './wd14Runtime.service'

const REQUEST_TIMEOUT_MS = 30_000

export interface Wd14Tag {
  name: string
  score: number
}

interface PendingRequest {
  resolve: (tags: Wd14Tag[]) => void
  reject: (err: Error) => void
  timeout: NodeJS.Timeout
}

interface ScriptResponse {
  id: string
  tags?: Wd14Tag[]
  error?: string
}

let child: ChildProcess | null = null
const pending = new Map<string, PendingRequest>()

function getScriptPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'wd14_predict.py')
    : join(__dirname, '../../resources/wd14_predict.py')
}

function rejectAllPending(message: string): void {
  for (const [id, request] of pending) {
    clearTimeout(request.timeout)
    request.reject(new Error(message))
    pending.delete(id)
  }
}

function ensureProcess(): ChildProcess {
  if (child) return child

  const { model, tags } = getModelFilePaths()
  const proc = spawn(getPythonExecutablePath(), [getScriptPath(), model, tags])

  if (proc.stdout) {
    createInterface({ input: proc.stdout }).on('line', (line) => {
      let response: ScriptResponse
      try {
        response = JSON.parse(line)
      } catch {
        return
      }
      const request = pending.get(response.id)
      if (!request) return
      pending.delete(response.id)
      clearTimeout(request.timeout)
      if (response.error) request.reject(new Error(response.error))
      else request.resolve(response.tags ?? [])
    })
  }

  proc.on('exit', () => {
    child = null
    rejectAllPending('WD14 tagger process exited unexpectedly.')
  })

  child = proc
  return proc
}

export function suggestTags(imagePath: string): Promise<Wd14Tag[]> {
  const proc = ensureProcess()
  const id = randomUUID()

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id)
      reject(new Error('WD14 tagging timed out.'))
    }, REQUEST_TIMEOUT_MS)

    pending.set(id, { resolve, reject, timeout })
    proc.stdin?.write(JSON.stringify({ id, path: imagePath }) + '\n')
  })
}

/** Test-only: kills the cached subprocess reference so tests don't leak state between files. */
export function stopWd14Tagger(): void {
  if (child) {
    child.removeAllListeners()
    child.kill()
  }
  child = null
  rejectAllPending('WD14 tagger stopped.')
}
