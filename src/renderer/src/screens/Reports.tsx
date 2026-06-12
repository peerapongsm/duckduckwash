import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { MonthlyReport } from '../../../shared/types'

export default function Reports(): JSX.Element {
  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [report, setReport] = useState<MonthlyReport | null>(null)

  useEffect(() => {
    const [y, m] = ym.split('-').map(Number)
    window.api.reports.monthly(y, m).then((r) => setReport(r as MonthlyReport))
  }, [ym])

  const max = Math.max(1, ...(report?.daily.map((d) => d.revenue) ?? [1]))
  const cards = report
    ? [
        { label: 'Revenue', value: report.revenue, icon: '💰', tint: 'bg-success/10 border-success/40', cls: 'text-success' },
        { label: 'Expenses', value: report.expenses, icon: '🧾', tint: 'bg-error/10 border-error/40', cls: 'text-error' },
        {
          label: 'Profit', value: report.profit, icon: '🦆',
          tint: report.profit >= 0 ? 'bg-primary/15 border-primary/40' : 'bg-error/10 border-error/40',
          cls: report.profit >= 0 ? 'text-base-content' : 'text-error'
        }
      ]
    : []

  return (
    <div className="rise flex flex-col gap-4">
      <label className="flex items-center gap-3 font-display text-lg">
        Month
        <input type="month" className="input input-bordered input-lg shadow-soft" value={ym} onChange={(e) => setYm(e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-box border-2 ${c.tint} p-5 shadow-soft`}>
            <div className="flex items-center gap-2 font-bold opacity-70">
              <span className="text-xl">{c.icon}</span> {c.label}
            </div>
            <div className={`font-display mt-2 text-4xl font-semibold ${c.cls}`}>฿ {c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
      {report && (
        <div className="rounded-box bg-base-100 p-5 shadow-soft">
          <div className="mb-3 font-display text-lg font-semibold opacity-70">Daily revenue</div>
          <div className="flex h-48 items-end gap-1">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const rev = report.daily.find((d) => d.day === day)?.revenue ?? 0
              return (
                <div key={day} className="group flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-secondary to-secondary/60 transition-colors group-hover:from-primary group-hover:to-primary/70"
                    style={{ height: `${(rev / max) * 100}%`, minHeight: rev > 0 ? '4px' : '0' }}
                    title={`Day ${day}: ฿${rev.toLocaleString()}`}
                  />
                  {day % 5 === 0 && <span className="text-xs opacity-40">{day}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
