import { app } from 'electron'
import type { AutoStartStatus } from '@shared/models'

/**
 * Passed to the login item so a launch at sign-in can be told apart from one
 * the user started by hand: the former starts hidden in the tray instead of
 * popping a window open on every sign-in.
 */
export const HIDDEN_LAUNCH_ARG = '--hidden'

/**
 * Registering an unpackaged dev run would point the OS at the bare
 * electron.exe (no app path), and Electron has no login-item support on
 * Linux - in both cases the setting is reported as unsupported instead.
 */
function isAutoStartSupported(): boolean {
  return app.isPackaged && process.platform !== 'linux'
}

/**
 * The OS login-item registry is the source of truth (no JSON settings file),
 * so disabling the entry from Task Manager's Startup tab is reflected here.
 * On Windows the entry only matches when queried with the same args it was
 * registered with.
 */
export function getAutoStartStatus(): AutoStartStatus {
  if (!isAutoStartSupported()) return { supported: false, enabled: false }
  const { openAtLogin } = app.getLoginItemSettings({ args: [HIDDEN_LAUNCH_ARG] })
  return { supported: true, enabled: openAtLogin }
}

export function setAutoStart(enabled: boolean): AutoStartStatus {
  if (!isAutoStartSupported()) {
    throw new Error('Starting with the system is not available in this build.')
  }
  app.setLoginItemSettings({ openAtLogin: enabled, args: [HIDDEN_LAUNCH_ARG] })
  return getAutoStartStatus()
}

export function isHiddenLaunch(argv: string[] = process.argv): boolean {
  return argv.includes(HIDDEN_LAUNCH_ARG)
}
