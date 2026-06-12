import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Expense } from '../../../shared/types'

const CATS = ['supplies', 'utilities', 'rent', 'food', 'salary', 'other'] as const
const CAT_LABELS: Record<(typeof CATS)[number], string> = {
  supplies: 'Supplies', utilities: 'Utilities', rent: 'Rent', food: 'Food', salary: 'Salary', other: 'Other'
}

function localDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface RowInput {
  category: (typeof CATS)[number]
  amount: string
  note: string
}
const NEW_ROW: RowInput = { category: 'supplies', amount: '', note: '' }

export default function Expenses(): JSX.Element {
  const month = localDate().slice(0, 7)
  const [items, setItems] = useState<Expense[]>([])
  const [rows, setRows] = useState<RowInput[] | null>(null)
  const [date, setDate] = useState(localDate())
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => {
    window.api.expenses.list(month).then((r) => setItems(r as Expense[]))
  }, [month])
  useEffect(reload, [reload])

  const rowsValid = rows !== null && rows.length > 0 && rows.every((r) => Number(r.amount) > 0)

  function updRow(idx: number, patch: Partial<RowInput>): void {
    if (rows) setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  async function save(): Promise<void> {
    if (!rows) return
    setSaving(true)
    try {
      await window.api.expenses.createMany(
        rows.map((r) => ({ date, category: r.category, description: r.note || null, amount: Number(r.amount) }))
      )
      setRows(null)
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
    <div className="rise flex flex-col gap-4">
      <button className="btn btn-primary btn-lg lift self-start rounded-box font-display shadow-soft" onClick={() => setRows([{ ...NEW_ROW }])}>
        ➕ Expense
      </button>

      {items.length === 0 && (
        <div className="rounded-box border-2 border-dashed border-base-300 p-10 text-center opacity-50">
          No expenses recorded this month
        </div>
      )}

      {items.map((x) => (
        <div key={x.id} className="lift flex items-center gap-3 rounded-box bg-base-100 p-4 shadow-soft">
          <div className="flex-1">
            <div className="font-display text-xl font-semibold">
              {CAT_LABELS[x.category]} · <span className="text-error">฿ {x.amount.toLocaleString()}</span>
            </div>
            <div className="opacity-60">{x.date} {x.description ? `· ${x.description}` : ''}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(x.id)}>✕</button>
        </div>
      ))}

      {rows && (
        <div className="modal modal-open">
          <div className="modal-box flex max-w-2xl flex-col gap-3">
            <input type="date" className="input input-bordered input-lg" value={date} onChange={(e) => setDate(e.target.value)} />
            {rows.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select className="select select-bordered select-lg" value={r.category}
                  onChange={(e) => updRow(idx, { category: e.target.value as RowInput['category'] })}>
                  {CATS.map((c) => (
                    <option key={c} value={c}>{CAT_LABELS[c]}</option>
                  ))}
                </select>
                <input type="number" min="0" className="input input-bordered input-lg w-32 text-right" placeholder="Amount"
                  value={r.amount} onChange={(e) => updRow(idx, { amount: e.target.value })} />
                <input className="input input-bordered input-lg flex-1" placeholder="Note (optional)"
                  value={r.note} onChange={(e) => updRow(idx, { note: e.target.value })} />
                {rows.length > 1 && (
                  <button className="btn btn-ghost" onClick={() => setRows(rows.filter((_, i) => i !== idx))}>✕</button>
                )}
              </div>
            ))}
            <button className="btn btn-outline btn-lg" onClick={() => setRows([...rows, { ...NEW_ROW }])}>
              ➕ Add another
            </button>
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setRows(null)}>Cancel</button>
              <button className="btn btn-primary btn-lg" disabled={!rowsValid || saving} onClick={save}>
                Save{rows.length > 1 ? ` (${rows.length})` : ''}
              </button>
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
