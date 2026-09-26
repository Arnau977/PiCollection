#!/usr/bin/env node
// Replaces the "## Highlights" placeholder of a DRAFT GitHub release with a
// Markdown list. Refuses to touch a published release.
//
//   node .claude/skills/cut-release/fill-highlights.mjs v1.7.2 "First change" "Second change" "Third"
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [tag, ...bullets] = process.argv.slice(2)
if (!tag || bullets.length === 0) {
  console.error('usage: fill-highlights.mjs <tag> "<bullet>" ["<bullet>" ...]')
  process.exit(2)
}
const PLACEHOLDER = '_Fill in 2-3 bullet points of user-facing changes before publishing._'
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' })

const release = JSON.parse(gh('release', 'view', tag, '--json', 'isDraft,body'))
if (!release.isDraft) {
  console.error(`${tag} is already published - not editing it. Ask the user first.`)
  process.exit(1)
}
if (!release.body.includes(PLACEHOLDER)) {
  console.error(`${tag} has no Highlights placeholder (already filled?) - nothing changed.`)
  process.exit(1)
}
// The app's update panel renders this section as a list only when it is one.
const list = bullets.map((b) => `- ${b.replace(/^[-*]\s*/, '')}`).join('\n')
const file = join(mkdtempSync(join(tmpdir(), 'release-')), 'notes.md')
writeFileSync(file, release.body.replace(PLACEHOLDER, list))
gh('release', 'edit', tag, '--notes-file', file)
console.log(`${tag}: Highlights filled (${bullets.length} bullets), still a draft.`)
