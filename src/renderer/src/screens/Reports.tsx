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
        { label: 'Revenue', value: report.revenue, cls: 'text-success' },
        { label: 'Expenses', value: report.expenses, cls: 'text-error' },
        { label: 'Profit', value: report.profit, cls: report.profit >= 0 ? 'text-success' : 'text-error' }
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2">
        Month
        <input type="month" className="input input-bordered input-lg" value={ym} onChange={(e) => setYm(e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card bg-base-200 shadow">
            <div className="card-body items-center text-center">
              <div className="opacity-70">{c.label}</div>
              <div className={`text-4xl font-bold ${c.cls}`}>{c.value.toLocaleString()} ฿</div>
            </div>
          </div>
        ))}
      </div>
      {report && (
        <div className="flex h-48 items-end gap-1 rounded-box bg-base-200 p-3">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
            const rev = report.daily.find((d) => d.day === day)?.revenue ?? 0
            return (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-primary" style={{ height: `${(rev / max) * 100}%` }} title={`${day}: ${rev}`} />
                {day % 5 === 0 && <span className="text-xs opacity-50">{day}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
