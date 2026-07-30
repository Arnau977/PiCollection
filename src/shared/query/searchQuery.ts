/**
 * Parser for the gallery search syntax:
 *
 *   space         AND      `tagA tagB`
 *   OR            OR       `tagA OR tagB`
 *   -             NOT      `-tagA`
 *   ( )           grouping `(a OR b) (-c -d)`
 *   " "           literal  `"two words"`
 *
 * AND binds tighter than OR, so `a OR b c` means `a OR (b AND c)`.
 */

export type QueryNode =
  | { type: 'term'; value: string }
  | { type: 'not'; child: QueryNode }
  | { type: 'and'; children: QueryNode[] }
  | { type: 'or'; children: QueryNode[] }

type Token =
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'or' }
  | { kind: 'not' }
  | { kind: 'term'; value: string }

const DELIMITERS = new Set(['(', ')', '"'])

function isWhitespace(char: string): boolean {
  return /\s/.test(char)
}

export function tokenizeSearchQuery(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const char = input[i]

    if (isWhitespace(char)) {
      i += 1
      continue
    }

    if (char === '(') {
      tokens.push({ kind: 'lparen' })
      i += 1
      continue
    }

    if (char === ')') {
      tokens.push({ kind: 'rparen' })
      i += 1
      continue
    }

    // A dash only negates at the start of a token, so hyphenated words such as
    // `sci-fi` survive intact.
    if (char === '-') {
      tokens.push({ kind: 'not' })
      i += 1
      continue
    }

    if (char === '"') {
      i += 1
      let value = ''
      while (i < input.length && input[i] !== '"') {
        value += input[i]
        i += 1
      }
      i += 1 // closing quote (or end of input for an unterminated quote)
      if (value.trim()) tokens.push({ kind: 'term', value: value.trim() })
      continue
    }

    let word = ''
    while (i < input.length && !isWhitespace(input[i]) && !DELIMITERS.has(input[i])) {
      word += input[i]
      i += 1
    }

    if (word.toUpperCase() === 'OR') tokens.push({ kind: 'or' })
    else if (word) tokens.push({ kind: 'term', value: word })
  }

  return tokens
}

function flatten(type: 'and' | 'or', children: QueryNode[]): QueryNode | null {
  const merged = children.flatMap((child) => (child.type === type ? child.children : [child]))
  if (merged.length === 0) return null
  if (merged.length === 1) return merged[0]
  return { type, children: merged }
}

/**
 * Returns null for input that carries no constraints (empty, whitespace, or
 * stray operators), which callers treat as "no query filter".
 */
export function parseSearchQuery(input: string): QueryNode | null {
  const tokens = tokenizeSearchQuery(input)
  let position = 0

  function peek(): Token | undefined {
    return tokens[position]
  }

  function parsePrimary(): QueryNode | null {
    const token = peek()
    if (!token) return null

    if (token.kind === 'lparen') {
      position += 1
      const inner = parseOr()
      // Tolerate a missing closing paren so half-typed queries still run.
      if (peek()?.kind === 'rparen') position += 1
      return inner
    }

    if (token.kind === 'term') {
      position += 1
      return { type: 'term', value: token.value }
    }

    // Stray operator: skip it rather than failing the whole query.
    position += 1
    return null
  }

  function parseUnary(): QueryNode | null {
    if (peek()?.kind === 'not') {
      position += 1
      const child = parseUnary()
      return child ? { type: 'not', child } : null
    }
    return parsePrimary()
  }

  function parseAnd(): QueryNode | null {
    const children: QueryNode[] = []

    while (position < tokens.length) {
      const token = peek()
      if (!token || token.kind === 'rparen' || token.kind === 'or') break

      const before = position
      const node = parseUnary()
      if (node) children.push(node)
      // Guard against operators that consume nothing, which would spin forever.
      if (position === before) position += 1
    }

    return flatten('and', children)
  }

  function parseOr(): QueryNode | null {
    const children: QueryNode[] = []
    const first = parseAnd()
    if (first) children.push(first)

    while (peek()?.kind === 'or') {
      position += 1
      const next = parseAnd()
      if (next) children.push(next)
    }

    return flatten('or', children)
  }

  const root = parseOr()
  return root
}
