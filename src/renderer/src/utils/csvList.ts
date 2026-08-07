export function toCsv(values: string[]): string {
  return values.join(', ')
}

export function fromCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}
