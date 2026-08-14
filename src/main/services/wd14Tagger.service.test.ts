import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.fn()
const getPythonExecutablePath = vi.fn()
const getModelFilePaths = vi.fn()
// Identity by default - most tests care about the subprocess plumbing, not
// thumbnail resolution, so they should see the exact path they passed in.
const resolveThumbnailMock = vi.fn(
  (path: string): Promise<string | null> => Promise.resolve(path)
)

vi.mock('child_process', () => ({ spawn: (...args: unknown[]) => spawnMock(...args) }))
vi.mock('./wd14Runtime.service', () => ({
  getPythonExecutablePath: () => getPythonExecutablePath(),
  getModelFilePaths: () => getModelFilePaths()
}))
vi.mock('../thumbnails/thumbnails', () => ({
  resolveThumbnail: (path: string) => resolveThumbnailMock(path)
}))
vi.mock('electron', () => ({ app: { isPackaged: false } }))

const { suggestTags, stopWd14Tagger } = await import('./wd14Tagger.service')

class FakeProcess extends EventEmitter {
  stdin = { write: vi.fn() }
  stdout = new PassThrough()
  kill = vi.fn()
}

let fakeProcess: FakeProcess

function respond(payload: unknown): void {
  fakeProcess.stdout.write(JSON.stringify(payload) + '\n')
}

/** `suggestTags` now awaits `resolveThumbnail` before ever touching the
 *  subprocess, so a synchronous check right after calling it needs to yield
 *  a microtask tick first - even though the mock resolves "immediately",
 *  `await` on an already-resolved promise still defers to the next tick. */
async function flush(): Promise<void> {
  await Promise.resolve()
}

beforeEach(() => {
  getPythonExecutablePath.mockReturnValue('/fake/python')
  getModelFilePaths.mockReturnValue({ model: '/fake/model.onnx', tags: '/fake/tags.csv' })
  fakeProcess = new FakeProcess()
  spawnMock.mockReset().mockReturnValue(fakeProcess)
  resolveThumbnailMock.mockReset().mockImplementation((path: string) => Promise.resolve(path))
  stopWd14Tagger()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('suggestTags', () => {
  it('spawns the python script only on the first call, reusing it after', async () => {
    const first = suggestTags('/img/a.png')
    await flush()
    // Real id is a uuid we don't control - inspect what was written instead.
    const written = JSON.parse(fakeProcess.stdin.write.mock.calls[0][0] as string)
    respond({ id: written.id, tags: [{ name: 'cat', score: 0.9 }] })
    await first

    // Left pending on purpose (never responded to) - only spawn reuse is asserted here.
    suggestTags('/img/b.png').catch(() => {})

    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(spawnMock).toHaveBeenCalledWith('/fake/python', [
      expect.stringContaining('wd14_predict.py'),
      '/fake/model.onnx',
      '/fake/tags.csv'
    ])
  })

  it('resolves with the tags from the matching response id', async () => {
    const promise = suggestTags('/img/a.png')
    await flush()
    const written = JSON.parse(fakeProcess.stdin.write.mock.calls[0][0] as string)
    expect(written.path).toBe('/img/a.png')

    respond({ id: written.id, tags: [{ name: 'cat ears', score: 0.87 }] })

    await expect(promise).resolves.toEqual([{ name: 'cat ears', score: 0.87 }])
  })

  it('rejects when the script responds with an error for that id', async () => {
    const promise = suggestTags('/img/broken.png')
    await flush()
    const written = JSON.parse(fakeProcess.stdin.write.mock.calls[0][0] as string)

    respond({ id: written.id, error: 'No such file' })

    await expect(promise).rejects.toThrow('No such file')
  })

  it('correlates concurrent requests by id, not arrival order', async () => {
    const first = suggestTags('/img/a.png')
    await flush()
    const idA = JSON.parse(fakeProcess.stdin.write.mock.calls[0][0] as string).id
    const second = suggestTags('/img/b.png')
    await flush()
    const idB = JSON.parse(fakeProcess.stdin.write.mock.calls[1][0] as string).id

    // Respond out of order.
    respond({ id: idB, tags: [{ name: 'b-tag', score: 0.5 }] })
    respond({ id: idA, tags: [{ name: 'a-tag', score: 0.5 }] })

    await expect(first).resolves.toEqual([{ name: 'a-tag', score: 0.5 }])
    await expect(second).resolves.toEqual([{ name: 'b-tag', score: 0.5 }])
  })

  it('rejects with a timeout if no response arrives in time', async () => {
    vi.useFakeTimers()
    const promise = suggestTags('/img/slow.png')
    const assertion = expect(promise).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(31_000)
    await assertion
  })

  it('rejects pending requests and respawns on the next call after an unexpected exit', async () => {
    const promise = suggestTags('/img/a.png')
    // The exit listener is only attached once ensureProcess() actually runs,
    // which happens after the resolveThumbnail await below it - emitting
    // 'exit' before that would fire on no listeners and be silently lost.
    await flush()
    fakeProcess.emit('exit', 1)
    await expect(promise).rejects.toThrow('exited unexpectedly')

    const nextFakeProcess = new FakeProcess()
    spawnMock.mockReturnValue(nextFakeProcess)
    // Left pending on purpose (never responded to) - only spawning again is asserted here.
    suggestTags('/img/b.png').catch(() => {})
    await flush()

    expect(spawnMock).toHaveBeenCalledTimes(2)
  })

  it('ignores a stdout line with an id that matches no pending request', async () => {
    const promise = suggestTags('/img/a.png')
    await flush()
    const written = JSON.parse(fakeProcess.stdin.write.mock.calls[0][0] as string)

    respond({ id: 'unknown-id', tags: [{ name: 'stray', score: 0.5 }] })
    respond({ id: written.id, tags: [{ name: 'real', score: 0.5 }] })

    await expect(promise).resolves.toEqual([{ name: 'real', score: 0.5 }])
  })

  it('runs the model against a resolved thumbnail, not the raw file path', async () => {
    // The gallery's own thumbnail resolver produces a still image for a
    // video route (a poster frame) - the WD14 subprocess can only ever
    // understand that, never the raw .mp4 (see resources/wd14_predict.py's
    // PIL.Image.open, which can't decode video containers at all).
    resolveThumbnailMock.mockResolvedValue('/cache/thumbnails/abc123.png')

    const promise = suggestTags('/vids/clip.mp4')
    await flush()
    const written = JSON.parse(fakeProcess.stdin.write.mock.calls[0][0] as string)
    expect(written.path).toBe('/cache/thumbnails/abc123.png')

    respond({ id: written.id, tags: [{ name: 'tag', score: 0.5 }] })
    await expect(promise).resolves.toEqual([{ name: 'tag', score: 0.5 }])
  })

  it('rejects without spawning the subprocess when no thumbnail could be produced', async () => {
    resolveThumbnailMock.mockResolvedValue(null)

    await expect(suggestTags('/vids/broken.mp4')).rejects.toThrow(
      'Could not read that file to tag.'
    )
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
