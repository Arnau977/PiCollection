/**
 * electron-updater's own error messages are internal diagnostics - full
 * HTTP headers, stack traces, local file paths - never meant for an end
 * user (see the 404 dumped straight into Settings when the v1.4.0 release
 * was still an unpublished GitHub draft). The raw message should still be
 * logged for troubleshooting (see autoUpdater.ts), but the renderer only
 * ever sees one of these short, human messages.
 */
export function describeUpdaterError(message: string): string {
  if (/\b404\b/.test(message)) {
    return "Could not find this update's files - the release may not be fully published yet."
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::ERR_/.test(message)) {
    return 'Could not reach GitHub. Check your internet connection.'
  }
  return 'Update check failed. Try again later.'
}
