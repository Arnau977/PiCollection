export function deriveMediaName(fileName: string): string {
  const withoutPath = fileName.split(/[/\\]/).pop() ?? fileName
  const lastDot = withoutPath.lastIndexOf('.')
  if (lastDot <= 0) return withoutPath
  return withoutPath.slice(0, lastDot)
}
