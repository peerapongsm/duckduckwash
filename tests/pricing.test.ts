import { describe, it, expect } from 'vitest'
import { computeOrderTotal } from '../src/main/logic/pricing'

describe('computeOrderTotal', () => {
  it('sums item totals', () => {
    expect(
      computeOrderTotal([
        { quantity: 3, unit_price: 150 },  // wash/dry/fold 3kg = 450
        { quantity: 4, unit_price: 60 }    // dry clean 4 items @ custom 60 = 240
      ])
    ).toBe(690)
  })

  it('rejects empty items', () => {
    expect(() => computeOrderTotal([])).toThrow('order must have at least one item')
  })

  it('rejects non-positive quantity or price', () => {
    expect(() => computeOrderTotal([{ quantity: 0, unit_price: 100 }])).toThrow()
    expect(() => computeOrderTotal([{ quantity: 1, unit_price: 0 }])).toThrow()
  })

  it('applies a whole-order surcharge percentage', () => {
    expect(computeOrderTotal([{ quantity: 2, unit_price: 100 }], 50)).toBe(300)
    expect(computeOrderTotal([{ quantity: 2, unit_price: 100 }], 100)).toBe(400)
  })

  it('defaults the surcharge to 0', () => {
    expect(computeOrderTotal([{ quantity: 2, unit_price: 100 }])).toBe(200)
  })

  it('rejects a negative surcharge', () => {
    expect(() => computeOrderTotal([{ quantity: 1, unit_price: 100 }], -10)).toThrow()
  })
})
