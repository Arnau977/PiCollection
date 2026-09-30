import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import { extname } from 'path'

/**
 * Whether "Copy image" should put the file itself on the clipboard: every
 * GIF, and a WebP whose VP8X header has the animation flag. The OS image
 * clipboard formats are still images, so apps that paste an animation
 * (Discord, Telegram, browsers) only get one as a file.
 */
export async function isAnimatedImage(filePath: string): Promise<boolean> {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.gif') return true
  if (extension !== '.webp') return false

  const handle = await fs.open(filePath, 'r')
  try {
    const header = Buffer.alloc(21)
    await handle.read(header, 0, header.length, 0)
    // RIFF....WEBPVP8X, then 4 bytes of chunk size and the flags byte.
    return header.toString('ascii', 12, 16) === 'VP8X' && (header[20] & 0x02) !== 0
  } finally {
    await handle.close()
  }
}

// Puts the file on the clipboard as a file (what Explorer's Ctrl+C does) plus
// its first frame as a bitmap, so image-only apps like Paint still paste
// something. Electron's clipboard API can't write a file list, hence .NET.
// WIC decodes the frame (GIF, and WebP via Windows' codec); without it, the
// file alone still goes on the clipboard.
const WINDOWS_SCRIPT = `
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing, PresentationCore
$path = $env:PICOLLECTION_CLIPBOARD_FILE
$data = New-Object System.Windows.Forms.DataObject
$files = New-Object System.Collections.Specialized.StringCollection
[void]$files.Add($path)
$data.SetFileDropList($files)
try {
  $decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create([Uri]$path, 'None', 'Default')
  $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $encoder.Frames.Add($decoder.Frames[0])
  $stream = New-Object System.IO.MemoryStream
  $encoder.Save($stream)
  $data.SetImage([System.Drawing.Image]::FromStream($stream))
} catch {}
[System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
`

/** Windows only; rejects if PowerShell fails, so the caller can fall back. */
export function copyFileToClipboard(filePath: string): Promise<void> {
  const encoded = Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64')
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded],
      {
        // The path goes through the environment, never into the script text.
        env: { ...process.env, PICOLLECTION_CLIPBOARD_FILE: filePath },
        windowsHide: true,
        timeout: 15_000
      },
      (error) => (error ? reject(error) : resolve())
    )
  })
}
