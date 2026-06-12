import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Customer } from '../../../shared/types'

const EMPTY = { name: '', location: '', contact: '', notes: '' }

export default function Customers(): JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => {
    window.api.customers.list().then((r) => setCustomers(r as Customer[]))
  }, [])
  useEffect(reload, [reload])

  async function save(): Promise<void> {
    if (!form || !form.name.trim()) return
    setSaving(true)
    try {
      await window.api.customers.create({
        name: form.name, location: form.location || null, contact: form.contact || null, notes: form.notes || null
      })
      setForm(null)
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
      await window.api.customers.remove(id)
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
      <button className="btn btn-primary btn-lg lift self-start rounded-box font-display shadow-soft" onClick={() => setForm(EMPTY)}>
        ➕ Regular customer
      </button>

      {customers.length === 0 && (
        <div className="rounded-box border-2 border-dashed border-base-300 p-10 text-center opacity-50">
          No regular customers yet — walk-ins stay on their orders
        </div>
      )}

      {customers.map((c) => (
        <div key={c.id} className="lift flex items-center gap-3 rounded-box bg-base-100 p-4 shadow-soft">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/20 font-display text-xl font-semibold text-secondary">
            {c.name.trim().charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-display text-xl font-semibold">{c.name}</div>
            <div className="opacity-60">{[c.location, c.contact, c.notes].filter(Boolean).join(' · ')}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(c.id)}>✕</button>
        </div>
      ))}

      {form && (
        <div className="modal modal-open">
          <div className="modal-box flex flex-col gap-3">
            <input className="input input-bordered input-lg" placeholder="Name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input input-bordered input-lg" placeholder="Location"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <input className="input input-bordered input-lg" placeholder="Contact" maxLength={256}
              value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            <input className="input input-bordered input-lg" placeholder="Notes"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary btn-lg" disabled={!form.name.trim() || saving} onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="modal modal-open">
          <div className="modal-box">
            <p className="text-xl">Delete this customer? Past orders are kept.</p>
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
