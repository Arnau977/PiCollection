import { spawn, type ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { createInterface } from 'readline'
import { app } from 'electron'
import { join } from 'path'
import type { Wd14TagSuggestion } from '@shared/models'
import { resolveThumbnail } from '../thumbnails/thumbnails'
import { getModelFilePaths, getPythonExecutablePath } from './wd14Runtime/wd14Runtime.service'

const REQUEST_TIMEOUT_MS = 30_000

export type Wd14Tag = Wd14TagSuggestion

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

/**
 * Runs the WD14 model against `imagePath` directly. The subprocess is a
 * plain PIL/onnxruntime pipeline that only ever understands still images -
 * see `suggestTags` below for the piece that makes video/GIF files work too.
 */
function runPrediction(imagePath: string): Promise<Wd14Tag[]> {
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

/**
 * Reuses the exact thumbnail the gallery already generates/caches, which
 * uniformly handles images, video poster frames, and GIF first frames - the
 * same thing `lookupSauceNao` does before uploading to SauceNAO. Without
 * this, a video route reaches `resources/wd14_predict.py`'s
 * `PIL.Image.open()` directly and fails with a raw "cannot identify image
 * file ...mp4" error, since PIL doesn't decode video containers at all.
 */
export async function suggestTags(imagePath: string): Promise<Wd14Tag[]> {
  const thumbPath = await resolveThumbnail(imagePath)
  if (!thumbPath) throw new Error('Could not read that file to tag.')
  return runPrediction(thumbPath)
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
