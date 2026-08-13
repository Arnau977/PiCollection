// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalTaggingSection } from './LocalTaggingSection'

const getStatus = vi.fn()
const install = vi.fn()
const remove = vi.fn()
const onEvent = vi.fn()

beforeEach(() => {
  getStatus.mockReset().mockResolvedValue({ success: true, data: { state: 'not-installed' } })
  install.mockReset().mockResolvedValue({ success: true, data: undefined })
  remove.mockReset().mockResolvedValue({ success: true, data: undefined })
  onEvent.mockReset().mockReturnValue(() => {})
  Object.defineProperty(window, 'api', {
    value: { wd14Runtime: { getStatus, install, remove, onEvent } },
    writable: true,
    configurable: true
  })
})

describe('LocalTaggingSection', () => {
  it('shows an enable button when not installed', async () => {
    render(<LocalTaggingSection />)
    expect(
      await screen.findByRole('button', { name: 'Enable local AI tagging' })
    ).toBeInTheDocument()
  })

  it('starts the install on click', async () => {
    const user = userEvent.setup()
    render(<LocalTaggingSection />)
    await user.click(await screen.findByRole('button', { name: 'Enable local AI tagging' }))
    expect(install).toHaveBeenCalled()
  })

  it('shows a remove button once installed', async () => {
    getStatus.mockResolvedValue({ success: true, data: { state: 'installed' } })
    render(<LocalTaggingSection />)
    expect(
      await screen.findByRole('button', { name: 'Disable and remove' })
    ).toBeInTheDocument()
  })

  it('shows a progress bar reflecting the current percent while installing', async () => {
    let emit: (event: unknown) => void = () => {}
    onEvent.mockImplementation((listener) => {
      emit = listener
      return () => {}
    })
    render(<LocalTaggingSection />)
    await screen.findByRole('button', { name: 'Enable local AI tagging' })

    emit({ type: 'progress', step: 'model', percent: 42 })

    const progressBar = await screen.findByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '42')
  })

  it('shows an error message and a retry button on failure', async () => {
    let emit: (event: unknown) => void = () => {}
    onEvent.mockImplementation((listener) => {
      emit = listener
      return () => {}
    })
    render(<LocalTaggingSection />)
    await screen.findByRole('button', { name: 'Enable local AI tagging' })

    emit({ type: 'error', message: 'Checksum mismatch' })

    expect(
      await screen.findByText('Could not set up local AI tagging: Checksum mismatch')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
