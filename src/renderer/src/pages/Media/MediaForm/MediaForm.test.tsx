// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import type { CharacterModel } from '@shared/models'
import { MemoryRouter } from 'react-router-dom'
import { MediaForm } from './MediaForm'

const confirmMock = vi.fn()
vi.mock('../../../components/ConfirmDialog/ConfirmDialogContext', () => ({
  useConfirm: () => confirmMock
}))

function setApi(overrides: Record<string, Record<string, unknown>> = {}): void {
  const defaults: Record<string, Record<string, unknown>> = {
    media: {
      create: vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } }),
      checkDuplicate: vi
        .fn()
        .mockResolvedValue({ success: true, data: { exactMatch: null, similar: [] } }),
      clearPendingTagging: vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } }),
      findSimilar: vi.fn().mockResolvedValue({ success: true, data: [] }),
      detectAiMetadata: vi.fn().mockResolvedValue({ success: true, data: null })
    },
    artist: { create: vi.fn() },
    tag: { create: vi.fn(), getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
    character: { create: vi.fn() },
    series: { create: vi.fn() },
    sauceNao: {
      lookup: vi.fn(),
      getQuota: vi.fn().mockResolvedValue({ success: true, data: { exhaustedUntil: null } }),
      getApiKey: vi.fn().mockResolvedValue({ success: true, data: null })
    },
    wd14Runtime: {
      getStatus: vi.fn().mockResolvedValue({ success: true, data: { state: 'not-installed' } }),
      onEvent: vi.fn().mockReturnValue(() => {})
    },
    wd14Tagger: {
      suggestTags: vi.fn()
    },
    danbooru: {
      autocompleteTags: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getCredentials: vi
        .fn()
        .mockResolvedValue({ success: true, data: { username: 'arnau', apiKey: 'abc123' } })
    },
    tagWiki: {
      lookup: vi.fn().mockResolvedValue({ success: true, data: null })
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

vi.mock('../../../hooks/useEntityLists', () => ({
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

    expect(
      await screen.findByText('This file is already in the library as "Existing pic".')
    ).toBeInTheDocument()
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
  it('shows progress and a Save label instead of Add', async () => {
    renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 2, total: 5, onNext: vi.fn() }
    })

    expect(screen.getByText('File 2 of 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
  })

  it('hides the Previous button when queueInfo has no onPrevious', async () => {
    renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onNext: vi.fn() }
    })

    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument()
  })

  it('calls onPrevious when Previous is clicked', async () => {
    const onPrevious = vi.fn()
    renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 2, total: 3, onNext: vi.fn(), onPrevious }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))

    expect(onPrevious).toHaveBeenCalledTimes(1)
  })

  it('calls onNext without saving when Next is clicked', async () => {
    const onNext = vi.fn()
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })

    renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onNext }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(mediaCreate).not.toHaveBeenCalled()
  })

  it('saves without advancing the queue when Save is submitted', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })
    const onNext = vi.fn()
    const { container, onSaved } = renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onNext }
    })

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await vi.waitFor(() =>
      expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'a' }))
    )
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onNext).not.toHaveBeenCalled()
  })

  it('updates rather than duplicates on a second Save for the same queue item', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    const mediaUpdate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate, update: mediaUpdate } })
    const { container } = renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onNext: vi.fn() }
    })

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)
    await vi.waitFor(() => expect(mediaCreate).toHaveBeenCalledTimes(1))

    fireEvent.submit(form)
    await vi.waitFor(() =>
      expect(mediaUpdate).toHaveBeenCalledWith('m1', expect.objectContaining({ name: 'a' }))
    )
    expect(mediaCreate).toHaveBeenCalledTimes(1)
  })

  it('shows a Send to pending button only during queue creation (not on edit)', async () => {
    renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onNext: vi.fn() }
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
      queueInfo: { current: 1, total: 3, onNext: vi.fn() }
    })

    expect(screen.queryByRole('button', { name: 'Send to pending' })).not.toBeInTheDocument()
  })

  it('hides Send to pending once the item has been saved', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })
    const { container } = renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onNext: vi.fn() }
    })

    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Send to pending' })).not.toBeInTheDocument()
    )
  })

  it('creates with pendingTagging: true when Send to pending is clicked', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })
    const { onSaved } = renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onNext: vi.fn() }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Send to pending' }))

    await vi.waitFor(() =>
      expect(mediaCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'a', pendingTagging: true })
      )
    )
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'm1' }))
  })

  it('calls onSentToPending instead of onSaved when provided', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })
    const onSentToPending = vi.fn()
    const { onSaved } = renderForm({
      initialFile: { route: '/pics/a.png', name: 'a', type: 'image' },
      queueInfo: { current: 1, total: 3, onNext: vi.fn() },
      onSentToPending
    })

    fireEvent.click(screen.getByRole('button', { name: 'Send to pending' }))

    await vi.waitFor(() => expect(onSentToPending).toHaveBeenCalledWith({ id: 'm1' }))
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe('MediaForm hideNames', () => {
  const existingMedia = {
    id: 'm1',
    name: 'Existing',
    type: 'image' as const,
    route: '/pics/a.png',
    sfw: true,
    isAiGenerated: false,
    createdAt: Date.now(),
    pendingTagging: false
  }

  afterEach(() => {
    window.localStorage.clear()
  })

  it('shows the Name field when editing and the setting is off', () => {
    renderForm({ media: existingMedia })

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('hides the Name field when editing and hideNames is on in Settings', () => {
    window.localStorage.setItem(
      'picollection:gallery-defaults',
      JSON.stringify({ hideNames: true })
    )

    renderForm({ media: existingMedia })

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
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

  it('shows Save & mark resolved when editing pending media with the callback provided', () => {
    renderForm({ media: pendingMedia, onMarkResolved: vi.fn() })

    expect(screen.getByRole('button', { name: 'Save & mark resolved' })).toBeInTheDocument()
  })

  it('saves and marks resolved with Ctrl+Shift+S', async () => {
    const onMarkResolved = vi.fn()
    setApi({ media: { update: vi.fn().mockResolvedValue({ success: true, data: pendingMedia }) } })
    renderForm({ media: pendingMedia, onMarkResolved })

    fireEvent.keyDown(document.body, { key: 'S', ctrlKey: true, shiftKey: true })

    await vi.waitFor(() => expect(onMarkResolved).toHaveBeenCalled())
  })

  it('leaves with Esc or Cancel, asking first only when there are unsaved changes', async () => {
    const { onCancel } = renderForm({ media: pendingMedia })
    confirmMock.mockResolvedValueOnce(false)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Generated using AI' }))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await vi.waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Generated using AI' }))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('checkbox', { name: 'Generated using AI' }))
    confirmMock.mockResolvedValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledTimes(2))
    expect(confirmMock).toHaveBeenCalledTimes(2)
  })

  it('does not show Save & mark resolved when the media is not pending', () => {
    renderForm({ media: { ...pendingMedia, pendingTagging: false }, onMarkResolved: vi.fn() })

    expect(screen.queryByRole('button', { name: 'Save & mark resolved' })).not.toBeInTheDocument()
  })

  it('does not show Save & mark resolved when no onMarkResolved callback is provided', () => {
    renderForm({ media: pendingMedia })

    expect(screen.queryByRole('button', { name: 'Save & mark resolved' })).not.toBeInTheDocument()
  })

  it('saves what was tagged in the form before resolving it', async () => {
    tagsData = [{ id: 't1', name: 'Landscape' }]
    const calls: string[] = []
    const mediaUpdate = vi.fn().mockImplementation(async () => {
      calls.push('update')
      return { success: true, data: { ...pendingMedia, tags: tagsData } }
    })
    const clearPendingTagging = vi.fn().mockImplementation(async () => {
      calls.push('resolve')
      return { success: true, data: { ...pendingMedia, pendingTagging: false } }
    })
    setApi({ media: { update: mediaUpdate, clearPendingTagging } })
    const onMarkResolved = vi.fn()
    const user = userEvent.setup()
    renderForm({ media: pendingMedia, onMarkResolved })

    const [, tagsInput] = screen.getAllByRole('combobox')
    await user.type(tagsInput, 'Lands')
    await user.click(await screen.findByRole('option', { name: 'Landscape' }))
    await user.click(screen.getByRole('button', { name: 'Save & mark resolved' }))

    await vi.waitFor(() => expect(onMarkResolved).toHaveBeenCalledTimes(1))
    expect(mediaUpdate).toHaveBeenCalledWith('m1', expect.objectContaining({ tagIds: ['t1'] }))
    expect(calls).toEqual(['update', 'resolve'])
  })

  it('does not resolve when saving the form fails', async () => {
    const clearPendingTagging = vi.fn()
    setApi({
      media: {
        update: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'INTERNAL', message: 'Disk full' }
        }),
        clearPendingTagging
      }
    })
    const onMarkResolved = vi.fn()
    const user = userEvent.setup()
    renderForm({ media: pendingMedia, onMarkResolved })

    await user.click(screen.getByRole('button', { name: 'Save & mark resolved' }))

    expect(await screen.findByText('Disk full')).toBeInTheDocument()
    expect(clearPendingTagging).not.toHaveBeenCalled()
    expect(onMarkResolved).not.toHaveBeenCalled()
  })
})

