import { app } from 'electron'
import { spawn } from 'child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import type { Wd14RuntimeEvent, Wd14RuntimeStatus } from '@shared/models'
import {
  getModelAssets,
  getPlatformAssets,
  PACKAGE_VERSIONS,
  type PinnedAsset
} from './wd14Runtime.assets'
import { downloadAndVerify, extractTarGz } from './wd14Runtime.download'

function runtimeDir(): string {
  return join(app.getPath('userData'), 'wd14-runtime')
}

function markerPath(): string {
  return join(runtimeDir(), 'runtime.json')
}

function pythonDir(): string {
  return join(runtimeDir(), 'python')
}

export function getPythonExecutablePath(): string {
  return process.platform === 'win32'
    ? join(pythonDir(), 'python', 'python.exe')
    : join(pythonDir(), 'python', 'bin', 'python3')
}

/** Paths to the downloaded model/tags files, for `wd14Tagger.service.ts` to spawn against. */
export function getModelFilePaths(): { model: string; tags: string } {
  const dir = runtimeDir()
  return { model: join(dir, 'model.onnx'), tags: join(dir, 'selected_tags.csv') }
}

export function getWd14RuntimeStatus(): Wd14RuntimeStatus {
  return existsSync(markerPath()) ? { state: 'installed' } : { state: 'not-installed' }
}

/**
 * Deliberately not `--no-index`: verified via a real end-to-end dry run
 * that `onnxruntime` pulls in its own transitive dependencies (coloredlogs,
 * flatbuffers, packaging, protobuf, sympy, and *their* transitive deps)
 * that aren't in `wheelDir` - a fully offline install fails outright. Pip
 * is instead allowed to resolve those few small extra packages from the
 * live index, while `--find-links` plus an exact version pin per package
 * (`PACKAGE_VERSIONS`) guarantees the three packages this app actually
 * cares about install as the specific checksum-verified versions just
 * downloaded, not whatever's newest on PyPI.
 */
function runPipInstall(wheelDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      getPythonExecutablePath(),
      [
        '-m',
        'pip',
        'install',
        '--find-links',
        wheelDir,
        `onnxruntime==${PACKAGE_VERSIONS.onnxruntime}`,
        `numpy==${PACKAGE_VERSIONS.numpy}`,
        `pillow==${PACKAGE_VERSIONS.pillow}`
      ],
      { stdio: 'ignore' }
    )
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`pip install failed (exit code ${code})`))
    })
  })
}

export async function installWd14Runtime(
  onEvent: (event: Wd14RuntimeEvent) => void
): Promise<void> {
  const platformAssets = getPlatformAssets()
  if (!platformAssets) {
    const message = `No pinned WD14 runtime assets for ${process.platform}-${process.arch}.`
    onEvent({ type: 'error', message })
    throw new Error(message)
  }
  const modelAssets = getModelAssets()

  const dir = runtimeDir()
  mkdirSync(dir, { recursive: true })
  const wheelDir = join(dir, 'wheels')
  mkdirSync(wheelDir, { recursive: true })

  // Wheel filenames must stay pip-compliant (name-version-pytag-abitag-platform.whl)
  // for `--find-links` to recognize them - verified via a real dry run that a
  // renamed-to-generic .whl file is silently invisible to pip's directory scan.
  const downloads: { asset: PinnedAsset; dest: string; step: 'python' | 'packages' | 'model' }[] = [
    { asset: platformAssets.python, dest: join(dir, 'python.tar.gz'), step: 'python' },
    {
      asset: platformAssets.onnxruntime,
      dest: join(wheelDir, basename(platformAssets.onnxruntime.url)),
      step: 'packages'
    },
    {
      asset: platformAssets.numpy,
      dest: join(wheelDir, basename(platformAssets.numpy.url)),
      step: 'packages'
    },
    {
      asset: platformAssets.pillow,
      dest: join(wheelDir, basename(platformAssets.pillow.url)),
      step: 'packages'
    },
    { asset: modelAssets.model, dest: getModelFilePaths().model, step: 'model' },
    { asset: modelAssets.tags, dest: getModelFilePaths().tags, step: 'model' }
  ]
  const totalBytes = downloads.reduce((sum, d) => sum + d.asset.size, 0)
  const completedPerDownload = new Array(downloads.length).fill(0)

  function reportProgress(
    index: number,
    downloaded: number,
    step: 'python' | 'packages' | 'model'
  ): void {
    completedPerDownload[index] = downloaded
    const sum = completedPerDownload.reduce((a, b) => a + b, 0)
    onEvent({
      type: 'progress',
      step,
      percent: Math.min(100, Math.round((sum / totalBytes) * 100))
    })
  }

  try {
    for (let i = 0; i < downloads.length; i++) {
      const { asset, dest, step } = downloads[i]
      await downloadAndVerify(asset, dest, (downloaded) => reportProgress(i, downloaded, step))
    }

    await extractTarGz(join(dir, 'python.tar.gz'), pythonDir())
    await runPipInstall(wheelDir)

    writeFileSync(
      markerPath(),
      JSON.stringify({
        installedAt: Date.now(),
        pythonVersion: '3.12.13',
        onnxruntimeVersion: PACKAGE_VERSIONS.onnxruntime,
        numpyVersion: PACKAGE_VERSIONS.numpy,
        pillowVersion: PACKAGE_VERSIONS.pillow,
        modelRepo: 'SmilingWolf/wd-vit-tagger-v3'
      })
    )
    onEvent({ type: 'installed' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    onEvent({ type: 'error', message })
    throw err
  }
}

export async function removeWd14Runtime(): Promise<void> {
  rmSync(runtimeDir(), { recursive: true, force: true })
}
