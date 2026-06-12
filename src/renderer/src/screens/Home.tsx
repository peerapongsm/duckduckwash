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
    { label: 'Income today', value: `฿ ${stats.income.toLocaleString()}`, icon: '💰', tint: 'bg-primary/15 border-primary/40' },
    { label: 'Waiting for input', value: String(stats.waitingInput), icon: '📝', tint: 'bg-warning/10 border-warning/40' },
    { label: 'In progress', value: String(stats.inProgress), icon: '🫧', tint: 'bg-secondary/10 border-secondary/40' },
    { label: 'Ready for pickup', value: String(stats.readyForPickup), icon: '✅', tint: 'bg-success/10 border-success/40' }
  ]

  return (
    <div className="rise flex h-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-box border-2 ${c.tint} p-5 shadow-soft`}>
            <div className="flex items-center gap-2 text-base font-bold opacity-70">
              <span className="text-xl">{c.icon}</span> {c.label}
            </div>
            <div className="font-display mt-2 text-5xl font-semibold tracking-tight">{c.value}</div>
          </div>
        ))}
      </div>
      <button
        className="btn btn-primary lift h-36 flex-1 rounded-box border-0 text-4xl shadow-soft"
        onClick={() => go({ name: 'newOrder' })}
      >
        <span className="font-display font-semibold">🧺 New Order</span>
      </button>
    </div>
  )
}
