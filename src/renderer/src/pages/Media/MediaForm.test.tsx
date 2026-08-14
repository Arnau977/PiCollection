// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import type { CharacterModel } from '@shared/models'
import { MemoryRouter } from 'react-router-dom'
import { MediaForm } from './MediaForm'

function setApi(overrides: Record<string, Record<string, unknown>> = {}): void {
  const defaults: Record<string, Record<string, unknown>> = {
    media: {
      create: vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } }),
      checkDuplicate: vi
        .fn()
        .mockResolvedValue({ success: true, data: { exactMatch: null, similar: [] } }),
      clearPendingTagging: vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    },
    artist: { create: vi.fn() },
    tag: { create: vi.fn(), getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
    character: { create: vi.fn() },
    series: { create: vi.fn() },
    sauceNao: {
      lookup: vi.fn(),
      getApiKey: vi.fn().mockResolvedValue({ success: true, data: null })
    },
    wd14Runtime: {
      getStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'not-installed' } }),
      onEvent: vi.fn().mockReturnValue(() => {})
    },
    wd14Tagger: {
      suggestTags: vi.fn()
    }
  }
  const merged: Record<string, unknown> = {}
  for (const key of Object.keys(defaults)) {
    merged[key] = { ...defaults[key], ...overrides[key] }
  }
  Object.defineProperty(window, 'api', { value: merged, writable: true, configurable: true })
}

let charactersData: CharacterModel[] = []
let tagsData: { id: string; name: string }[] = []

vi.mock('../../hooks/useEntityLists', () => ({
  useArtists: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
  useTags: () => ({ data: tagsData, loading: false, error: null, refetch: vi.fn() }),
  useCharacters: () => ({ data: charactersData, loading: false, error: null, refetch: vi.fn() }),
  useSeries: () => ({ data: [], loading: false, error: null, refetch: vi.fn() })
}))

function renderForm(props: Partial<ComponentProps<typeof MediaForm>> = {}) {
  const onCancel = vi.fn()
  const onSaved = vi.fn()
  const utils = render(
    <MemoryRouter>
      <MediaForm onCancel={onCancel} onSaved={onSaved} {...props} />
    </MemoryRouter>
  )
  return { ...utils, onCancel, onSaved }
}

beforeEach(() => {
  setApi()
  charactersData = []
  tagsData = []
})

describe('MediaForm initialFile', () => {
  it('hides the file input and preloads name/type/route from initialFile', async () => {
    const { container } = renderForm({
      initialFile: { route: '/pics/sunset.png', name: 'sunset', type: 'image' }
    })

    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument()
    const preview = container.querySelector('.media-preview img')
    expect(preview).toHaveAttribute('src', expect.stringContaining('app://media/'))
  })

  it('runs the duplicate check for the initial route on mount', async () => {
    const checkDuplicate = vi.fn().mockResolvedValue({
      success: true,
      data: { exactMatch: { id: 'existing', name: 'Existing pic' }, similar: [] }
    })
    setApi({ media: { checkDuplicate } })

    renderForm({ initialFile: { route: '/pics/sunset.png', name: 'sunset', type: 'image' } })

    expect(await screen.findByText('This file is already in the library as "Existing pic".')).toBeInTheDocument()
    expect(checkDuplicate).toHaveBeenCalledWith('/pics/sunset.png')
  })
})

describe('MediaForm saving state', () => {
  it('shows a Saving label on the submit button while the save is in flight', async () => {
    const mediaCreate = vi.fn().mockReturnValue(new Promise(() => {}))
    setApi({ media: { create: mediaCreate } })
    const user = userEvent.setup()
    renderForm({ initialFile: { route: '/pics/a.png', name: 'a', type: 'image' } })

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeInTheDocument()
  })
})

