import { describe, expect, it } from 'vitest'
import { fuzzyFilter, fuzzyScore } from './fuzzyMatch'

const names = ['Pyra (Xenoblade)', 'Mythra (Xenoblade)', 'Nia (Xenoblade)', 'Pokémon', 'Cat']

describe('fuzzyFilter', () => {
  it('ignores parentheses, underscores, case and word order', () => {
    expect(fuzzyFilter(names, 'pyra xenoblade', (n) => n)).toEqual(['Pyra (Xenoblade)'])
    expect(fuzzyFilter(names, 'xenoblade_pyra', (n) => n)).toEqual(['Pyra (Xenoblade)'])
  })

  it('ignores accents', () => {
    expect(fuzzyFilter(names, 'pokemon', (n) => n)).toEqual(['Pokémon'])
  })

  it('tolerates a typo, including in a half-typed word, and a swapped pair of letters', () => {
    expect(fuzzyFilter(names, 'mytra', (n) => n)).toEqual(['Mythra (Xenoblade)'])
    expect(fuzzyFilter(names, 'mytr', (n) => n)).toEqual(['Mythra (Xenoblade)'])
    expect(fuzzyFilter(names, 'pyar', (n) => n)).toEqual(['Pyra (Xenoblade)'])
  })

  it('needs short words to match exactly', () => {
    expect(fuzzyFilter(names, 'cot', (n) => n)).toEqual([])
  })

  it('ranks exact and prefix matches above substring and typo matches', () => {
    const items = ['Tail', 'Cat tail', 'Cocktail', 'Tails']
    expect(fuzzyFilter(items, 'tail', (n) => n)).toEqual(['Tail', 'Tails', 'Cat tail', 'Cocktail'])
    expect(fuzzyScore('Nia (Xenoblade)', 'nia')!).toBeGreaterThan(fuzzyScore('Mythra', 'mytrha')!)
  })
})
