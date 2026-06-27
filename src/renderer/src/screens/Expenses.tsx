import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Expense } from '../../../shared/types'
import DataIO from '../components/DataIO'
import { formatDate } from '../format'

const CATS = ['supplies', 'utilities', 'rent', 'food', 'salary', 'other'] as const
const CAT_LABELS: Record<(typeof CATS)[number], string> = {
  supplies: 'Supplies', utilities: 'Utilities', rent: 'Rent', food: 'Food', salary: 'Salary', other: 'Other'
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function localDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

// Bounds for the add-expense date picker so a newly added expense always lands
// in the month currently being viewed (and never in the future).
function monthBounds(ym: string): { min: string; max: string; default: string } {
  const today = localDate()
  const isCurrent = ym === today.slice(0, 7)
  const [y, m] = ym.split('-').map(Number)
  const lastDay = String(new Date(y, m, 0).getDate()).padStart(2, '0')
  const min = `${ym}-01`
  const max = isCurrent ? today : `${ym}-${lastDay}`
  return { min, max, default: isCurrent ? today : min }
}

interface RowInput {
  category: (typeof CATS)[number]
  amount: string
  note: string
}
const NEW_ROW: RowInput = { category: 'supplies', amount: '', note: '' }

export default function Expenses(): JSX.Element {
  const currentMonth = localDate().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const [items, setItems] = useState<Expense[]>([])
  const [rows, setRows] = useState<RowInput[] | null>(null)
  const [date, setDate] = useState(localDate())
  const [editing, setEditing] = useState<Expense | null>(null)
  const [edit, setEdit] = useState<{ date: string; category: (typeof CATS)[number]; amount: string; note: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => {
    window.api.expenses.list(month).then((r) => setItems(r as Expense[]))
  }, [month])
  useEffect(reload, [reload])

  const isCurrentMonth = month === currentMonth
  const bounds = monthBounds(month)
  const rowsValid = rows !== null && rows.length > 0 && rows.every((r) => Number(r.amount) > 0)

  function openAdd(): void {
    setDate(bounds.default)
    setRows([{ ...NEW_ROW }])
  }

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
  function openEdit(x: Expense): void {
    setEditing(x)
    setEdit({ date: x.date, category: x.category, amount: String(x.amount), note: x.description ?? '' })
  }
  async function saveEdit(): Promise<void> {
    if (!editing || !edit) return
    setSaving(true)
    try {
      await window.api.expenses.update({
        id: editing.id, date: edit.date, category: edit.category,
        description: edit.note || null, amount: Number(edit.amount)
      })
      setEditing(null)
      setEdit(null)
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
      {/* Month navigator — view and edit expenses for any month, not just the current one */}
      <div className="flex items-center justify-between gap-2 rounded-box bg-base-100 p-2 shadow-soft">
        <button className="btn btn-ghost btn-lg text-2xl" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          ←
        </button>
        <div className="font-display text-2xl font-semibold">{monthLabel(month)}</div>
        <button
          className="btn btn-ghost btn-lg text-2xl"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={isCurrentMonth}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="btn btn-primary btn-lg lift rounded-box font-display shadow-soft" onClick={openAdd}>
          ➕ Expense
        </button>
        <DataIO kind="expenses" onImported={reload} />
      </div>

      {items.length === 0 && (
        <div className="rounded-box border-2 border-dashed border-base-300 p-10 text-center opacity-50">
          No expenses for {monthLabel(month)}
        </div>
      )}

      {items.map((x) => (
        <div key={x.id} className="lift flex items-center gap-3 rounded-box bg-base-100 p-4 shadow-soft">
          <div className="flex-1">
            <div className="font-display text-xl font-semibold">
              {CAT_LABELS[x.category]} · <span className="text-error">฿ {x.amount.toLocaleString()}</span>
            </div>
            <div className="opacity-60">{formatDate(x.date)} {x.description ? `· ${x.description}` : ''}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => openEdit(x)}>✏️</button>
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(x.id)}>✕</button>
        </div>
      ))}

      {rows && (
        <div className="modal modal-open">
          <div className="modal-box flex max-w-2xl flex-col gap-3">
            <input type="date" className="input input-bordered input-lg" value={date} min={bounds.min} max={bounds.max} onChange={(e) => setDate(e.target.value)} />
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

      {edit && (
        <div className="modal modal-open">
          <div className="modal-box flex max-w-2xl flex-col gap-3">
            <h3 className="font-display text-xl font-semibold">Edit expense</h3>
            <input type="date" className="input input-bordered input-lg" value={edit.date} min={bounds.min} max={bounds.max}
              onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
            <div className="flex items-center gap-2">
              <select className="select select-bordered select-lg" value={edit.category}
                onChange={(e) => setEdit({ ...edit, category: e.target.value as (typeof CATS)[number] })}>
                {CATS.map((c) => (
                  <option key={c} value={c}>{CAT_LABELS[c]}</option>
                ))}
              </select>
              <input type="number" min="0" className="input input-bordered input-lg w-32 text-right" placeholder="Amount"
                value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} />
              <input className="input input-bordered input-lg flex-1" placeholder="Note (optional)"
                value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            </div>
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => { setEditing(null); setEdit(null) }}>Cancel</button>
              <button className="btn btn-primary btn-lg" disabled={!(Number(edit.amount) > 0) || saving} onClick={saveEdit}>Save</button>
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
