import type Database from 'better-sqlite3'
import type { RangeReport, BreakdownItem } from '../../shared/types'
import { SERVICE_LABELS, EXPENSE_CATEGORY_LABELS } from '../../shared/labels'

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

  return {
    revenue,
    expenses,
    profit: revenue - expenses,
    granularity,
    buckets,
    revenueByService: revenueByService(db, from, to),
    expensesByCategory: expensesByCategory(db, from, to)
  }
}

// Revenue split by service category, taken from order line items, plus the
// urgent surcharge as its own line — so the slices reconcile to total revenue.
// Sorted by amount descending; zero/empty services are omitted.
function revenueByService(db: Database.Database, from: string, to: string): BreakdownItem[] {
  const rows = db
    .prepare(
      `SELECT s.key AS key, COALESCE(SUM(oi.total), 0) AS amount
       FROM order_items oi
       JOIN services s ON s.id = oi.service_id
       JOIN orders o ON o.id = oi.order_id
       WHERE date(o.created_at) BETWEEN ? AND ?
       GROUP BY s.key`
    )
    .all(from, to) as { key: string; amount: number }[]

  const items: BreakdownItem[] = rows
    .filter((r) => r.amount > 0)
    .map((r) => ({ label: SERVICE_LABELS[r.key] ?? r.key, amount: r.amount }))

  const surcharge = (db
    .prepare('SELECT COALESCE(SUM(surcharge_amount), 0) AS s FROM orders WHERE date(created_at) BETWEEN ? AND ?')
    .get(from, to) as { s: number }).s
  if (surcharge > 0) items.push({ label: 'Urgent surcharge', amount: surcharge })

  return items.sort((a, b) => b.amount - a.amount)
}

// Expenses split by category, sorted by amount descending; zero categories omitted.
function expensesByCategory(db: Database.Database, from: string, to: string): BreakdownItem[] {
  const rows = db
    .prepare(
      'SELECT category, COALESCE(SUM(amount), 0) AS amount FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category'
    )
    .all(from, to) as { category: string; amount: number }[]

  return rows
    .filter((r) => r.amount > 0)
    .map((r) => ({ label: EXPENSE_CATEGORY_LABELS[r.category] ?? r.category, amount: r.amount }))
    .sort((a, b) => b.amount - a.amount)
}
