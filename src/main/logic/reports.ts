import type Database from 'better-sqlite3'
import type { RangeReport } from '../../shared/types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAILY_SPAN = 62 // beyond ~2 months a bar per day is unreadable — bucket by month

export function rangeReport(db: Database.Database, from: string, to: string): RangeReport {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new Error('invalid date')
  if (from > to) throw new Error('start date must not be after end date')

  const revenue = (db
    .prepare('SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE date(created_at) BETWEEN ? AND ?')
    .get(from, to) as { s: number }).s

  const expenses = (db
    .prepare('SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date BETWEEN ? AND ?')
    .get(from, to) as { s: number }).s

  const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1
  const granularity = spanDays > MAX_DAILY_SPAN ? 'month' : 'day'
  const labelExpr = granularity === 'month' ? "strftime('%Y-%m', created_at)" : 'date(created_at)'

  const buckets = db
    .prepare(
      `SELECT ${labelExpr} AS label, SUM(total) AS revenue
       FROM orders WHERE date(created_at) BETWEEN ? AND ?
       GROUP BY label ORDER BY label`
    )
    .all(from, to) as { label: string; revenue: number }[]

  return { revenue, expenses, profit: revenue - expenses, granularity, buckets }
}