describe('MediaForm queueInfo', () => {
  it('shows progress and a Save & next label instead of Add', async () => {
    renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 2, total: 5, onSkip: vi.fn() }
    })

    expect(screen.getByText('File 2 of 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save & next' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
  })

  it('calls onSkip without saving when Skip is clicked', async () => {
    const onSkip = vi.fn()
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })

    renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onSkip }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(mediaCreate).not.toHaveBeenCalled()
  })

  it('saves normally when Save & next is submitted', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })
    const { container, onSaved } = renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onSkip: vi.fn() }
    })

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await vi.waitFor(() => expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'a' })))
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('shows a Send to pending button only during queue creation (not on edit)', async () => {
    renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onSkip: vi.fn() }
    })

    expect(screen.getByRole('button', { name: 'Send to pending' })).toBeInTheDocument()
  })

  it('does not show Send to pending when editing an existing media, even with queueInfo', async () => {
    renderForm({
      media: {
        id: 'm1',
        name: 'Existing',
        type: 'image',
        route: '/pics/a.png',
        sfw: true,
        isAiGenerated: false,
        createdAt: Date.now(),
        pendingTagging: false
      },
      queueInfo: { current: 1, total: 3, onSkip: vi.fn() }
    })

    expect(screen.queryByRole('button', { name: 'Send to pending' })).not.toBeInTheDocument()
  })

  it('creates with pendingTagging: true and advances the queue when Send to pending is clicked', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })
    const { onSaved } = renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onSkip: vi.fn() }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Send to pending' }))

    await vi.waitFor(() =>
      expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'a', pendingTagging: true }))
    )
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'm1' }))
  })
})

describe('MediaForm onMarkResolved', () => {
  const pendingMedia = {
    id: 'm1',
    name: 'Existing',
    type: 'image' as const,
    route: '/pics/a.png',
    sfw: true,
    isAiGenerated: false,
    createdAt: Date.now(),
    pendingTagging: true
  }

  it('shows Mark resolved when editing pending media with the callback provided', () => {
    renderForm({ media: pendingMedia, onMarkResolved: vi.fn() })

    expect(screen.getByRole('button', { name: 'Mark resolved' })).toBeInTheDocument()
  })

  it('does not show Mark resolved when the media is not pending', () => {
    renderForm({ media: { ...pendingMedia, pendingTagging: false }, onMarkResolved: vi.fn() })

    expect(screen.queryByRole('button', { name: 'Mark resolved' })).not.toBeInTheDocument()
  })

  it('does not show Mark resolved when no onMarkResolved callback is provided', () => {
    renderForm({ media: pendingMedia })

    expect(screen.queryByRole('button', { name: 'Mark resolved' })).not.toBeInTheDocument()
  })

  it('calls onMarkResolved without submitting the form', async () => {
    const mediaUpdate = vi.fn()
    setApi({ media: { update: mediaUpdate } })
    const onMarkResolved = vi.fn()
    renderForm({ media: pendingMedia, onMarkResolved })

    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }))

    await vi.waitFor(() => expect(onMarkResolved).toHaveBeenCalledTimes(1))
    expect(mediaUpdate).not.toHaveBeenCalled()
  })
})

