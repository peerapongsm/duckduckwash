import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { Screen } from '../App'
import type { TodayStats } from '../../../shared/types'

export default function Home({ go }: { go: (s: Screen) => void }): JSX.Element {
  const [stats, setStats] = useState<TodayStats>({ income: 0, waitingInput: 0, inProgress: 0, readyForPickup: 0 })

  useEffect(() => {
    window.api.home.today().then((s) => setStats(s as TodayStats))
  }, [])

  const cards = [
    { label: 'Income today', value: `${stats.income.toLocaleString()} ฿` },
    { label: 'Waiting for input', value: String(stats.waitingInput) },
    { label: 'In progress', value: String(stats.inProgress) },
    { label: 'Ready for pickup', value: String(stats.readyForPickup) }
  ]

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card bg-base-200 shadow">
            <div className="card-body items-center text-center">
              <div className="text-base opacity-70">{c.label}</div>
              <div className="text-4xl font-bold">{c.value}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-lg h-32 flex-1 text-3xl" onClick={() => go({ name: 'newOrder' })}>
        + New Order
      </button>
    </div>
  )
}
