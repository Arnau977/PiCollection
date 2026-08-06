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
3. `.github/workflows/release.yml` first creates a draft release for the tag
   with a title (`PiCollection vX.Y.Z`) and auto-generated notes
   (`gh release create --generate-notes`, listing commits since the last
   tag), then builds Windows/macOS/Linux installers in parallel and uploads
   them to that same release - all authenticated with the workflow's default
   `GITHUB_TOKEN` (`permissions: contents: write`), no extra secret to
   configure. The release is left as a draft so the notes can be reviewed/
   edited before publishing.
4. Before publishing, edit the draft release on GitHub and replace the
   `## Highlights` placeholder with 2-3 bullet points of user-facing
   changes (new features, notable fixes) - this is what
   `extractHighlights()` (`src/shared/utils/extractHighlights.ts`) pulls
   out to show in the app's update dialog. Leaving the placeholder in place
   is safe: the app just won't show a highlights block for that release.
5. One Linux artifact only: AppImage (runs on any distro with no install
   step, and is the one format electron-updater can actually auto-update -
   see `electron-builder.yml`'s `linux.target`).

Neither platform's build is code-signed yet, so both trigger an OS warning
on first run:
- **macOS** (`notarize: false` in `electron-builder.yml`): right-click → Open
  once to bypass the "unidentified developer" Gatekeeper warning.
- **Windows**: unsigned executables from a new publisher get flagged by
  SmartScreen (sometimes reported directly as a "virus") until the binary
  earns enough reputation - there's no config fix for this, only a code
  signing certificate resolves it for good. Click "More info" → "Run anyway"
  to install regardless. [SignPath.io](https://signpath.io) offers free
  signing for approved open-source projects if this is worth setting up
  later.

## Testing locally

`checkForUpdates()` is a no-op error in `npm run dev` (`app.isPackaged` is
`false`), since there's no packaged `app-update.yml` to read. To exercise the
full flow, build and install a packaged version
(`npm run build:win`/`build:mac`/`build:linux`) from a lower version number
than what's published on GitHub.
