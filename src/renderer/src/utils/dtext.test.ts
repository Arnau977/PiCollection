import { describe, expect, it } from 'vitest'
import { splitDtextPostLinks, stripDtext } from './dtext'

describe('stripDtext', () => {
  it('leaves plain prose untouched', () => {
    expect(stripDtext('A character with cat ears.')).toBe('A character with cat ears.')
  })

  it('strips [b] bold tags without removing their content', () => {
    expect(stripDtext('[b]Do not use[/b] when nude.')).toBe('Do not use when nude.')
  })

  it('replaces [[wiki links]] with their plain name', () => {
    expect(stripDtext('wearing [[underwear]] or [[panties]]')).toBe('wearing underwear or panties')
  })

  it('replaces [[link|display text]] with just the display text', () => {
    expect(stripDtext('see [[no_pants|no pants]] instead')).toBe('see no pants instead')
  })

  it('strips leading h1-h6 header markers at the start of a line', () => {
    expect(stripDtext('intro text\nh5. Rules for usage\n* bullet one')).toBe(
      'intro text\nRules for usage\n* bullet one'
    )
  })

  it('preserves newlines between bulleted lines', () => {
    const raw = '* [b]Do not use[/b] when [[nude]].\n* [b]Do not use[/b] when [[bare legs]].'
    expect(stripDtext(raw)).toBe('* Do not use when nude.\n* Do not use when bare legs.')
  })

  it('strips the "!" marker from post references, keeping the post number readable', () => {
    expect(stripDtext('Examples\n* !post #9926195')).toBe('Examples\n* post #9926195')
  })
})

describe('splitDtextPostLinks', () => {
  it('returns a single text segment when there are no post references', () => {
    expect(splitDtextPostLinks('A character with cat ears.')).toEqual([
      { text: 'A character with cat ears.' }
    ])
  })

  it('splits out a post reference as its own linkable segment', () => {
    expect(splitDtextPostLinks('Examples\n* post #8241273')).toEqual([
      { text: 'Examples\n* ' },
      { text: 'post #8241273', postId: '8241273' }
    ])
  })

  it('handles multiple post references, keeping surrounding text intact', () => {
    expect(splitDtextPostLinks('* post #111: Flat ass\n* post #222: Huge ass')).toEqual([
      { text: '* ' },
      { text: 'post #111', postId: '111' },
      { text: ': Flat ass\n* ' },
      { text: 'post #222', postId: '222' },
      { text: ': Huge ass' }
    ])
  })
})
