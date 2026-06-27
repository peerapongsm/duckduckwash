import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import type { Screen } from '../App'
import type { Order, OrderGarment, Wearer } from '../../../shared/types'
import { formatDateTime } from '../format'

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
// Per-wearer clothing types, prefilled from the aunt's "PEE cloth type" spreadsheet
// (columns MAN / LADY / KID UNISEX). Bedding + towels sit under MAN as in the sheet.
const WEARER_PRESETS: Record<Wearer, string[]> = {
  male: ['SHIRTS-S', 'SHIRTS-L', 'POLO', 'POLO-L', 'TSHIRTS', 'TSHIRTS-L', 'JACKET', 'SWEATER', 'U/SHIRTS', 'JEANS', 'SHORTS', 'TROUSERS', 'U/PANTS', 'SOCKS', 'BOXERS', 'HANDKERCHIEF', 'SARONG', 'LONGDRESS', 'TOWEL-L', 'TOWEL-M', 'TOWEL-S', 'BEDSHEET', 'BLANKET', 'DUVET', 'PILLOW CASE', 'BLANKET COVER'],
  female: ['BLOUSE', 'BLOUSE-L', 'JACKET', 'SKIRT', 'SKIRT-L', 'DRESS', 'JUMPSUIT', 'TSHIRTS-S', 'TSHIRTS-L', 'U/SHIRTS', 'TROUSERS', 'JEANS', 'SHORTS', 'BRA', 'U/PANTS', 'SOCKS', 'SCARF', 'LONGDRESS'],
  child: ['TSHIRTS', 'SHIRTS', 'SHORTS', 'TROUSERS', 'BLOUSE', 'SKIRT', 'DRESS', 'TOWEL', 'U/PANTS', 'SOCKS']
}
const PRESET_KEYS = new Set(Object.values(WEARER_PRESETS).flat().map((g) => g.toLowerCase()))
const WEARERS: { key: Wearer; label: string }[] = [
  { key: 'male', label: '👨 Male' },
  { key: 'female', label: '👩 Female' },
  { key: 'child', label: '🧒 Child' }
]

interface GarmentRow { garment: string; quantity: number; special_care: boolean; wearer: Wearer }
interface Cell { quantity: number; special_care: boolean }

const cellKey = (w: Wearer, g: string): string => `${w}|||${g}`

