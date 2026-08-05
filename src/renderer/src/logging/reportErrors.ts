export function installErrorReporting(): void {
  window.addEventListener('error', (event) => {
    window.api.logging.reportRendererError(event.message, event.error?.stack)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    window.api.logging.reportRendererError(message, stack)
  })
}
