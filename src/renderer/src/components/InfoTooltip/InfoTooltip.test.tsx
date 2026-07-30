// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InfoTooltip } from './InfoTooltip'

describe('InfoTooltip', () => {
  it('exposes the explanatory text as an accessible label', () => {
    render(<InfoTooltip text="Explains how this field works" />)
    expect(screen.getByLabelText('Explains how this field works')).toBeInTheDocument()
  })

  it('is focusable via keyboard', () => {
    render(<InfoTooltip text="Some hint" />)
    expect(screen.getByLabelText('Some hint')).toHaveAttribute('tabIndex', '0')
  })
})
