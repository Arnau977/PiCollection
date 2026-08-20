/**
 * Serializes calls through a single queue and enforces a minimum gap between
 * when each one actually runs - not just "don't overlap" but "don't run
 * sooner than minIntervalMs after the previous one started". Used to keep
 * every outbound call to a given external API under that API's own
 * recommended sustained rate, regardless of how many features in the app
 * might want to call it around the same time (e.g. Danbooru's tag-wiki
 * lookup, tag autocomplete, and SauceNAO's Danbooru follow-up all share one
 * limiter instance - see danbooruHttp.ts). Calls are queued, never dropped:
 * a caller's promise always eventually resolves/rejects with its own
 * function's result, just later than it was requested.
 */
export function createRateLimiter(minIntervalMs: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve()
  let lastRunAt = -Infinity

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    const scheduled = queue.then(async () => {
      const wait = Math.max(0, lastRunAt + minIntervalMs - Date.now())
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      lastRunAt = Date.now()
      return fn()
    })
    // A rejected call must not permanently jam the queue for later callers.
    queue = scheduled.then(
      () => undefined,
      () => undefined
    )
    return scheduled
  }
}
