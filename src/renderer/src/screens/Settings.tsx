import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Service } from '../../../shared/types'

const SERVICE_LABELS: Record<string, string> = {
  wash_dry_fold: 'Wash / Dry / Fold',
  wash_dry_fold_iron: 'Wash / Dry / Fold / Iron',
  iron: 'Iron',
  dry_clean: 'Dry clean'
}

export default function Settings(): JSX.Element {
  const [services, setServices] = useState<Service[]>([])
  const [backedUp, setBackedUp] = useState(false)

  useEffect(() => {
    window.api.services.list().then((s) => setServices(s as Service[]))
  }, [])

  async function savePrice(id: number, price: number): Promise<void> {
    if (price <= 0) return
    try {
      await window.api.services.updatePrice({ id, default_price: price })
    } catch (err) {
      alert('Something went wrong: ' + (err instanceof Error ? err.message : String(err)))
    }
  }
  async function runBackup(): Promise<void> {
    try {
      await window.api.backup.run()
      setBackedUp(true)
      setTimeout(() => setBackedUp(false), 3000)
    } catch (err) {
      alert('Something went wrong: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <div className="rise mx-auto flex max-w-xl flex-col gap-6">
      <div className="rounded-box bg-base-100 p-5 shadow-soft">
        <div className="mb-3 font-display text-xl font-semibold">💸 Price list (THB)</div>
        {services.filter((s) => s.pricing === 'fixed').map((s) => (
          <label key={s.id} className="mb-2 flex items-center gap-2">
            <span className="flex-1">{SERVICE_LABELS[s.key]}</span>
            <input type="number" min="0" className="input input-bordered w-32 text-right font-display text-lg"
              defaultValue={s.default_price ?? 0}
              onBlur={(e) => savePrice(s.id, Number(e.target.value))} />
            <span className="w-16 opacity-60">THB/{s.unit}</span>
          </label>
        ))}
        <div className="text-sm opacity-60">Iron and Dry clean are priced per order.</div>
      </div>

      <div className="rounded-box bg-base-100 p-5 shadow-soft">
        <div className="mb-3 font-display text-xl font-semibold">🛟 Backup</div>
        <div className="flex gap-2">
          <button className={`btn btn-lg lift flex-1 rounded-box font-display ${backedUp ? 'btn-success' : 'btn-secondary'}`} onClick={runBackup}>
            {backedUp ? 'Backup created ✓' : 'Back up now'}
          </button>
          <button className="btn btn-lg lift flex-1 rounded-box font-display" onClick={() => window.api.backup.openFolder()}>
            Open backup folder
          </button>
        </div>
        <div className="mt-2 text-sm opacity-60">A backup is also made automatically every time the app starts.</div>
      </div>
    </div>
  )
}