describe('MediaForm remount on media change', () => {
  it('discards the previous item\'s loaded fields (e.g. tags) when re-keyed for a different media item', () => {
    const mediaA = {
      id: 'a',
      name: 'First picture',
      type: 'image' as const,
      route: '/pics/a.png',
      sfw: true,
      isAiGenerated: false,
      createdAt: Date.now(),
      tags: [{ id: 't1', name: 'first-tag' }],
      pendingTagging: true
    }
    const mediaB = {
      id: 'b',
      name: 'Second picture',
      type: 'image' as const,
      route: '/pics/b.png',
      sfw: true,
      isAiGenerated: false,
      createdAt: Date.now(),
      tags: [],
      pendingTagging: true
    }

    tagsData = [{ id: 't1', name: 'first-tag' }]

    const { rerender } = render(
      <MemoryRouter>
        <MediaForm key={mediaA.id} media={mediaA} onCancel={vi.fn()} onSaved={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.getByDisplayValue('First picture')).toBeInTheDocument()
    expect(screen.getByText('first-tag')).toBeInTheDocument()

    // Simulates what MediaPage does: it stays mounted across a pending-queue
    // hop (React Router doesn't remount on a param-only change), and relies
    // on MediaForm's `key` to force a fresh instance instead of carrying the
    // previous item's loaded input state into the next one.
    rerender(
      <MemoryRouter>
        <MediaForm key={mediaB.id} media={mediaB} onCancel={vi.fn()} onSaved={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getByDisplayValue('Second picture')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('First picture')).not.toBeInTheDocument()
    expect(screen.queryByText('first-tag')).not.toBeInTheDocument()
  })
})

describe('MediaForm character picker', () => {
  it('shows the linked series next to a character option in the picker', async () => {
    charactersData = [
      { id: 'c1', name: 'Ishtar', series: [{ id: 's1', name: 'Fate/Grand Order' }] }
    ]
    const user = userEvent.setup()
    renderForm({ initialFile: { route: '/pic.png', name: 'pic', type: 'image' } })

    const charactersCombobox = screen.getByRole('combobox', { name: /characters/i })
    await user.type(charactersCombobox, 'Ishtar')

    expect(
      await screen.findByRole('option', { name: 'Ishtar (Fate/Grand Order)' })
    ).toBeInTheDocument()
  })

  it('surfaces characters linked to the media\'s selected series first in the browse list', async () => {
    const wonderland = { id: 's1', name: 'Wonderland' }
    charactersData = [
      { id: 'c1', name: 'Aardvark', series: [] },
      { id: 'c2', name: 'Bandersnatch', series: [] },
      { id: 'c3', name: 'Cheshire Cat', series: [wonderland] }
    ]
    const user = userEvent.setup()
    const media = {
      id: 'm1',
      name: 'sunset',
      type: 'image' as const,
      route: '/pics/sunset.png',
      sfw: true,
      isAiGenerated: false,
      createdAt: Date.now(),
      tags: [],
      characters: [],
      series: [wonderland],
      pendingTagging: false
    }
    renderForm({ media })

    const charactersCombobox = screen.getByRole('combobox', { name: /characters/i })
    const comboboxRoot = charactersCombobox.closest('.react-aria-ComboBox') as HTMLElement
    await user.click(within(comboboxRoot).getByRole('button', { name: /show suggestions/i }))

    const optionNames = (await screen.findAllByRole('option')).map((option) => option.textContent)
    const cheshireIndex = optionNames.findIndex((name) => name?.startsWith('Cheshire Cat'))
    expect(cheshireIndex).toBeGreaterThanOrEqual(0)
    expect(cheshireIndex).toBeLessThan(optionNames.indexOf('Aardvark'))
    expect(cheshireIndex).toBeLessThan(optionNames.indexOf('Bandersnatch'))
  })
})

describe('MediaForm deferred entity creation (edit mode)', () => {
  it('defers tag creation while editing existing media, and resolves it on save', async () => {
    const tagCreate = vi
      .fn()
      .mockResolvedValue({ success: true, data: { id: 't-real', name: 'landscape' } })
    const mediaUpdate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ tag: { create: tagCreate }, media: { update: mediaUpdate } })
    const user = userEvent.setup()

    const media = {
      id: 'm1',
      name: 'sunset',
      type: 'image' as const,
      route: '/pics/sunset.png',
      sfw: true,
      isAiGenerated: false,
      createdAt: Date.now(),
      tags: [],
      characters: [],
      series: [],
      pendingTagging: false
    }
    const { container } = renderForm({ media })

    const [, tagsInput] = screen.getAllByRole('combobox')
    await user.type(tagsInput, 'landscape')
    await user.click(await screen.findByText('Create "landscape"'))

    expect(tagCreate).not.toHaveBeenCalled()
    expect(await screen.findByText('landscape (new)')).toBeInTheDocument()

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await vi.waitFor(() => expect(tagCreate).toHaveBeenCalledWith({ name: 'landscape' }))
    await vi.waitFor(() =>
      expect(mediaUpdate).toHaveBeenCalledWith('m1', expect.objectContaining({ tagIds: ['t-real'] }))
    )
  })

  it('shows an enable-in-Settings hint for local tagging when not installed', async () => {
    renderForm()
    expect(
      await screen.findByText('Local AI tagging needs to be enabled first.')
    ).toBeInTheDocument()
  })

  it('runs a WD14 lookup, applies existing tags, and offers missing ones as create chips', async () => {
    const suggestTags = vi.fn().mockResolvedValue({
      success: true,
      data: [{ name: 'landscape', score: 0.9, category: 'general' }]
    })
    setApi({
      wd14Runtime: {
        getStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'installed' } }),
        onEvent: vi.fn().mockReturnValue(() => {})
      },
      wd14Tagger: { suggestTags }
    })
    tagsData = [{ id: 't1', name: 'landscape' }]
    const user = userEvent.setup()
    renderForm({ initialFile: { route: '/pic.png', name: 'pic.png', type: 'image' } })

    await user.click(await screen.findByRole('button', { name: 'Suggest tags locally' }))

    expect(suggestTags).toHaveBeenCalledWith('/pic.png')
    expect(await screen.findByText('Added 1 suggestions')).toBeInTheDocument()
  })

  it('recognizes a series added earlier in this same edit as existing, not new, on a later WD14 run', async () => {
    // A series added via an earlier suggestion click is a pending draft -
    // not yet saved to the library - so a second WD14 run re-detecting the
    // same name must still recognize it, not offer it again as "new".
    const suggestTags = vi.fn().mockResolvedValue({
      success: true,
      data: [{ name: 'honkai: star rail', score: 0.9, category: 'copyright' }]
    })
    setApi({
      wd14Runtime: {
        getStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'installed' } }),
        onEvent: vi.fn().mockReturnValue(() => {})
      },
      wd14Tagger: { suggestTags }
    })
    const user = userEvent.setup()
    renderForm({ initialFile: { route: '/pic.png', name: 'pic.png', type: 'image' } })

    const runButton = await screen.findByRole('button', { name: 'Suggest tags locally' })
    await user.click(runButton)
    await user.click(await screen.findByRole('button', { name: 'Honkai: star rail' }))
    expect(screen.queryByRole('button', { name: 'Honkai: star rail' })).not.toBeInTheDocument()

    await user.click(runButton)

    expect(await screen.findByText('Added 1 suggestions')).toBeInTheDocument()
    expect(screen.queryByText('New series')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Honkai: star rail' })).not.toBeInTheDocument()
  })

  it('shows a tag-wiki info button next to each missing WD14 suggestion', async () => {
    const suggestTags = vi.fn().mockResolvedValue({
      success: true,
      data: [{ name: 'new tag', score: 0.8, category: 'general' }]
    })
    setApi({
      wd14Runtime: {
        getStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'installed' } }),
        onEvent: vi.fn().mockReturnValue(() => {})
      },
      wd14Tagger: { suggestTags },
      tagWiki: { lookup: vi.fn().mockResolvedValue({ success: true, data: null }) }
    })
    const user = userEvent.setup()
    renderForm({ initialFile: { route: '/pic.png', name: 'pic.png', type: 'image' } })

    await user.click(await screen.findByRole('button', { name: 'Suggest tags locally' }))

    // Exact match: the add-chip button's accessible name is the title-cased
    // display form ("New Tag"), distinct from TagWikiInfo's own button,
    // whose aria-label keeps the raw lowercase name used for the wiki
    // lookup - "What does this tag mean? (new tag)".
    expect(await screen.findByRole('button', { name: 'New Tag' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'What does this tag mean? (new tag)' })
    ).toBeInTheDocument()
  })

  it('creates a tag from a missing WD14 suggestion and removes its chip', async () => {
    const suggestTags = vi.fn().mockResolvedValue({
      success: true,
      data: [{ name: 'new tag', score: 0.8, category: 'general' }]
    })
    setApi({
      wd14Runtime: {
        getStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'installed' } }),
        onEvent: vi.fn().mockReturnValue(() => {})
      },
      wd14Tagger: { suggestTags },
      tagWiki: { lookup: vi.fn().mockResolvedValue({ success: true, data: null }) }
    })
    const user = userEvent.setup()
    renderForm({ initialFile: { route: '/pic.png', name: 'pic.png', type: 'image' } })

    await user.click(await screen.findByRole('button', { name: 'Suggest tags locally' }))
    await user.click(await screen.findByRole('button', { name: 'New Tag' }))

    expect(screen.queryByRole('button', { name: 'New Tag' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'What does this tag mean? (new tag)' })
    ).not.toBeInTheDocument()
  })
})
