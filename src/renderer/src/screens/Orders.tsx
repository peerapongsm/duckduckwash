import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Screen } from '../App'
import type { Order, OrderStatus } from '../../../shared/types'

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

export default function Orders({ go }: { go: (s: Screen) => void }): JSX.Element {
  const [tab, setTab] = useState<OrderStatus>('waiting_input')
  const [orders, setOrders] = useState<Order[]>([])
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'close'; id: number; from: OrderStatus } | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    window.api.orders.list(tab).then((r) => setOrders(r as Order[]))
  }, [tab])
  useEffect(reload, [reload])

  async function advance(id: number, from: OrderStatus): Promise<void> {
    setBusy(true)
    try {
      await window.api.orders.advanceStatus(id, from)
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

      {orders.length === 0 && (
        <div className="rounded-box border-2 border-dashed border-base-300 p-10 text-center opacity-50">
          Nothing here right now
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
