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
    await window.api.services.updatePrice({ id, default_price: price })
  }
  async function runBackup(): Promise<void> {
    await window.api.backup.run()
    setBackedUp(true)
    setTimeout(() => setBackedUp(false), 3000)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <div className="mb-2 font-bold">Price list (per kg services)</div>
        {services.filter((s) => s.pricing === 'fixed').map((s) => (
          <label key={s.id} className="mb-2 flex items-center gap-2">
            <span className="flex-1">{SERVICE_LABELS[s.key]} (/{s.unit})</span>
            <input type="number" min="0" className="input input-bordered w-32 text-right"
              defaultValue={s.default_price ?? 0}
              onBlur={(e) => savePrice(s.id, Number(e.target.value))} />
          </label>
        ))}
        <div className="text-sm opacity-60">Iron and Dry clean are priced per order.</div>
      </div>

      <div className="flex gap-2">
        <button className="btn btn-lg flex-1" onClick={runBackup}>
          {backedUp ? 'Backup created ✓' : 'Back up now'}
        </button>
        <button className="btn btn-lg flex-1" onClick={() => window.api.backup.openFolder()}>
          Open backup folder
        </button>
      </div>
    </div>
  )
}
