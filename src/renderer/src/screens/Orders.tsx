import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Screen } from '../App'
import type { Order, OrderStatus } from '../../../shared/types'

const TABS: { key: OrderStatus; label: string }[] = [
  { key: 'waiting_input', label: 'Waiting input' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'complete', label: 'Ready for pickup' },
  { key: 'closed', label: 'Closed' }
]

export default function Orders({ go }: { go: (s: Screen) => void }): JSX.Element {
  const [tab, setTab] = useState<OrderStatus>('waiting_input')
  const [orders, setOrders] = useState<Order[]>([])
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'close'; id: number } | null>(null)

  const reload = useCallback(() => {
    window.api.orders.list(tab).then((r) => setOrders(r as Order[]))
  }, [tab])
  useEffect(reload, [reload])

  async function advance(id: number): Promise<void> {
    await window.api.orders.advanceStatus(id)
    setConfirm(null)
    reload()
  }
  async function remove(id: number): Promise<void> {
    await window.api.orders.remove(id)
    setConfirm(null)
    reload()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="tabs-boxed tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab tab-lg ${tab === t.key ? 'tab-active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {orders.map((o) => (
        <div key={o.id} className="flex items-center gap-3 rounded-box bg-base-200 p-4">
          <div className="flex-1">
            <div className="text-xl font-bold">
              {o.customer_name} {o.customer_location ? `· ${o.customer_location}` : ''}
            </div>
            <div className="opacity-70">
              {o.created_at} · {o.total > 0 ? `${o.total.toLocaleString()} ฿` : '—'}
              {o.is_delivery ? ' · delivery' : ''}
            </div>
          </div>
          {o.status === 'waiting_input' && (
            <button className="btn btn-primary btn-lg" onClick={() => go({ name: 'orderDetails', orderId: o.id })}>
              Add details
            </button>
          )}
          {o.status === 'in_progress' && (
            <>
              <button className="btn btn-lg" onClick={() => go({ name: 'orderDetails', orderId: o.id })}>Edit</button>
              <button className="btn btn-primary btn-lg" onClick={() => advance(o.id)}>Mark complete</button>
            </>
          )}
          {o.status === 'complete' && (
            <button className="btn btn-success btn-lg" onClick={() => setConfirm({ kind: 'close', id: o.id })}>
              Close (paid & picked up)
            </button>
          )}
          {o.status !== 'closed' && (
            <button className="btn btn-ghost" onClick={() => setConfirm({ kind: 'delete', id: o.id })}>✕</button>
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
              <button className="btn btn-lg" onClick={() => setConfirm(null)}>Cancel</button>
              {confirm.kind === 'delete' ? (
                <button className="btn btn-error btn-lg" onClick={() => remove(confirm.id)}>Delete</button>
              ) : (
                <button className="btn btn-success btn-lg" onClick={() => advance(confirm.id)}>Close order</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
