import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import type { Screen } from '../App'
import type { Order, OrderGarment } from '../../../shared/types'

interface ItemRow {
  id: number
  service_key: string
  unit: 'kg' | 'item'
  pricing: 'fixed' | 'custom'
  default_price: number | null
  quantity: number | null
  unit_price: number | null
}

const SERVICE_LABELS: Record<string, string> = {
  wash_dry_fold: 'Wash / Dry / Fold',
  wash_dry_fold_iron: 'Wash / Dry / Fold / Iron',
  iron: 'Iron',
  dry_clean: 'Dry clean'
}
const GARMENT_PRESETS = ['Shirt', 'Pants', 'Shorts', 'Dress', 'Skirt', 'Blouse', 'Jacket', 'Bras', 'Underwear']

interface GarmentRow { garment: string; quantity: number; special_care: boolean }

export default function OrderDetails({ orderId, go }: { orderId: number; go: (s: Screen) => void }): JSX.Element {
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [garments, setGarments] = useState<GarmentRow[]>([])
  const [fee, setFee] = useState(20)
  const [saving, setSaving] = useState(false)
  const [knownTypes, setKnownTypes] = useState<string[]>([])
  const [customType, setCustomType] = useState('')

  useEffect(() => {
    window.api.garments.types().then((t) => setKnownTypes(t as string[]))
  }, [])

  useEffect(() => {
    window.api.orders.get(orderId).then((res) => {
      const r = res as { order: Order; items: ItemRow[]; garments: OrderGarment[] }
      setOrder(r.order)
      setItems(r.items.map((i) => ({ ...i, unit_price: i.unit_price ?? i.default_price })))
      setGarments(r.garments.map((g) => ({
        garment: g.garment, quantity: g.quantity, special_care: g.special_care === 1
      })))
    })
    window.api.settings.get('delivery_fee').then((v) => setFee(Number((v as string | null) ?? 20)))
  }, [orderId])

  const total = useMemo(() => {
    const sum = items.reduce((s, i) => s + (i.quantity ?? 0) * (i.unit_price ?? 0), 0)
    return sum + (order?.is_delivery ? fee : 0)
  }, [items, order, fee])

  const valid =
    items.every((i) => (i.quantity ?? 0) > 0 && (i.unit_price ?? 0) > 0) &&
    garments.length > 0 &&
    garments.every((g) => g.quantity >= 1)

  function updItem(id: number, patch: Partial<ItemRow>): void {
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }
  // presets first, then every name ever used on past orders (deduped, case-insensitive)
  const garmentButtons = useMemo(() => {
    const seen = new Set(GARMENT_PRESETS.map((p) => p.toLowerCase()))
    const extras = knownTypes.filter((t) => {
      const k = t.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    return [...GARMENT_PRESETS, ...extras]
  }, [knownTypes])

  function addGarment(g: string): void {
    setGarments([...garments, { garment: g, quantity: 1, special_care: false }])
  }
  function addCustomGarment(): void {
    const g = customType.trim()
    if (!g) return
    addGarment(g)
    setCustomType('')
  }
  function updGarment(idx: number, patch: Partial<GarmentRow>): void {
    setGarments(garments.map((g, i) => (i === idx ? { ...g, ...patch } : g)))
  }

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await window.api.orders.saveDetails({
        order_id: orderId,
        items: items.map((i) => ({ item_id: i.id, quantity: i.quantity!, unit_price: i.unit_price! })),
        garments
      })
      go({ name: 'orders' })
    } catch (err) {
      alert('Something went wrong: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  if (!order) return <div />

  return (
    <div className="rise mx-auto flex max-w-2xl flex-col gap-4">
      <div className="rounded-box bg-base-200/70 p-4">
        <div className="font-display text-2xl font-semibold">{order.customer_name}</div>
        <div className="mt-1 opacity-60">
          {order.customer_location ? `${order.customer_location} · ` : ''}{order.created_at}
        </div>
      </div>

      <div className="font-display text-xl font-semibold">Services</div>
      {items.map((i) => (
        <div key={i.id} className="flex items-center gap-2 rounded-box bg-base-100 p-3 shadow-soft">
          <span className="flex-1">{SERVICE_LABELS[i.service_key]}</span>
          <input
            type="number" min="0" step={i.unit === 'kg' ? '0.1' : '1'}
            className="input input-bordered w-28 text-right"
            placeholder={i.unit === 'kg' ? 'kg' : 'items'}
            value={i.quantity ?? ''}
            onChange={(e) => updItem(i.id, { quantity: Number(e.target.value) || null })}
          />
          <input
            type="number" min="0"
            className="input input-bordered w-32 text-right"
            placeholder="price/unit"
            value={i.unit_price ?? ''}
            readOnly={i.pricing === 'fixed'}
            onChange={(e) => updItem(i.id, { unit_price: Number(e.target.value) || null })}
          />
          <span className="w-24 text-right font-bold">
            {((i.quantity ?? 0) * (i.unit_price ?? 0)).toLocaleString()} ฿
          </span>
        </div>
      ))}

      <div className="font-display text-xl font-semibold">Garments <span className="text-base font-normal opacity-60">— what is in this order?</span></div>
      <div className="flex flex-wrap gap-2">
        {garmentButtons.map((g) => (
          <button key={g} className="btn btn-outline" onClick={() => addGarment(g)}>+ {g}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input input-bordered flex-1"
          placeholder="Other garment — type it (saved for next time)"
          value={customType}
          onChange={(e) => setCustomType(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addCustomGarment() }}
        />
        <button className="btn btn-outline" disabled={!customType.trim()} onClick={addCustomGarment}>+ Add</button>
      </div>
      {garments.map((g, idx) => (
        <div key={idx} className="flex items-center gap-3 rounded-box bg-base-100 p-3 shadow-soft">
          <span className="flex-1">{g.garment}</span>
          <input
            type="number" min="1"
            className="input input-bordered w-20 text-right"
            value={g.quantity}
            onChange={(e) => updGarment(idx, { quantity: Number(e.target.value) || 1 })}
          />
          <label className="label cursor-pointer gap-1">
            <input
              type="checkbox" className="checkbox checkbox-warning"
              checked={g.special_care}
              onChange={(e) => updGarment(idx, { special_care: e.target.checked })}
            />
            special care
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => setGarments(garments.filter((_, i2) => i2 !== idx))}>✕</button>
        </div>
      ))}

      <div className="rounded-box border-2 border-primary/50 bg-primary/15 p-4 text-right shadow-soft">
        <span className="mr-3 align-middle opacity-60">{order.is_delivery ? `incl. ${fee} ฿ delivery · ` : ''}Total</span>
        <span className="font-display align-middle text-5xl font-semibold">฿ {total.toLocaleString()}</span>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-lg flex-1" onClick={() => go({ name: 'orders' })}>Cancel</button>
        <button className="btn btn-primary btn-lg flex-1" disabled={!valid || saving} onClick={save}>Save details</button>
      </div>
    </div>
  )
}
