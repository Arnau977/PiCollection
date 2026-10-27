import { describe, expect, it } from 'vitest'
import { detectCharacterParent } from './detectCharacterParent'

const goldShip = { id: 'g', name: 'Gold ship (Umamusume)' }
const asunaSao = { id: 'a', name: 'Asuna' }
const plainGoldShip = { id: 'p', name: 'Gold Ship' }
const series = [{ name: 'Umamusume' }, { name: 'Blue Archive' }]

describe('detectCharacterParent', () => {
  it('finds the base kept with its series qualifier, or bare', () => {
    expect(
      detectCharacterParent('gold ship (run! ruin! launcher!) (Umamusume)', [goldShip], series)
    ).toBe(goldShip)
    expect(detectCharacterParent('Gold Ship (Summer)', [plainGoldShip], series)).toBe(plainGoldShip)
  })

  it('reads a lone series qualifier as the series, not a form', () => {
    expect(detectCharacterParent('Asuna (Blue Archive)', [asunaSao], series)).toBeNull()
  })

  it('needs an existing base and a qualifier', () => {
    expect(detectCharacterParent('Gold Ship (Summer)', [asunaSao], series)).toBeNull()
    expect(detectCharacterParent('Gold Ship', [plainGoldShip], series)).toBeNull()
  })
})
