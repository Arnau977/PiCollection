// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { __resetEntityListCachesForTests } from '../../hooks/useEntityLists'
import { AutoTagsSection } from './AutoTagsSection'

const setRule = vi.fn()
let rules = [{ property: 'transparent', tagId: 'clear' }]

beforeEach(() => {
  __resetEntityListCachesForTests()
  rules = [{ property: 'transparent', tagId: 'clear' }]
  setRule.mockReset().mockImplementation(async ({ property, tagId }) => {
    rules = rules.filter((rule) => rule.property !== property)
    if (tagId) rules.push({ property, tagId })
    return { success: true, data: undefined }
  })
  Object.defineProperty(window, 'api', {
    value: {
      tag: {
        getAll: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { id: 'clear', name: 'Transparent background', createdAt: 1 },
            { id: 'tall', name: 'Vertical', createdAt: 1 }
          ]
        })
      },
      autoTags: {
        getStatus: vi.fn(async () => ({ success: true, data: { rules, unanalyzed: 3 } })),
        setRule
      }
    },
    writable: true,
    configurable: true
  })
})

describe('AutoTagsSection', () => {
  it('shows each rule, saves a picked tag and turns a rule off', async () => {
    render(<AutoTagsSection />)

    const transparency = await screen.findByRole('combobox', { name: 'Tag for Transparency' })
    await waitFor(() => expect(transparency).toHaveValue('Transparent background'))
    expect(screen.getByText('Longest side 3840 px or more')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('3 pictures left')

    await userEvent.type(screen.getByRole('combobox', { name: 'Tag for Portrait' }), 'Vert')
    await userEvent.click(await screen.findByRole('option', { name: 'Vertical' }))
    expect(setRule).toHaveBeenCalledWith({ property: 'portrait', tagId: 'tall' })

    await userEvent.click(screen.getByRole('button', { name: 'Turn off Transparency' }))
    expect(setRule).toHaveBeenCalledWith({ property: 'transparent', tagId: null })
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Turn off Transparency' })
      ).not.toBeInTheDocument()
    )
  })
})