export default function OrderDetails({ orderId, go }: { orderId: number; go: (s: Screen) => void }): JSX.Element {
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  // extra garment names beyond the per-wearer presets (custom-added or from old orders)
  const [extraTypes, setExtraTypes] = useState<string[]>([])
  const [cells, setCells] = useState<Record<string, Cell>>({})
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<Record<Wearer, string>>({ male: '', female: '', child: '' })
  const [delivery, setDelivery] = useState(false)
  const [surchargeAmount, setSurchargeAmount] = useState(0)
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local
  const [orderDate, setOrderDate] = useState('')

  // add names that aren't already a preset or a known extra (case-insensitive)
  function addExtras(names: string[]): void {
    setExtraTypes((cur) => {
      const seen = new Set([...PRESET_KEYS, ...cur.map((t) => t.toLowerCase())])
      const out = [...cur]
      for (const t of names) {
        const k = t.toLowerCase()
        if (!seen.has(k)) {
          seen.add(k)
          out.push(t)
        }
      }
      return out
    })
  }

  useEffect(() => {
    window.api.garments.types().then((t) => addExtras(t as string[]))
  }, [])

  useEffect(() => {
    window.api.orders.get(orderId).then((res) => {
      const r = res as { order: Order; items: ItemRow[]; garments: OrderGarment[] }
      setOrder(r.order)
      setDelivery(r.order.is_delivery === 1)
      setSurchargeAmount(r.order.surcharge_amount ?? 0)
      setOrderDate((r.order.created_at ?? '').slice(0, 10))
      setItems(r.items.map((i) => ({ ...i, unit_price: i.unit_price ?? i.default_price })))
      const c: Record<string, Cell> = {}
      for (const g of r.garments)
        c[cellKey(g.wearer ?? 'female', g.garment)] = { quantity: g.quantity, special_care: g.special_care === 1 }
      setCells(c)
      // make sure any non-preset garment already on this order shows up as a row
      addExtras(r.garments.map((g) => g.garment))
    })
  }, [orderId])

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (i.quantity ?? 0) * (i.unit_price ?? 0), 0),
    [items]
  )
  const total = useMemo(() => subtotal + (surchargeAmount || 0), [subtotal, surchargeAmount])

  // every cell with a quantity becomes a garment row to save
  const filledGarments = useMemo<GarmentRow[]>(() => {
    const out: GarmentRow[] = []
    for (const [k, v] of Object.entries(cells)) {
      if (v.quantity > 0) {
        const [wearer, garment] = k.split('|||')
        out.push({ garment, quantity: v.quantity, special_care: v.special_care, wearer: wearer as Wearer })
      }
    }
    return out
  }, [cells])

  const valid =
    items.every((i) => (i.quantity ?? 0) > 0 && (i.unit_price ?? 0) > 0) &&
    filledGarments.length > 0

  function updItem(id: number, patch: Partial<ItemRow>): void {
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }
  function setCell(w: Wearer, g: string, patch: Partial<Cell>): void {
    const k = cellKey(w, g)
    setCells((cur) => {
      const prev = cur[k] ?? { quantity: 0, special_care: false }
      return { ...cur, [k]: { ...prev, ...patch } }
    })
  }
  function addSectionType(w: Wearer): void {
    const g = drafts[w].trim()
    if (!g) return
    addExtras([g])
    setDrafts((d) => ({ ...d, [w]: '' }))
  }

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await window.api.orders.saveDetails({
        order_id: orderId,
        is_delivery: delivery,
        surcharge_amount: surchargeAmount || 0,
        created_at:
          orderDate && orderDate !== (order?.created_at ?? '').slice(0, 10) ? orderDate : null,
        items: items.map((i) => ({ item_id: i.id, quantity: i.quantity!, unit_price: i.unit_price! })),
        garments: filledGarments
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
          {order.customer_location ? `${order.customer_location} · ` : ''}{formatDateTime(order.created_at)}
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-box bg-base-200/70 px-4 py-3">
        <span className="text-sm opacity-70">📅 Order date</span>
        <input
          type="date" max={today}
          className="input input-bordered w-full"
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
        />
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

      <div className="font-display text-xl font-semibold">
        Garments <span className="text-base font-normal opacity-60">— type how many of each</span>
      </div>
      {WEARERS.map((w) => {
        const count = filledGarments
          .filter((fg) => fg.wearer === w.key)
          .reduce((s, fg) => s + fg.quantity, 0)
        // preset rows for this wearer, plus any extra/legacy garment it already has
        const seen = new Set<string>()
        const rows: string[] = []
        for (const g of [...WEARER_PRESETS[w.key], ...extraTypes]) {
          const k = g.toLowerCase()
          if (!seen.has(k)) { seen.add(k); rows.push(g) }
        }
        for (const key of Object.keys(cells)) {
          const [cw, g] = key.split('|||')
          if (cw === w.key && !seen.has(g.toLowerCase())) { seen.add(g.toLowerCase()); rows.push(g) }
        }
        return (
          <details
            key={w.key}
            open={w.key === 'male'}
            className="collapse collapse-arrow rounded-box bg-base-100 shadow-soft"
          >
            <summary className="collapse-title font-display flex items-center gap-2 text-lg font-semibold">
              {w.label}
              {count > 0 && <span className="badge badge-primary">{count}</span>}
            </summary>
            <div className="collapse-content">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rows.map((g) => {
                  const c = cells[cellKey(w.key, g)]
                  const qty = c?.quantity ?? 0
                  const isSocks = g.toLowerCase() === 'socks'
                  return (
                    <div
                      key={g}
                      className={`flex items-center gap-2 rounded-box px-3 py-2 ${qty > 0 ? 'bg-base-200' : ''}`}
                    >
                      <span className="flex-1">{g}</span>
                      {qty > 0 && (
                        <label className="label cursor-pointer gap-1 p-0" title="special care">
                          <input
                            type="checkbox" className="checkbox checkbox-warning checkbox-sm"
                            checked={c?.special_care ?? false}
                            onChange={(e) => setCell(w.key, g, { special_care: e.target.checked })}
                          />
                          <span className="text-xs opacity-70">care</span>
                        </label>
                      )}
                      <input
                        type="number"
                        min={isSocks ? '0.5' : '0'}
                        step={isSocks ? '0.5' : '1'}
                        className="input input-bordered w-20 text-right"
                        placeholder="0"
                        value={qty || ''}
                        onChange={(e) => {
                          const raw = Number(e.target.value) || 0
                          const q = isSocks ? Math.max(0, raw) : Math.max(0, Math.floor(raw))
                          setCell(w.key, g, { quantity: q })
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="input input-bordered input-sm flex-1"
                  placeholder="Other clothing type (e.g. headband)"
                  value={drafts[w.key]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [w.key]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSectionType(w.key) }}
                />
                <button
                  className="btn btn-outline btn-sm"
                  disabled={!drafts[w.key].trim()}
                  onClick={() => addSectionType(w.key)}
                >+ Add</button>
              </div>
            </div>
          </details>
        )
      })}

      <label className="label cursor-pointer justify-start gap-3 rounded-box bg-base-200/70 px-4">
        <input
          type="checkbox"
          className="toggle toggle-secondary toggle-lg"
          checked={delivery}
          onChange={(e) => setDelivery(e.target.checked)}
        />
        <span>🛵 Delivery — turn off if the customer picks up instead</span>
      </label>

      <div className="flex flex-col gap-1 rounded-box bg-base-200/70 px-4 py-3">
        <span className="text-sm opacity-70">⚡ Urgent surcharge (฿) — leave 0 for normal orders</span>
        <input
          type="number" min="0" step="any"
          className="input input-bordered w-full"
          placeholder="0"
          value={surchargeAmount || ''}
          onChange={(e) => setSurchargeAmount(Math.max(0, Number(e.target.value) || 0))}
        />
      </div>

      <div className="rounded-box border-2 border-primary/50 bg-primary/15 p-4 text-right shadow-soft">
        {surchargeAmount > 0 && (
          <div className="text-sm opacity-70">
            Subtotal {subtotal.toLocaleString()} ฿ + {surchargeAmount.toLocaleString()} ฿ urgent
          </div>
        )}
        <span className="mr-3 align-middle opacity-60">Total</span>
        <span className="font-display align-middle text-5xl font-semibold">฿ {Math.round(total).toLocaleString()}</span>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-lg flex-1" onClick={() => go({ name: 'orders' })}>Cancel</button>
        <button className="btn btn-primary btn-lg flex-1" disabled={!valid || saving} onClick={save}>Save details</button>
      </div>
    </div>
  )
}
