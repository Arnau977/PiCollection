import { describe, expect, it } from 'vitest'
import { splitDtextLinks, stripDtext } from './dtext'

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
      'intro text\nRules for usage\n- bullet one'
    )
  })

  it('replaces the "*" bullet marker with a dash', () => {
    expect(stripDtext('* first\n* second')).toBe('- first\n- second')
  })

  it('preserves newlines between bulleted lines', () => {
    const raw = '* [b]Do not use[/b] when [[nude]].\n* [b]Do not use[/b] when [[bare legs]].'
    expect(stripDtext(raw)).toBe('- Do not use when nude.\n- Do not use when bare legs.')
  })

  it('strips the "!" marker from post references, keeping the post number readable', () => {
    expect(stripDtext('Examples\n* !post #9926195')).toBe('Examples\n- post #9926195')
  })
})

describe('splitDtextLinks', () => {
  it('returns a single text segment when there are no post/pool references', () => {
    expect(splitDtextLinks('A character with cat ears.')).toEqual([
      { text: 'A character with cat ears.' }
    ])
  })

  it('splits out a post reference as its own linkable segment', () => {
    expect(splitDtextLinks('Examples\n- post #8241273')).toEqual([
      { text: 'Examples\n- ' },
      { text: 'post #8241273', href: 'https://danbooru.donmai.us/posts/8241273' }
    ])
  })

  it('handles multiple post references, keeping surrounding text intact', () => {
    expect(splitDtextLinks('- post #111: Flat ass\n- post #222: Huge ass')).toEqual([
      { text: '- ' },
      { text: 'post #111', href: 'https://danbooru.donmai.us/posts/111' },
      { text: ': Flat ass\n- ' },
      { text: 'post #222', href: 'https://danbooru.donmai.us/posts/222' },
      { text: ': Huge ass' }
    ])
  })

  it('splits out a pool reference (pool #N) as a linkable segment', () => {
    expect(splitDtextLinks('- pool #903: Disgustingly Adorable')).toEqual([
      { text: '- ' },
      { text: 'pool #903', href: 'https://danbooru.donmai.us/pools/903' },
      { text: ': Disgustingly Adorable' }
    ])
  })

  it('converts a {{pool:Name}} reference into a link with a readable label', () => {
    expect(splitDtextLinks('See {{pool:Disgustingly_Adorable}} instead.')).toEqual([
      { text: 'See ' },
      {
        text: 'Disgustingly Adorable',
        href: 'https://danbooru.donmai.us/posts?tags=pool%3ADisgustingly_Adorable'
      },
      { text: ' instead.' }
    ])
  })
})
