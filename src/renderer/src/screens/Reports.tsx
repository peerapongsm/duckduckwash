import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { RangeReport } from '../../../shared/types'

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function presetRanges(): { label: string; from: string; to: string }[] {
  const now = new Date()
  const today = fmt(now)
  return [
    { label: 'Today', from: today, to: today },
    { label: 'This month', from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: today },
    { label: 'This year', from: fmt(new Date(now.getFullYear(), 0, 1)), to: today }
  ]
}

export default function Reports(): JSX.Element {
  const presets = presetRanges()
  const [from, setFrom] = useState(presets[1].from) // default: this month
  const [to, setTo] = useState(presets[1].to)
  const [report, setReport] = useState<RangeReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!from || !to) return
    if (from > to) {
      setError('Start date is after end date')
      setReport(null)
      return
    }
    setError(null)
    window.api.reports.range(from, to).then((r) => setReport(r as RangeReport))
  }, [from, to])

  async function exportXlsx(): Promise<void> {
    setExporting(true)
    try {
      const path = await window.api.reports.export(from, to)
      if (path) alert('Saved to:\n' + path)
    } catch (err) {
      alert('Export failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setExporting(false)
    }
  }

  const max = Math.max(1, ...(report?.buckets.map((b) => b.revenue) ?? [1]))
  // show at most ~15 axis labels however long the range is
  const labelEvery = report ? Math.max(1, Math.ceil(report.buckets.length / 15)) : 1

  function shortLabel(label: string): string {
    if (label.length === 7) {
      return MONTH_NAMES[Number(label.slice(5)) - 1] // YYYY-MM
    }
    return String(Number(label.slice(8))) // YYYY-MM-DD → day of month
  }

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
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            className={`btn font-display font-medium ${from === p.from && to === p.to ? 'btn-neutral shadow-soft' : 'btn-ghost bg-base-200'}`}
            onClick={() => { setFrom(p.from); setTo(p.to) }}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-2 flex items-center gap-2">
          <input type="date" className="input input-bordered shadow-soft" value={from} max={to}
            onChange={(e) => setFrom(e.target.value)} />
          <span className="opacity-60">to</span>
          <input type="date" className="input input-bordered shadow-soft" value={to} min={from}
            onChange={(e) => setTo(e.target.value)} />
        </div>
        <button
          className="btn btn-secondary font-display font-medium shadow-soft"
          disabled={!report || !!error || exporting}
          onClick={exportXlsx}
        >
          {exporting ? '⏳ Exporting…' : '📄 Export .xlsx'}
        </button>
      </div>

      {error && <div className="rounded-box bg-error/10 p-4 text-error">{error}</div>}

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

      {report && report.buckets.length > 0 && (
        <div className="rounded-box bg-base-100 p-5 shadow-soft">
          <div className="mb-3 font-display text-lg font-semibold opacity-70">
            {report.granularity === 'month' ? 'Monthly revenue' : 'Daily revenue'}
          </div>
          <div className="flex h-48 items-stretch gap-1">
            {report.buckets.map((b, i) => (
              <div key={b.label} className="group flex flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-secondary to-secondary/60 transition-colors group-hover:from-primary group-hover:to-primary/70"
                  style={{ height: `${(b.revenue / max) * 100}%`, minHeight: b.revenue > 0 ? '4px' : '0' }}
                  title={`${b.label}: ฿${b.revenue.toLocaleString()}`}
                />
                {i % labelEvery === 0 && <span className="text-xs opacity-40">{shortLabel(b.label)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {report && report.buckets.length === 0 && (
        <div className="rounded-box border-2 border-dashed border-base-300 p-10 text-center opacity-50">
          No orders in this period
        </div>
      )}
    </div>
  )
}
