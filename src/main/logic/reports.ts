import type Database from 'better-sqlite3'
import type { MonthlyReport } from '../../shared/types'

export function monthlyReport(db: Database.Database, year: number, month: number): MonthlyReport {
  const prefix = `${year}-${String(month).padStart(2, '0')}`

  const revenue = (db
    .prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE created_at LIKE ? || '%'")
    .get(prefix) as { s: number }).s

  const expenses = (db
    .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date LIKE ? || '%'")
    .get(prefix) as { s: number }).s

  const daily = db
    .prepare(
      `SELECT CAST(strftime('%d', created_at) AS INTEGER) AS day, SUM(total) AS revenue
       FROM orders WHERE created_at LIKE ? || '%'
       GROUP BY day ORDER BY day`
    )
    .all(prefix) as { day: number; revenue: number }[]

  return { revenue, expenses, profit: revenue - expenses, daily }
}
