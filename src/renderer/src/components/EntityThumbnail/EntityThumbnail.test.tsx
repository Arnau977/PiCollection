// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { EntityThumbnail } from './EntityThumbnail'

describe('EntityThumbnail', () => {
  it('renders an image for a resolved route', () => {
    const { container } = render(<EntityThumbnail route="/pics/a.png" loading={false} />)

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('app://thumb/')
    )
  })

  it('shows a loading shimmer while loading is true, regardless of route', () => {
    const { container } = render(<EntityThumbnail route={null} loading />)

    expect(container.querySelector('.entity-thumb-loading')).toBeInTheDocument()
    expect(container.querySelector('.entity-thumb-placeholder')).not.toBeInTheDocument()
  })

  it('shows a placeholder when not loading and there is no route', () => {
    const { container } = render(<EntityThumbnail route={null} loading={false} />)

    expect(container.querySelector('.entity-thumb-placeholder')).toBeInTheDocument()
  })

  it('shows a loading shimmer until the image has decoded', () => {
    const { container } = render(<EntityThumbnail route="/pics/a.png" loading={false} />)

    expect(container.querySelector('.entity-thumb-loading')).toBeInTheDocument()
    fireEvent.load(container.querySelector('img') as HTMLImageElement)
    expect(container.querySelector('.entity-thumb-loading')).not.toBeInTheDocument()
  })

  it('shows a placeholder when the image fails to load', () => {
    const { container } = render(<EntityThumbnail route="/vids/a.mp4" loading={false} />)

    fireEvent.error(container.querySelector('img') as HTMLImageElement)

    expect(container.querySelector('.entity-thumb-placeholder')).toBeInTheDocument()
  })

  describe('hover-zoom origin', () => {
    const originalInnerWidth = window.innerWidth
    const originalInnerHeight = window.innerHeight

    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    })

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        value: originalInnerWidth,
        configurable: true
      })
      Object.defineProperty(window, 'innerHeight', {
        value: originalInnerHeight,
        configurable: true
      })
      vi.restoreAllMocks()
    })

    function mockRect(rect: Partial<DOMRect>): void {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        x: rect.left ?? 0,
        y: rect.top ?? 0,
        width: 40,
        height: 40,
        top: 0,
        left: 0,
        right: 40,
        bottom: 40,
        toJSON: () => ({}),
        ...rect
      } as DOMRect)
    }

    it('grows from the top-left corner when there is room on every side', () => {
      mockRect({ top: 300, left: 300, right: 340, bottom: 340 })
      const { container } = render(<EntityThumbnail route="/pics/a.png" loading={false} />)

      fireEvent.mouseEnter(container.querySelector('.entity-thumb') as HTMLElement)

      expect(container.querySelector('img')).toHaveStyle({ transformOrigin: 'left top' })
    })

    it('flips to the bottom-right corner when the row is near the edge of the screen', () => {
      mockRect({ top: 780, left: 980, right: 1000, bottom: 800 })
      const { container } = render(<EntityThumbnail route="/pics/a.png" loading={false} />)

      fireEvent.mouseEnter(container.querySelector('.entity-thumb') as HTMLElement)

      expect(container.querySelector('img')).toHaveStyle({ transformOrigin: 'right bottom' })
    })
  })
})
