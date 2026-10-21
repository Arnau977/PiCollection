// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MediaModel } from '@shared/models'
import { SimilarMediaWarning } from './SimilarMediaWarning'

function media(name: string, type: MediaModel['type'] = 'image'): MediaModel {
  return {
    id: name,
    type,
    route: `C:/pics/1790-${name}.png`,
    name,
    sfw: true,
    isAiGenerated: false,
    createdAt: 0,
    pendingTagging: false
  }
}

const current = {
  route: 'C:/pics/1791-new.png',
  name: 'new.png',
  type: 'image' as const,
  taxonomy: { characters: ['Hayasaka'], series: [], tags: ['smile', 'bunny'] }
}

beforeEach(() => {
  Object.defineProperty(window, 'api', {
    value: { sourceFolder: { get: vi.fn().mockResolvedValue({ success: true, data: 'C:/pics' }) } },
    writable: true,
    configurable: true
  })
})

describe('SimilarMediaWarning', () => {
  // Named by file name, like the form's Location - not by media name.
  it('opens a full-size comparison with a movable divider when a match is clicked', async () => {
    const user = userEvent.setup()
    render(
      <SimilarMediaWarning
        title="Looks similar"
        current={current}
        matches={[{ media: media('Other'), distance: 0 }]}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Compare with "1790-Other.png"' }))
    const dialog = screen.getByRole('dialog', { name: 'Compare images' })
    expect(dialog).toHaveTextContent('1791-new.png')

    const slider = screen.getByRole('slider', { name: 'Divider between the two images' })
    expect(slider).toHaveValue('50')
    fireEvent.change(slider, { target: { value: '20' } })
    expect(slider).toHaveAttribute('aria-valuetext', '20% this file, 80% the other one')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows both files side by side with what only each one is tagged with', async () => {
    const user = userEvent.setup()
    const other = { ...media('Other'), tags: [{ id: 't1', name: 'smile', createdAt: 0 }] }
    render(
      <SimilarMediaWarning
        title="Looks similar"
        current={current}
        matches={[{ media: other, distance: 0 }]}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Compare with "1790-Other.png"' }))
    await user.click(screen.getByRole('button', { name: 'Side by side' }))

    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    const [leftOnly, rightOnly] = screen.getAllByRole('heading', { name: /^Only on this one/ })
    expect(leftOnly).toHaveTextContent('(2)')
    expect(leftOnly.parentElement).toHaveTextContent('Hayasaka')
    expect(leftOnly.parentElement).toHaveTextContent('bunny')
    expect(rightOnly.parentElement).toHaveTextContent('Nothing the other one lacks')
    expect(screen.getByRole('heading', { name: 'On both (1)' }).parentElement).toHaveTextContent(
      'smile'
    )
  })

  it('keeps a video match as a hover preview only', () => {
    render(
      <SimilarMediaWarning
        title="Looks similar"
        current={current}
        matches={[{ media: media('Clip', 'video'), distance: 2 }]}
      />
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
