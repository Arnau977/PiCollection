/**
 * A service can throw this to control the exact `code`/`message` an IPC
 * caller sees (via ipc/helpers.ts's ipcHandler), bypassing the generic
 * SQLite-message sniffing used for plain unique-constraint violations - see
 * mediaService.addMedia's exact-duplicate check for an example.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}
