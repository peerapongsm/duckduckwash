import { describe, it, expect } from 'vitest'
import { computeOrderTotal } from '../src/main/logic/pricing'

describe('computeOrderTotal', () => {
  it('sums item totals plus delivery', () => {
    expect(
      computeOrderTotal(
        [
          { quantity: 3, unit_price: 150 },  // wash/dry/fold 3kg = 450
          { quantity: 4, unit_price: 60 }    // dry clean 4 items @ custom 60 = 240
        ],
        true,
        20
      )
    ).toBe(710)
  })

  it('no delivery fee when not delivery', () => {
    expect(computeOrderTotal([{ quantity: 2, unit_price: 200 }], false, 20)).toBe(400)
  })

  it('rejects empty items', () => {
    expect(() => computeOrderTotal([], false, 20)).toThrow('order must have at least one item')
  })

  it('rejects non-positive quantity or price', () => {
    expect(() => computeOrderTotal([{ quantity: 0, unit_price: 100 }], false, 20)).toThrow()
    expect(() => computeOrderTotal([{ quantity: 1, unit_price: 0 }], false, 20)).toThrow()
  })
})
