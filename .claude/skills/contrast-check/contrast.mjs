#!/usr/bin/env node
// WCAG 2.x contrast for PiCollection's CSS tokens - the same relative-luminance
// formula Adobe's Color Contrast Analyzer uses, applied straight to base.css.
//
// Usage:
//   node .claude/skills/contrast-check/contrast.mjs                      # common pairs
//   node .claude/skills/contrast-check/contrast.mjs text-muted:surface accent-fg:#1e1f26
// A side is a token name (with or without "--"/"color-") or a literal color.
// Translucent colors are composited over the background (and a translucent
// background over --color-background), as a browser would render them.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../../../src/renderer/src/assets/base.css'), 'utf8')

const tokens = {}
for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
  for (const [, name, value] of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) tokens[name] = value.trim()
}

function lookup(name) {
  const bare = name.replace(/^--/, '')
  for (const key of [bare, `color-${bare}`]) if (key in tokens) return tokens[key]
  return null
}

function resolveValue(value, depth = 0) {
  if (depth > 20) throw new Error(`var() cycle at ${value}`)
  const m = value.match(/^var\(--([\w-]+)(?:\s*,\s*(.+))?\)$/)
  if (!m) return value
  const next = tokens[m[1]] ?? m[2]
  if (next == null) throw new Error(`unknown token --${m[1]}`)
  return resolveValue(next.trim(), depth + 1)
}

function parseColor(input) {
  const raw = input.startsWith('#') || input.startsWith('rgb') ? input : lookup(input)
  if (raw == null) throw new Error(`unknown color or token "${input}"`)
  const v = resolveValue(raw)
  let m = v.match(/^#([0-9a-f]{3,8})$/i)
  if (m) {
    let h = m[1]
    if (h.length <= 4) h = [...h].map((c) => c + c).join('')
    const n = (i) => parseInt(h.slice(i, i + 2), 16)
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 }
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i)
  if (m) {
    const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return { r: +m[1], g: +m[2], b: +m[3], a }
  }
  throw new Error(`can't parse "${v}" (from ${input})`)
}

const over = (top, bottom) => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1
})

function luminance({ r, g, b }) {
  const ch = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

export function contrast(fgName, bgName) {
  const page = parseColor('background')
  let bg = parseColor(bgName)
  if (bg.a < 1) bg = over(bg, page)
  let fg = parseColor(fgName)
  if (fg.a < 1) fg = over(fg, bg)
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

const DEFAULT_PAIRS = [
  'text:background', 'text:surface', 'text-muted:background', 'text-muted:surface',
  'text-muted:surface-hover', 'text-faint:surface', 'accent-fg:background', 'accent-fg:surface',
  'accent-fg:surface-hover', 'accent-text:accent', 'accent-text:accent-hover',
  'field-text-color:field-background', 'danger:surface', 'success:surface', 'info:surface'
]

const pairs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PAIRS
let failures = 0
for (const pair of pairs) {
  const [fg, bg] = pair.split(':')
  try {
    const ratio = contrast(fg, bg)
    const verdict = ratio >= 4.5 ? 'AA text' : ratio >= 3 ? 'large text/UI only' : 'FAIL'
    if (ratio < 4.5) failures++
    console.log(`${ratio.toFixed(2).padStart(6)}:1  ${verdict.padEnd(18)} ${fg} on ${bg}`)
  } catch (e) {
    failures++
    console.log(`   error  ${pair}: ${e.message}`)
  }
}
process.exitCode = failures ? 1 : 0
