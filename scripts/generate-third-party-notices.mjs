// Writes resources/third-party-notices.txt: the license of every production
// dependency installed for this platform, shipped with the app and opened
// from Settings > Advanced. Runs before `dev` and `build`; the output is
// generated, not committed.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
const LICENSE_FILE = /^(licen[cs]e|copying|notice)([.-].*)?$/i

function licenseTexts(dir) {
  return readdirSync(dir)
    .filter((file) => LICENSE_FILE.test(file))
    .sort()
    .map((file) => readFileSync(join(dir, file), 'utf8').trim())
}

// Only packages installed here: a platform's optional binaries (sharp's
// @img/sharp-<os>-<arch>) are present on the build machine for that platform.
const seen = new Set()
const entries = Object.entries(lock.packages)
  .filter(([path, info]) => path.startsWith('node_modules/') && !info.dev)
  .filter(([path]) => existsSync(join(root, path)))
  .map(([path, info]) => ({
    name: path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length),
    version: info.version,
    license: info.license ?? 'see license text',
    dir: join(root, path)
  }))
  .filter(({ name, version }) => !seen.has(`${name}@${version}`) && seen.add(`${name}@${version}`))
  .sort((a, b) => a.name.localeCompare(b.name))

const vipsVersion = readdirSync(join(root, 'node_modules/@img'))
  .map((dir) => join(root, 'node_modules/@img', dir, 'versions.json'))
  .filter(existsSync)
  .map((file) => JSON.parse(readFileSync(file, 'utf8')).vips)
  .find(Boolean)

const header = `PiCollection - third-party notices

PiCollection itself is released under the MIT License (LICENSE in its
source repository, https://github.com/Arnau977/PiCollection).

It includes the open-source software listed below, each under its own
license, reproduced in full after its name.

- Electron and Chromium: their licenses ship next to the executable
  (LICENSE.electron.txt, LICENSES.chromium.html).
- libvips${vipsVersion ? ` ${vipsVersion}` : ''} (bundled with sharp in @img/sharp-*) is licensed under the
  GNU LGPL-3.0-or-later. It is loaded as a separate library from the app's
  resources/app.asar.unpacked folder, where it can be replaced. Its source
  code is available at https://github.com/libvips/libvips${vipsVersion ? `/releases/tag/v${vipsVersion}` : ''}.
- Downloaded on request, not included: the local AI tagger's Python runtime
  and WD14 model, each under its own license (see the README).
`

const body = entries
  .map(({ name, version, license, dir }) => {
    const texts = licenseTexts(dir)
    return [
      '='.repeat(78),
      `${name} ${version}`,
      `License: ${license}`,
      '-'.repeat(78),
      texts.length ? texts.join('\n\n') : '(No license file in the package; see its license field above.)'
    ].join('\n')
  })
  .join('\n\n')

writeFileSync(join(root, 'resources', 'third-party-notices.txt'), `${header}\n${body}\n`)
console.log(`third-party-notices.txt: ${entries.length} packages`)
