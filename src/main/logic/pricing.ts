export interface PricedItem {
  quantity: number
  unit_price: number
}

export function computeOrderTotal(items: PricedItem[], surchargeAmount = 0): number {
  if (items.length === 0) throw new Error('order must have at least one item')
  for (const it of items) {
    if (it.quantity <= 0) throw new Error('quantity must be positive')
    if (it.unit_price <= 0) throw new Error('unit price must be positive')
  }
  if (surchargeAmount < 0) throw new Error('surcharge must not be negative')
  const subtotal = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0)
  return subtotal + surchargeAmount
}
