import type Database from 'better-sqlite3'
import type { Order, OrderStatus } from '../../shared/types'

// Lists orders in a status, newest first, optionally narrowed to a calendar-day
// range. Either bound (YYYY-MM-DD) may be omitted for an open-ended range;
// omitting both returns every order in the status. The range matches on the
// order's day, so the time component of created_at is ignored.
export function listOrders(
  db: Database.Database,
  status: OrderStatus,
  from?: string,
  to?: string
): Order[] {
  const where = ['status=?']
  const params: string[] = [status]
  if (from) {
    where.push('date(created_at) >= date(?)')
    params.push(from)
  }
  if (to) {
    where.push('date(created_at) <= date(?)')
    params.push(to)
  }
  return db
    .prepare(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY created_at DESC`)
    .all(...params) as Order[]
}
