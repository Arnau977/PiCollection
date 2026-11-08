// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import type { ContextMenuItem } from '@shared/ipc/contracts'
import type { MediaModel } from '@shared/models'
import { buildContextMenu, findContextTarget } from './contextMenuItems'

const t = ((key: string, values?: { name?: string }) =>
  values?.name ? `${key}:${values.name}` : key) as unknown as TFunction

const media = (id: string, type: MediaModel['type'] = 'image'): MediaModel =>
  ({ id, name: `pic-${id}`, type, route: `/${id}.png` }) as MediaModel

const ids = (items: ContextMenuItem[]): string[] =>
  items.map((item) => ('type' in item ? '---' : (item.id ?? item.role ?? '')))

describe('findContextTarget', () => {
  it('reads a field, a marked media with its link, and bare selected text', () => {
    document.body.innerHTML = `
      <input id="ro" readonly value="abc" />
      <input id="pw" type="password" />
      <input id="box" type="checkbox" />
      <li data-media-id="m1"><a href="#/media/m1"><img id="thumb" /></a></li>
      <p id="text">hello</p>`
    const $ = (id: string): Element => document.getElementById(id)!

    expect(findContextTarget($('ro'), '')).toMatchObject({ kind: 'text', readOnly: true })
    expect(findContextTarget($('pw'), '')).toMatchObject({ kind: 'text', secret: true })
    expect(findContextTarget($('box'), '')).toBeNull()
    const onThumb = findContextTarget($('thumb'), '')
    expect(onThumb).toMatchObject({ kind: 'media', mediaId: 'm1' })
    expect(onThumb && 'openLink' in onThumb && onThumb.openLink?.getAttribute('href')).toBe(
      '#/media/m1'
    )
    expect(findContextTarget($('text'), 'hello')).toEqual({ kind: 'selection' })
    expect(findContextTarget($('text'), '')).toBeNull()
  })
})

describe('buildContextMenu', () => {
  const onMedia = { kind: 'media', mediaId: 'a', openLink: null, hasSelection: false } as const

  it('never offers copying a password or editing a read-only field', () => {
    const items = buildContextMenu(
      { kind: 'text', hasSelection: true, readOnly: true, secret: true },
      t
    )
    const enabled = items.filter((item) => !('type' in item) && item.enabled !== false)
    expect(ids(enabled)).toEqual(['selectAll'])
  })

  it('offers no copy or compare for a video, and copies a GIF whole', () => {
    expect(ids(buildContextMenu(onMedia, t, media('a', 'video')))).toEqual([
      'copyLocation',
      'showInFolder'
    ])
    expect(ids(buildContextMenu(onMedia, t, media('a', 'gif')))).toEqual([
      'copyImage',
      'copyLocation',
      'showInFolder',
      '---',
      'chooseCompare'
    ])
  })

  it('walks the two compare steps', () => {
    const chosen = media('a')
    expect(ids(buildContextMenu(onMedia, t, media('a'), chosen)).slice(-1)).toEqual([
      'clearCompare'
    ])
    const onOther = buildContextMenu({ ...onMedia, mediaId: 'b' }, t, media('b'), chosen)
    expect(ids(onOther).slice(-2)).toEqual(['compareWith', 'chooseCompare'])
    expect(onOther.find((item) => !('type' in item) && item.id === 'compareWith')).toMatchObject({
      label: 'mediaCompare.openLabel:pic-a'
    })
  })
})
