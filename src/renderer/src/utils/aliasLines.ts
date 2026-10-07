/** Aliases are edited one per line, so a title with a comma stays whole. */
export function toAliasLines(aliases: string[]): string {
  return aliases.join('\n')
}

export function fromAliasLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}
