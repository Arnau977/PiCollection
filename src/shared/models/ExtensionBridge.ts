export interface ExtensionBridgeStatus {
  enabled: boolean
  /** Whether the HTTP server is actually listening right now (may lag `enabled` by a tick during start/stop). */
  running: boolean
  token: string | null
  port: number
  backgroundModeEnabled: boolean
}
