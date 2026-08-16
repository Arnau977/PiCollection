import { createHash } from 'crypto'
import { createWriteStream, promises as fs } from 'fs'
import * as tar from 'tar'
import type { PinnedAsset } from './wd14Runtime.assets'

export async function downloadAndVerify(
  asset: PinnedAsset,
  destPath: string,
  onBytes: (downloaded: number) => void
): Promise<void> {
  const res = await fetch(asset.url)
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}): ${asset.url}`)
  }

  const hash = createHash('sha256')
  const fileStream = createWriteStream(destPath)
  const reader = res.body.getReader()
  let downloaded = 0

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      hash.update(value)
      fileStream.write(value)
      downloaded += value.length
      onBytes(downloaded)
    }
    await new Promise<void>((resolve, reject) => {
      fileStream.end((err: NodeJS.ErrnoException | null | undefined) =>
        err ? reject(err) : resolve()
      )
    })
  } catch (err) {
    fileStream.close()
    await fs.rm(destPath, { force: true })
    throw err
  }

  const actual = hash.digest('hex')
  if (actual !== asset.sha256) {
    await fs.rm(destPath, { force: true })
    throw new Error(`Checksum mismatch for ${asset.url} (expected ${asset.sha256}, got ${actual})`)
  }
}

export async function extractTarGz(tarballPath: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true })
  await tar.x({ file: tarballPath, cwd: destDir })
}
