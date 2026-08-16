import { readFile, rename, writeFile } from 'fs/promises'
import { logError } from '../../logging/logger'

const LANG_EN_US = 1033
const CODEPAGE_UNICODE = 1200

/**
 * The downloaded python.exe carries python-build-standalone's own version
 * metadata ("Python" / "Python Software Foundation") - Windows Task Manager
 * reads that straight out of the exe's VERSION_INFO resource for its Name/
 * Publisher columns, with no relation to which process spawned it. Left
 * alone, a user who doesn't know this app runs a bundled Python subprocess
 * sees an unrelated "Python" entry and reasonably assumes something
 * unwanted installed itself. Rewriting just those string fields (not the
 * icon or any code) fixes that without needing a native rcedit-style tool -
 * resedit/pe-library are pure JS, so nothing extra needs unpacking from
 * asar or shipping as a platform binary.
 *
 * Best-effort and silent: nothing about the actual tagging feature depends
 * on this succeeding, so a parse/write failure here must never surface to
 * the user or block the install.
 */
export async function brandWindowsExecutable(exePath: string): Promise<void> {
  if (process.platform !== 'win32') return

  try {
    // pe-library/resedit ship ESM-only, while electron-vite bundles the main
    // process as CJS - a static import fails at load time with
    // ERR_REQUIRE_ESM (it would crash the whole app on startup, not just
    // this best-effort feature), so pull them in via dynamic import instead.
    const [{ NtExecutable, NtExecutableResource }, { Resource }] = await Promise.all([
      import('pe-library'),
      import('resedit')
    ])

    const data = await readFile(exePath)
    const exe = NtExecutable.from(data)
    const res = NtExecutableResource.from(exe)

    const versionInfoList = Resource.VersionInfo.fromEntries(res.entries)
    for (const versionInfo of versionInfoList) {
      versionInfo.setStringValues(
        { lang: LANG_EN_US, codepage: CODEPAGE_UNICODE },
        {
          FileDescription: 'PiCollection Local Tagger',
          ProductName: 'PiCollection',
          CompanyName: 'Arnau977',
          InternalName: 'picollection-tagger',
          OriginalFilename: 'picollection-tagger.exe'
        }
      )
      versionInfo.outputToResourceEntries(res.entries)
    }

    res.outputResource(exe)
    const rebranded = Buffer.from(exe.generate())

    // Written to a sibling file and swapped in via rename rather than
    // overwritten in place - resedit's own docs advise against writing back
    // over the source file directly, and this also means a crash mid-write
    // leaves the original python.exe untouched instead of a half-written one.
    const tmpPath = `${exePath}.branding-tmp`
    await writeFile(tmpPath, rebranded)
    await rename(tmpPath, exePath)
  } catch (err) {
    // Cosmetic only - see the doc comment above. Logged (not rethrown) so a
    // future python-build-standalone change that breaks this is at least
    // visible in the logs instead of silently never happening.
    logError('wd14Runtime', 'Failed to rebrand python.exe version info', err)
  }
}
