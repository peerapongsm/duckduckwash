import { describe, it, expect } from 'vitest'
import { openDb } from '../src/main/db'
import { monthlyReport } from '../src/main/logic/reports'

function insertOrder(db: ReturnType<typeof openDb>, createdAt: string, total: number) {
  db.prepare("INSERT INTO orders (customer_name, created_at, total) VALUES ('x', ?, ?)").run(createdAt, total)
}

describe('monthlyReport', () => {
  it('aggregates revenue, expenses, profit and daily revenue', () => {
    const db = openDb(':memory:')
    insertOrder(db, '2026-06-01 10:00:00', 500)
    insertOrder(db, '2026-06-01 15:00:00', 200)
    insertOrder(db, '2026-06-15 09:00:00', 300)
    insertOrder(db, '2026-05-31 09:00:00', 999) // other month, excluded
    db.prepare("INSERT INTO expenses (date, category, amount) VALUES ('2026-06-10','rent',400)").run()

    const r = monthlyReport(db, 2026, 6)
    expect(r.revenue).toBe(1000)
    expect(r.expenses).toBe(400)
    expect(r.profit).toBe(600)
    expect(r.daily.find((d) => d.day === 1)?.revenue).toBe(700)
    expect(r.daily.find((d) => d.day === 15)?.revenue).toBe(300)
  })
})
