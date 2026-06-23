import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Screen } from '../App'
import type { Order, OrderStatus } from '../../../shared/types'
import DataIO from '../components/DataIO'

const TABS: { key: OrderStatus; label: string; icon: string }[] = [
  { key: 'waiting_input', label: 'Waiting input', icon: '📝' },
  { key: 'in_progress', label: 'In progress', icon: '🫧' },
  { key: 'complete', label: 'Ready for pickup', icon: '✅' },
  { key: 'closed', label: 'Closed', icon: '🗂️' }
]

const STATUS_EDGE: Record<OrderStatus, string> = {
  waiting_input: 'border-l-warning',
  in_progress: 'border-l-secondary',
  complete: 'border-l-success',
  closed: 'border-l-base-300'
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Date-range presets. "All dates" (empty bounds) clears the filter and shows
// every order in the tab — the default, so current work is never hidden by a date.
function presetRanges(): { label: string; from: string; to: string }[] {
  const now = new Date()
  const today = fmt(now)
  return [
    { label: 'All dates', from: '', to: '' },
    { label: 'Today', from: today, to: today },
    { label: 'This month', from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: today },
    { label: 'This year', from: fmt(new Date(now.getFullYear(), 0, 1)), to: today }
  ]
}

export default function Orders({ go }: { go: (s: Screen) => void }): JSX.Element {
  const presets = presetRanges()
  const [tab, setTab] = useState<OrderStatus>('waiting_input')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'close'; id: number; from: OrderStatus } | null>(null)
  const [busy, setBusy] = useState(false)

  const filtered = from !== '' || to !== ''
  const invalidRange = from !== '' && to !== '' && from > to

  const reload = useCallback(() => {
    if (from !== '' && to !== '' && from > to) {
      setOrders([]) // start date after end date — show nothing until fixed
      return
    }
    window.api.orders.list(tab, from, to).then((r) => setOrders(r as Order[]))
  }, [tab, from, to])
  useEffect(reload, [reload])

  async function advance(id: number, fromStatus: OrderStatus): Promise<void> {
    setBusy(true)
    try {
      await window.api.orders.advanceStatus(id, fromStatus)
      setConfirm(null)
      reload()
    } catch (err) {
      alert('Something went wrong: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }
  async function remove(id: number): Promise<void> {
    setBusy(true)
    try {
      await window.api.orders.remove(id)
      setConfirm(null)
      reload()
    } catch (err) {
      alert('Something went wrong: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rise flex flex-col gap-4">
      <div className="flex justify-end">
        <DataIO kind="orders" onImported={reload} />
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn font-display font-medium ${tab === t.key ? 'btn-neutral shadow-soft' : 'btn-ghost bg-base-200'}`}
            onClick={() => setTab(t.key)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-box bg-base-100 p-3 shadow-soft">
        <span className="font-display font-medium opacity-60">📅 Date</span>
        {presets.map((p) => (
          <button
            key={p.label}
            className={`btn btn-sm font-display font-medium ${from === p.from && to === p.to ? 'btn-neutral shadow-soft' : 'btn-ghost bg-base-200'}`}
            onClick={() => { setFrom(p.from); setTo(p.to) }}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-1 flex items-center gap-2">
          <input type="date" className="input input-bordered input-sm shadow-soft" value={from} max={to || undefined}
            onChange={(e) => setFrom(e.target.value)} />
          <span className="opacity-60">to</span>
          <input type="date" className="input input-bordered input-sm shadow-soft" value={to} min={from || undefined}
            onChange={(e) => setTo(e.target.value)} />
        </div>
        {filtered && (
          <button className="btn btn-sm btn-ghost" onClick={() => { setFrom(''); setTo('') }}>✕ Clear</button>
        )}
      </div>

      {invalidRange && (
        <div className="rounded-box bg-error/10 p-4 text-error">Start date is after end date</div>
      )}

      {orders.length === 0 && !invalidRange && (
        <div className="rounded-box border-2 border-dashed border-base-300 p-10 text-center opacity-50">
          {filtered ? 'No orders in this date range' : 'Nothing here right now'}
        </div>
      )}

      {orders.map((o) => (
        <div key={o.id} className={`lift flex items-center gap-3 rounded-box border-l-8 ${STATUS_EDGE[o.status]} bg-base-100 p-4 shadow-soft`}>
          <div className="flex-1">
            <div className="font-display text-xl font-semibold">
              {o.customer_name}
              {o.customer_location ? <span className="ml-2 badge badge-ghost badge-lg align-middle">{o.customer_location}</span> : null}
              {o.is_delivery ? <span className="ml-2 badge badge-secondary badge-lg align-middle">🛵 delivery</span> : null}
            </div>
            <div className="mt-1 opacity-60">
              {o.created_at} · {o.total > 0 ? <b className="text-base-content">฿ {o.total.toLocaleString()}</b> : '—'}
            </div>
          </div>
          {o.status === 'waiting_input' && (
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => go({ name: 'orderDetails', orderId: o.id })}>
              Add details
            </button>
          )}
          {o.status === 'in_progress' && (
            <>
              <button className="btn btn-lg" disabled={busy} onClick={() => go({ name: 'orderDetails', orderId: o.id })}>Edit</button>
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => advance(o.id, 'in_progress')}>Mark complete</button>
            </>
          )}
          {o.status === 'complete' && (
            <>
              <button className="btn btn-lg" disabled={busy} onClick={() => go({ name: 'orderDetails', orderId: o.id })}>Edit</button>
              <button className="btn btn-success btn-lg" disabled={busy} onClick={() => setConfirm({ kind: 'close', id: o.id, from: 'complete' })}>
                Close (paid & picked up)
              </button>
            </>
          )}
          {o.status === 'closed' && (
            <button className="btn btn-lg" disabled={busy} onClick={() => go({ name: 'orderDetails', orderId: o.id })}>Edit</button>
          )}
          {o.status !== 'closed' && (
            <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirm({ kind: 'delete', id: o.id, from: o.status })}>✕</button>
          )}
        </div>
      ))}

      {confirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <p className="text-xl">
              {confirm.kind === 'delete' ? 'Delete this order?' : 'Customer paid and picked up — close this order?'}
            </p>
            <div className="modal-action">
              <button className="btn btn-lg" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              {confirm.kind === 'delete' ? (
                <button className="btn btn-error btn-lg" disabled={busy} onClick={() => remove(confirm.id)}>Delete</button>
              ) : (
                <button className="btn btn-success btn-lg" disabled={busy} onClick={() => advance(confirm.id, 'complete')}>Close order</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
