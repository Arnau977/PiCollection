export function installErrorReporting(): void {
  window.addEventListener('error', (event) => {
    try {
      window.api?.logging?.reportRendererError(event.message, event.error?.stack)?.catch(() => {})
    } catch {
      // The error reporter must never throw.
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason
      const message = reason instanceof Error ? reason.message : String(reason)
      const stack = reason instanceof Error ? reason.stack : undefined
      window.api?.logging?.reportRendererError(message, stack)?.catch(() => {})
    } catch {
      // The error reporter must never throw.
    }
  })
}
