import { splitRoute } from './splitRoute'

/**
 * A media route's folder as the user knows it: relative to the source folder
 * ("Kaguya-sama\Hayasaka"), or the full folder when the file lives outside
 * it. Routes can already be stored relative to the source folder; those are
 * returned as they are. '' means the source folder itself.
 */
export function relativeFolder(route: string, sourceFolder: string | null): string {
  const { folder } = splitRoute(route)
  if (!sourceFolder) return folder

  const base = sourceFolder.replace(/[\\/]+$/, '')
  // Windows paths are case-insensitive, and either separator may be stored.
  const normalize = (path: string): string => path.replace(/\//g, '\\').toLowerCase()
  if (normalize(folder) === normalize(base)) return ''
  if (normalize(folder).startsWith(`${normalize(base)}\\`)) return folder.slice(base.length + 1)
  return folder
}
