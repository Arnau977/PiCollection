export interface AutoStartStatus {
  /** False for unpackaged dev runs and on Linux, where no login item can be registered. */
  supported: boolean
  enabled: boolean
}
