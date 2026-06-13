import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Screen } from '../App'
import type { Customer, Service } from '../../../shared/types'

type Suggestion = Customer & { last_order: string | null }

const SERVICE_LABELS: Record<string, string> = {
  wash_dry_fold: 'Wash / Dry / Fold',
  wash_dry_fold_iron: 'Wash / Dry / Fold / Iron',
  iron: 'Iron',
  dry_clean: 'Dry clean'
}

export default function NewOrder({ go }: { go: (s: Screen) => void }): JSX.Element {
  const [services, setServices] = useState<Service[]>([])
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [contact, setContact] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [delivery, setDelivery] = useState(false)
  const [saving, setSaving] = useState(false)
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local
  const [orderDate, setOrderDate] = useState(today)

  useEffect(() => {
    window.api.services.list().then((s) => setServices(s as Service[]))
  }, [])

  useEffect(() => {
    if (customerId !== null || name.trim().length < 2) {
      setSuggestions([])
      return
    }
    window.api.customers.search(name.trim()).then((r) => setSuggestions(r as Suggestion[]))
  }, [name, customerId])

  const valid = name.trim() !== '' && selected.length > 0

  function toggleService(id: number): void {
    setSelected(selected.includes(id) ? [] : [id])
  }
  function pick(c: Suggestion): void {
    setCustomerId(c.id)
    setName(c.name)
    setLocation(c.location ?? '')
    setContact(c.contact ?? '')
    setSuggestions([])
  }
  async function save(): Promise<void> {
    setSaving(true)
    try {
      await window.api.orders.intake({
        customer_id: customerId,
        customer_name: name.trim(),
        customer_location: location.trim() || null,
        customer_contact: contact.trim() || null,
        is_delivery: delivery,
        service_ids: selected,
        notes: null,
        // only backdate when the picked day isn't today, so normal orders keep their real time
        created_at: orderDate && orderDate !== today ? orderDate : null
      })
      go({ name: 'home' })
    } catch (err) {
      alert('Something went wrong: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rise mx-auto flex max-w-2xl flex-col gap-4">
      <div className="relative">
        <input
          className="input input-bordered input-lg w-full"
          placeholder="Customer name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setCustomerId(null)
          }}
        />
        {suggestions.length > 0 && (
          <ul className="menu absolute z-10 w-full rounded-box bg-base-200 shadow">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button onClick={() => pick(c)}>
                  <b>{c.name}</b> {c.location ?? ''} {c.contact ?? ''}{' '}
                  {c.last_order ? `· last ${c.last_order.slice(0, 10)}` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        className="input input-bordered input-lg w-full"
        placeholder="Room / Hotel (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <input
        className="input input-bordered input-lg w-full"
        placeholder="Contact (optional)"
        maxLength={256}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />
      {customerId === null && name.trim() !== '' && (
        <div className="text-sm opacity-60">Walk-in names are not saved as regular customers</div>
      )}

      <div className="font-display text-xl font-semibold">Services</div>
      <div className="grid grid-cols-2 gap-3">
        {services.map((s) => (
          <button
            key={s.id}
            className={`btn btn-lg lift h-20 rounded-box font-display text-lg font-medium ${
              selected.includes(s.id) ? 'btn-primary shadow-soft' : 'btn-outline border-2 border-base-300 bg-base-100'
            }`}
            onClick={() => toggleService(s.id)}
          >
            {selected.includes(s.id) ? '✓ ' : ''}{SERVICE_LABELS[s.key]}
          </button>
        ))}
      </div>

      <label className="label cursor-pointer justify-start gap-3 rounded-box bg-base-200/70 px-4">
        <input
          type="checkbox"
          className="toggle toggle-secondary toggle-lg"
          checked={delivery}
          onChange={(e) => setDelivery(e.target.checked)}
        />
        <span>🛵 Delivery</span>
      </label>

      <div className="flex flex-col gap-1 rounded-box bg-base-200/70 px-4 py-3">
        <span className="text-sm opacity-70">📅 Order date — leave as today for new orders</span>
        <input
          type="date"
          className="input input-bordered input-lg w-full"
          max={today}
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button className="btn btn-lg flex-1" onClick={() => go({ name: 'home' })}>
          Cancel
        </button>
        <button className="btn btn-primary btn-lg flex-1" disabled={!valid || saving} onClick={save}>
          Create order
        </button>
      </div>
    </div>
  )
}
