export interface PricedItem {
  quantity: number
  unit_price: number
}

export function computeOrderTotal(items: PricedItem[], isDelivery: boolean, deliveryFee: number): number {
  if (items.length === 0) throw new Error('order must have at least one item')
  for (const it of items) {
    if (it.quantity <= 0) throw new Error('quantity must be positive')
    if (it.unit_price <= 0) throw new Error('unit price must be positive')
  }
  const sum = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0)
  return sum + (isDelivery ? deliveryFee : 0)
}
