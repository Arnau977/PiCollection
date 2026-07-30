# Releases & auto-update

PiCollection ships updates through GitHub Releases on this repo
(`Arnau977/PiCollection`), using [`electron-updater`](https://www.electron.build/auto-update)
in the main process and [`electron-builder`](https://www.electron.build/) to
publish installers.

## How it works

- The main process wires up `electron-updater` in
  [`src/main/updater/autoUpdater.ts`](../src/main/updater/autoUpdater.ts). A
  packaged app does a quiet check ~5s after launch (see
  `STARTUP_UPDATE_CHECK_DELAY_MS` in `src/main/index.ts`), and the user can
  trigger one manually from **Settings → Updates**.
- Downloading and installing are always explicit user actions
  (`autoDownload = false`) - a check only reports that an update exists; the
  user clicks "Download update", then "Restart and install" once it's ready.
- Update state (checking/available/downloading/downloaded/error) flows from
  main to renderer as `UpdaterEvent`s over the `updater:event` IPC channel
  (see `src/shared/models/Updater.ts`), consumed by the
  `useAppUpdater` hook (`src/renderer/src/hooks/useAppUpdater.ts`).
- The channel choice (`stable`/`beta`) is persisted to
  `updater-settings.json` in Electron's `userData` directory
  (`src/main/updater/updaterSettings.ts`) - it's read by the main process
  directly, not passed from the renderer on every check, so it survives
  restarts and applies even to the automatic startup check.

## Channels

- **stable** reads `latest.yml`/`latest-mac.yml`/`latest-linux.yml` from the
  newest non-prerelease GitHub Release.
- **beta** additionally reads `beta.yml` and allows prerelease versions
  (`autoUpdater.allowPrerelease = true`).

electron-builder derives which manifest a build belongs to from the
package's semver **at build time** - no separate config per channel:

| `package.json` version | Tag to push | GitHub Release | Channel(s) that see it |
|---|---|---|---|
| `1.2.0` | `v1.2.0` | normal release | stable, beta |
| `1.2.0-beta.1` | `v1.2.0-beta.1` | prerelease | beta only |

## Cutting a release

1. Bump the version and commit:
   - Stable: `npm version 1.2.0`
   - Beta: `npm version 1.2.0-beta.1`
2. Push the tag: `git push --follow-tags`
3. `.github/workflows/release.yml` builds Windows/macOS/Linux installers in
   parallel and publishes them to a GitHub Release matching the tag,
   authenticated with the workflow's default `GITHUB_TOKEN`
   (`permissions: contents: write`) - no extra secret to configure.

macOS builds are unsigned (`notarize: false` in `electron-builder.yml`), so
until code signing is set up, macOS users need to right-click → Open the
first time (Gatekeeper) to bypass the "unidentified developer" warning.

## Testing locally

`checkForUpdates()` is a no-op error in `npm run dev` (`app.isPackaged` is
`false`), since there's no packaged `app-update.yml` to read. To exercise the
full flow, build and install a packaged version
(`npm run build:win`/`build:mac`/`build:linux`) from a lower version number
than what's published on GitHub.
