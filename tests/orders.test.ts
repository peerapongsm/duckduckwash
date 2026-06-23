import { describe, it, expect } from 'vitest'
import { openDb } from '../src/main/db'
import { listOrders } from '../src/main/logic/orders'
import type { OrderStatus } from '../src/shared/types'

function insertOrder(
  db: ReturnType<typeof openDb>,
  createdAt: string,
  status: OrderStatus = 'waiting_input',
  name = 'x'
): void {
  db.prepare('INSERT INTO orders (customer_name, created_at, status) VALUES (?, ?, ?)').run(
    name,
    createdAt,
    status
  )
}

describe('listOrders', () => {
  it('returns every order of a status newest-first when no range is given', () => {
    const db = openDb(':memory:')
    insertOrder(db, '2026-06-01 09:00:00', 'closed', 'a')
    insertOrder(db, '2026-06-15 09:00:00', 'closed', 'b')
    insertOrder(db, '2026-06-10 09:00:00', 'waiting_input', 'c') // different status

    expect(listOrders(db, 'closed').map((o) => o.customer_name)).toEqual(['b', 'a'])
  })

  it('filters to an inclusive date range, ignoring the time component', () => {
    const db = openDb(':memory:')
    insertOrder(db, '2026-05-31 23:00:00', 'closed', 'before')
    insertOrder(db, '2026-06-01 00:30:00', 'closed', 'start-day')
    insertOrder(db, '2026-06-15 12:00:00', 'closed', 'mid')
    insertOrder(db, '2026-06-30 23:59:00', 'closed', 'end-day')
    insertOrder(db, '2026-07-01 00:10:00', 'closed', 'after')

    const rows = listOrders(db, 'closed', '2026-06-01', '2026-06-30')
    expect(rows.map((o) => o.customer_name)).toEqual(['end-day', 'mid', 'start-day'])
  })

  it('supports open-ended ranges (from-only and to-only)', () => {
    const db = openDb(':memory:')
    insertOrder(db, '2026-06-01 09:00:00', 'closed', 'jun1')
    insertOrder(db, '2026-06-15 09:00:00', 'closed', 'jun15')
    insertOrder(db, '2026-06-30 09:00:00', 'closed', 'jun30')

    expect(listOrders(db, 'closed', '2026-06-15').map((o) => o.customer_name)).toEqual([
      'jun30',
      'jun15'
    ])
    expect(listOrders(db, 'closed', undefined, '2026-06-15').map((o) => o.customer_name)).toEqual([
      'jun15',
      'jun1'
    ])
  })

  it('keeps statuses separate when a date range is applied', () => {
    const db = openDb(':memory:')
    insertOrder(db, '2026-06-10 09:00:00', 'closed', 'closed-one')
    insertOrder(db, '2026-06-10 09:00:00', 'in_progress', 'active-one')

    const rows = listOrders(db, 'closed', '2026-06-01', '2026-06-30')
    expect(rows.map((o) => o.customer_name)).toEqual(['closed-one'])
  })
})
