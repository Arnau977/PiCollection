import { describe, expect, it } from 'vitest'
import { fromAliasLines, toAliasLines } from './aliasLines'

describe('alias lines', () => {
  it('round-trips one alias per line, keeping commas inside a title', () => {
    const aliases = ['Ijiranaide, Nagatoro-san', 'Nagatoro']
    expect(fromAliasLines(toAliasLines(aliases))).toEqual(aliases)
  })

  it('trims lines and drops blank ones, CRLF included', () => {
    expect(fromAliasLines('  a \r\n\r\n b\n')).toEqual(['a', 'b'])
  })
})
