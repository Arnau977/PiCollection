// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MediaModel } from '@shared/models'
import { SimilarMediaWarning } from './SimilarMediaWarning'

function media(name: string, type: MediaModel['type'] = 'image'): MediaModel {
  return {
    id: name,
    type,
    route: `C:/pics/${name}.png`,
    name,
    sfw: true,
    isAiGenerated: false,
    createdAt: 0,
    pendingTagging: false
  }
}

const current = { route: 'C:/pics/new.png', name: 'This file', type: 'image' as const }

describe('SimilarMediaWarning', () => {
  it('opens a full-size comparison with a movable divider when a match is clicked', async () => {
    const user = userEvent.setup()
    render(
      <SimilarMediaWarning
        title="Looks similar"
        current={current}
        matches={[{ media: media('Other'), distance: 0 }]}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Compare with "Other"' }))
    const dialog = screen.getByRole('dialog', { name: 'Compare images' })
    expect(dialog).toHaveTextContent('This file')

    const slider = screen.getByRole('slider', { name: 'Divider between the two images' })
    expect(slider).toHaveValue('50')
    fireEvent.change(slider, { target: { value: '20' } })
    expect(slider).toHaveAttribute('aria-valuetext', '20% this file, 80% the other one')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
