import { promises as fs } from 'fs'
import { basename, extname, join, normalize } from 'path'
import type { Kysely } from 'kysely'
import { getDb } from '../database/connection'
import * as mediaRepo from '../database/repositories/media.repository'
import type { DB } from '../database/schema'
import { AppError } from '../errors'
import { isPathUnderRoot } from './pathPrefix'
import { readSourceFolder, relativizeRoute, resolveRoute } from './sourceFolder'
import type { ExpandedMediaFile, SourceFolderBrowseResult } from '@shared/models'

type MediaType = 'image' | 'video' | 'gif'

// Same extensions media-protocol.ts already serves - anything else is invisible
// to this feature (not listed, not importable).
const MEDIA_EXTENSIONS: Record<string, MediaType> = {
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'gif',
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video'
}

function typeForExtension(fileName: string): MediaType | null {
  return MEDIA_EXTENSIONS[extname(fileName).toLowerCase()] ?? null
}

function requireSourceFolder(): string {
  const sourceFolder = readSourceFolder()
  if (!sourceFolder) throw new AppError('NO_SOURCE_FOLDER', 'No source folder is configured.')
  return sourceFolder
}

/**
 * Resolves `relativePath` against the source folder and guarantees the
 * result never escapes it - `''` resolves to the source folder itself (the
 * root listing), which isPathUnderRoot alone would reject since a directory
 * is never "under" itself.
 */
function resolveWithinSourceFolder(relativePath: string, sourceFolder: string): string {
  const resolved = resolveRoute(relativePath, sourceFolder)
  const normalizedRoot = normalize(sourceFolder)
  if (resolved !== normalizedRoot && !isPathUnderRoot(resolved, sourceFolder)) {
    throw new AppError('INVALID_PATH', 'That path is outside the configured source folder.')
  }
  return resolved
}

interface FileCandidate {
  absolutePath: string
  fileName: string
  type: MediaType
}

async function collectFilesRecursively(absoluteDir: string): Promise<FileCandidate[]> {
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  const results: FileCandidate[] = []
  for (const entry of entries) {
    const absolutePath = join(absoluteDir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await collectFilesRecursively(absolutePath)))
    } else if (entry.isFile()) {
      const type = typeForExtension(entry.name)
      if (type) results.push({ absolutePath, fileName: entry.name, type })
    }
  }
  return results
}

// A single native recursive readdir call, rather than collectFilesRecursively's
// manual per-directory walk - cheap enough to run for every folder tile shown
// in the browser. A failure anywhere in the subtree (e.g. a permission-denied
// nested folder) shouldn't take down the whole browse() listing. Cataloged
// files are excluded - the badge is meant to answer "how much is left to
// import here", not "how much media exists here".
async function countUncatalogedMediaFilesRecursively(
  db: Kysely<DB>,
  absoluteDir: string,
  sourceFolder: string
): Promise<number> {
  try {
    const entries = await fs.readdir(absoluteDir, { recursive: true, withFileTypes: true })
    const mediaEntries = entries.filter(
      (entry) => entry.isFile() && typeForExtension(entry.name) !== null
    )
    const relativeRoutes = mediaEntries.map((entry) =>
      relativizeRoute(join(entry.parentPath, entry.name), sourceFolder)
    )
    const catalogedRoutes = await mediaRepo.routesExist(db, relativeRoutes)
    return relativeRoutes.filter((route) => !catalogedRoutes.has(route)).length
  } catch {
    return 0
  }
}

export const sourceFolderBrowserService = {
  async browse(relativePath: string): Promise<SourceFolderBrowseResult> {
    const sourceFolder = requireSourceFolder()
    const absoluteDir = resolveWithinSourceFolder(relativePath, sourceFolder)
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true })
    const db = getDb()

    const folders = (
      await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const folderAbsolutePath = join(absoluteDir, entry.name)
            return {
              name: entry.name,
              relativePath: relativizeRoute(folderAbsolutePath, sourceFolder),
              fileCount: await countUncatalogedMediaFilesRecursively(
                db,
                folderAbsolutePath,
                sourceFolder
              )
            }
          })
      )
    ).sort((a, b) => a.name.localeCompare(b.name))

    const fileCandidates = entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({ entry, type: typeForExtension(entry.name) }))
      .filter(
        (candidate): candidate is { entry: (typeof entries)[number]; type: MediaType } =>
          candidate.type !== null
      )
    const fileRelativePaths = fileCandidates.map((candidate) =>
      relativizeRoute(join(absoluteDir, candidate.entry.name), sourceFolder)
    )
    const catalogedRoutes = await mediaRepo.routesExist(db, fileRelativePaths)

    const files = fileCandidates
      .map((candidate, index) => ({
        name: candidate.entry.name,
        relativePath: fileRelativePaths[index],
        type: candidate.type,
        cataloged: catalogedRoutes.has(fileRelativePaths[index])
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { folders, files }
  },

  async expandSelection(input: { files: string[]; folders: string[] }): Promise<ExpandedMediaFile[]> {
    const sourceFolder = requireSourceFolder()

    const looseFiles: FileCandidate[] = input.files
      .map((relativePath) => resolveWithinSourceFolder(relativePath, sourceFolder))
      .map((absolutePath) => ({
        absolutePath,
        fileName: basename(absolutePath),
        type: typeForExtension(absolutePath)
      }))
      .filter((candidate): candidate is FileCandidate => candidate.type !== null)

    const folderFileLists = await Promise.all(
      input.folders.map((relativePath) =>
        collectFilesRecursively(resolveWithinSourceFolder(relativePath, sourceFolder))
      )
    )

    // A file could be reachable both directly selected and via a selected
    // ancestor folder - dedupe by absolute path before anything else.
    const uniqueByPath = new Map<string, FileCandidate>()
    for (const candidate of [...looseFiles, ...folderFileLists.flat()]) {
      uniqueByPath.set(candidate.absolutePath, candidate)
    }
    const candidates = [...uniqueByPath.values()]

    const relativeRoutes = candidates.map((candidate) =>
      relativizeRoute(candidate.absolutePath, sourceFolder)
    )
    const catalogedRoutes = await mediaRepo.routesExist(getDb(), relativeRoutes)

    return candidates
      .filter((_, index) => !catalogedRoutes.has(relativeRoutes[index]))
      .map((candidate) => ({
        route: candidate.absolutePath,
        fileName: candidate.fileName,
        type: candidate.type
      }))
  }
}
