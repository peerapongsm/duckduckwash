import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Expense } from '../../../shared/types'

const CATS = ['supplies', 'utilities', 'rent', 'other'] as const
const CAT_LABELS: Record<(typeof CATS)[number], string> = {
  supplies: 'Supplies', utilities: 'Utilities', rent: 'Rent', other: 'Other'
}

function localDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Expenses(): JSX.Element {
  const month = localDate().slice(0, 7)
  const [items, setItems] = useState<Expense[]>([])
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(localDate())
  const [cat, setCat] = useState<(typeof CATS)[number]>('supplies')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => {
    window.api.expenses.list(month).then((r) => setItems(r as Expense[]))
  }, [month])
  useEffect(reload, [reload])

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await window.api.expenses.create({ date, category: cat, description: note || null, amount: Number(amount) })
      setAdding(false)
      setAmount('')
      setNote('')
      reload()
    } catch (err) {
      alert('Something went wrong: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }
  async function remove(id: number): Promise<void> {
    setSaving(true)
    try {
      await window.api.expenses.remove(id)
      setConfirmDelete(null)
      reload()
    } catch (err) {
      alert('Something went wrong: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="btn btn-primary btn-lg" onClick={() => setAdding(true)}>+ Expense</button>

      {items.map((x) => (
        <div key={x.id} className="flex items-center gap-3 rounded-box bg-base-200 p-4">
          <div className="flex-1">
            <div className="text-xl font-bold">{CAT_LABELS[x.category]} · {x.amount.toLocaleString()} ฿</div>
            <div className="opacity-70">{x.date} {x.description ? `· ${x.description}` : ''}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(x.id)}>✕</button>
        </div>
      ))}

      {adding && (
        <div className="modal modal-open">
          <div className="modal-box flex flex-col gap-3">
            <input type="date" className="input input-bordered input-lg" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              {CATS.map((c) => (
                <button key={c} className={`btn btn-lg ${cat === c ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCat(c)}>
                  {CAT_LABELS[c]}
                </button>
              ))}
            </div>
            <input type="number" min="0" className="input input-bordered input-lg text-right" placeholder="Amount"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className="input input-bordered input-lg" placeholder="Note (optional)"
              value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-primary btn-lg" disabled={Number(amount) <= 0 || saving} onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="modal modal-open">
          <div className="modal-box">
            <p className="text-xl">Delete this expense?</p>
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-error btn-lg" disabled={saving} onClick={() => remove(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
