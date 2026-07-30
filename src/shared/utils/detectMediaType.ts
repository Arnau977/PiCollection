export function detectMediaType(file: { type: string; name: string }): 'image' | 'video' | 'gif' {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) return 'gif'
  return 'image'
}