describe('MediaForm remount on media change', () => {
  it("discards the previous item's loaded fields (e.g. tags) when re-keyed for a different media item", () => {
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

  it("surfaces characters linked to the media's selected series first in the browse list", async () => {
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
      expect(mediaUpdate).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ tagIds: ['t-real'] })
      )
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

  it('offers to apply the WD14-suggested rating when it disagrees with the current SFW toggle', async () => {
    const suggestTags = vi.fn().mockResolvedValue({
      success: true,
      data: [{ name: 'explicit', score: 0.91, category: 'rating' }]
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
    expect(screen.getByRole('checkbox', { name: 'Safe for work' })).toBeChecked()

    await user.click(await screen.findByRole('button', { name: 'Suggest tags locally' }))
    await user.click(await screen.findByRole('button', { name: /NSFW/ }))

    expect(screen.getByRole('checkbox', { name: 'Explicit content' })).not.toBeChecked()
  })

  it('does not offer a rating suggestion once it already matches the current SFW toggle', async () => {
    const suggestTags = vi.fn().mockResolvedValue({
      success: true,
      data: [{ name: 'general', score: 0.95, category: 'rating' }]
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

    await user.click(await screen.findByRole('button', { name: 'Suggest tags locally' }))
    await screen.findByText('No confident tags found.')

    expect(screen.queryByRole('button', { name: /NSFW/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /SFW/ })).not.toBeInTheDocument()
  })

  it('treats a "sensitive" rating as still SFW, not just "general"', async () => {
    // Danbooru's 4-tier rating (general < sensitive < questionable <
    // explicit) puts mild fanservice under "sensitive", not "general" - it
    // must not be treated as NSFW here, or every faintly suggestive image
    // would wrongly flip the toggle.
    const suggestTags = vi.fn().mockResolvedValue({
      success: true,
      data: [{ name: 'sensitive', score: 0.71, category: 'rating' }]
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

    await user.click(await screen.findByRole('button', { name: 'Suggest tags locally' }))
    await screen.findByText('No confident tags found.')

    expect(screen.queryByRole('button', { name: /NSFW/ })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Safe for work' })).toBeChecked()
  })
})

describe('MediaForm SFW/AI toggles', () => {
  it('defaults SFW checked and AI-generated unchecked for a new item', () => {
    renderForm({ initialFile: { route: '/pic.png', name: 'pic.png', type: 'image' } })

    expect(screen.getByRole('checkbox', { name: 'Safe for work' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Generated using AI' })).not.toBeChecked()
  })

  it('flips the accessible name to the NSFW label when SFW is unchecked', async () => {
    const user = userEvent.setup()
    renderForm({ initialFile: { route: '/pic.png', name: 'pic.png', type: 'image' } })

    await user.click(screen.getByRole('checkbox', { name: 'Safe for work' }))

    expect(screen.getByRole('checkbox', { name: 'Explicit content' })).not.toBeChecked()
  })

  it('checking AI-generated is reflected on submit', async () => {
    const mediaCreate = vi.fn().mockResolvedValue({ success: true, data: { id: 'm1' } })
    setApi({ media: { create: mediaCreate } })
    const user = userEvent.setup()
    const { container } = renderForm({
      initialFile: { route: '/pic.png', name: 'pic.png', type: 'image' }
    })

    await user.click(screen.getByRole('checkbox', { name: 'Generated using AI' }))
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await vi.waitFor(() =>
      expect(mediaCreate).toHaveBeenCalledWith(expect.objectContaining({ isAiGenerated: true }))
    )
  })
})

describe('MediaForm suggestions rail responsive default', () => {
  const matchMediaSpy = window.matchMedia

  afterEach(() => {
    window.matchMedia = matchMediaSpy
  })

  function mockMatchMedia(matches: boolean): void {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  }

  it('starts expanded on a wide viewport', () => {
    mockMatchMedia(false)
    const { container } = renderForm({
      initialFile: { route: '/pic.png', name: 'pic.png', type: 'image' }
    })

    expect(container.querySelector('.suggestions-rail')).not.toHaveClass('is-collapsed')
  })

  it('starts collapsed on a narrow viewport, where the rail moves above the form', () => {
    mockMatchMedia(true)
    const { container } = renderForm({
      initialFile: { route: '/pic.png', name: 'pic.png', type: 'image' }
    })

    expect(container.querySelector('.suggestions-rail')).toHaveClass('is-collapsed')
  })
})

describe('MediaForm source-site suggestions', () => {
  const capturedMedia = {
    id: 'm1',
    name: 'post.jpg',
    type: 'image' as const,
    route: 'Web Imports/danbooru/123-post.jpg',
    sfw: true,
    isAiGenerated: false,
    createdAt: Date.now(),
    pendingTagging: true,
    sourceMetadata: {
      site: 'danbooru',
      tags: ['closed_eyes', 'rabbit_ears'],
      characters: [],
      series: []
    }
  }

  it('offers source names as suggestions: existing ones link, new ones are staged', async () => {
    tagsData = [{ id: 't1', name: 'Closed eyes' }]
    const tagCreate = vi.fn()
    setApi({ tag: { create: tagCreate } })
    const user = userEvent.setup()
    renderForm({ media: capturedMedia })

    expect(screen.getByRole('tab', { name: /danbooru/ })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: 'Add Closed eyes' }))
    expect(screen.queryByRole('button', { name: 'Add Closed eyes' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Rabbit Ears/ }))

    expect(await screen.findByText('Rabbit Ears (new)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Rabbit Ears/ })).not.toBeInTheDocument()
    expect(tagCreate).not.toHaveBeenCalled()
  })

  it('remembers the lookup tab picked last, but opens captures on their site', async () => {
    window.localStorage.removeItem('picollection.suggestionsTab')
    const user = userEvent.setup()
    const { unmount } = renderForm()
    expect(screen.getByRole('tab', { name: 'Local AI' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: 'SauceNAO' }))
    unmount()
    const second = renderForm()
    expect(screen.getByRole('tab', { name: 'SauceNAO' })).toHaveAttribute('aria-selected', 'true')
    second.unmount()

    renderForm({ media: capturedMedia })
    expect(screen.getByRole('tab', { name: /danbooru/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('suggests the rating the site had instead of applying it', async () => {
    const user = userEvent.setup()
    renderForm({
      media: {
        ...capturedMedia,
        sfw: false,
        sourceMetadata: { ...capturedMedia.sourceMetadata!, sfw: true }
      }
    })

    await user.click(screen.getByRole('button', { name: 'SFW' }))

    expect(screen.queryByText('Rating')).not.toBeInTheDocument()
  })

  it('offers to mark the media as AI when its file metadata names a generator', async () => {
    setApi({
      media: {
        detectAiMetadata: vi
          .fn()
          .mockResolvedValue({ success: true, data: { generator: 'ComfyUI' } })
      }
    })
    const user = userEvent.setup()
    renderForm({ media: capturedMedia })

    await screen.findByText("The file's metadata says it was made with ComfyUI.")
    await user.click(screen.getByRole('button', { name: 'Mark as AI' }))

    expect(screen.getByRole('checkbox', { name: 'Generated using AI' })).toBeChecked()
    expect(screen.queryByRole('button', { name: 'Mark as AI' })).not.toBeInTheDocument()
  })

  it('shows the file name and folder of the edited media', () => {
    renderForm({ media: capturedMedia })

    expect(screen.getByText('123-post.jpg')).toBeInTheDocument()
    expect(screen.getByText('Web Imports/danbooru')).toBeInTheDocument()
  })
})

describe('MediaForm similar media while editing', () => {
  it('lists similar media, other pending items included and marked', async () => {
    const findSimilar = vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          media: {
            id: 'm2',
            name: 'twin.png',
            type: 'image',
            route: '/b.png',
            sfw: true,
            isAiGenerated: false,
            createdAt: 1,
            pendingTagging: true
          },
          distance: 2
        }
      ]
    })
    setApi({ media: { findSimilar } })
    renderForm({
      media: {
        id: 'm1',
        name: 'a.png',
        type: 'image',
        route: '/a.png',
        sfw: true,
        isAiGenerated: false,
        createdAt: 1,
        pendingTagging: true
      }
    })

    expect(
      await screen.findByText('This looks similar to media already in the app:')
    ).toBeInTheDocument()
    expect(screen.getByText(/2\/64 difference · pending/)).toBeInTheDocument()
    expect(findSimilar).toHaveBeenCalledWith('m1', { includePending: true })
  })
})
