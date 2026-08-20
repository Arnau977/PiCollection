# Releases & auto-update

PiCollection ships updates through GitHub Releases on this repo
(`Arnau977/PiCollection`), using [`electron-updater`](https://www.electron.build/auto-update)
in the main process and [`electron-builder`](https://www.electron.build/) to
publish installers.

## How it works

- The main process wires up `electron-updater` in
  [`src/main/updater/autoUpdater.ts`](../src/main/updater/autoUpdater.ts). A
  packaged app does a quiet check ~5s after launch (see
  `STARTUP_UPDATE_CHECK_DELAY_MS` in `src/main/index.ts`), repeats that check
  once a day for sessions left running (`DAILY_UPDATE_CHECK_INTERVAL_MS`),
  and the user can trigger one manually from **Settings → Updates**.
- When an update is available or ready to install, the sidebar shows a small
  badge next to Settings (`src/renderer/src/components/AppHeader.tsx`) so
  it's noticeable without having to visit the Settings page first.
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

- **stable** only ever sees a release once its GitHub "Pre-release" flag has
  been turned off (i.e. it's the repo's current "Latest" release).
- **beta** additionally sees every release GitHub still has flagged as a
  pre-release, in addition to the latest stable one.

Every build publishes the same `latest.yml`/`latest-mac.yml`/`latest-linux.yml`
manifest regardless of channel - there's no separate beta manifest. Which
releases a channel can see is controlled entirely by GitHub's own
`prerelease` flag on each release, not by anything in the version number.
Verified directly against `electron-updater`'s `GitHubProvider`: a
stable-channel client resolves updates via GitHub's `/releases/latest` API
(which only ever returns the newest non-prerelease release), and a
beta-channel client picks the newest release in the feed regardless of its
version format, then falls back to the shared `latest.yml` manifest.

| `package.json` version | Tag to push | Channel(s) that see it |
|---|---|---|
| `1.3.0` (any version) | `v1.3.0` | beta immediately; stable once promoted (see "Cutting a release" below) |

## Cutting a release

1. Bump the version and commit: `npm version 1.3.0` (plain `X.Y.Z`, never a
   `-beta.N` suffix - see below for what the digits mean).
2. Push the tag: `git push --follow-tags`.
3. `.github/workflows/release.yml` creates the release as a GitHub
   **pre-release** by default (safe default - nothing reaches stable-channel
   users by accident), builds Windows/macOS/Linux installers, and uploads
   them to it.
4. Before publishing, edit the draft release on GitHub and replace the
   `## Highlights` placeholder with 2-3 bullet points of user-facing
   changes.
5. Once you've confirmed the build is good (beta users have it automatically,
   since it's now a published pre-release), promote it to stable:
   `gh release edit vX.Y.Z --prerelease=false --latest`. This one command is
   the entire "promote to stable" step - no separate workflow.

### Version numbers

Plain `X.Y.Z`, always - no prerelease suffix, ever. `X` bumps for a major/
breaking change.

- `Z` (patch) bumps for a small release: one or several bug fixes and
  behavior/UX adjustments bundled together, nothing that amounts to a new
  feature or a themed batch of work.
- `Y` (minor) bumps for a bigger release: the culmination of a whole set of
  adjustments and bug fixes, or a significant new feature/implementation.
  Resets `Z` back to `0`.

Whether a given `X.Y.Z` ends up promoted to stable or superseded by another
cut while still in testing is entirely up to the GitHub Release flag in step
5 above, not anything encoded in the number itself - `Z` is not a "beta
counter".

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
