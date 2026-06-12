import { describe, it, expect } from 'vitest'
import { openDb } from '../src/main/db'
import { rangeReport } from '../src/main/logic/reports'

function insertOrder(db: ReturnType<typeof openDb>, createdAt: string, total: number) {
  db.prepare("INSERT INTO orders (customer_name, created_at, total) VALUES ('x', ?, ?)").run(createdAt, total)
}

describe('rangeReport', () => {
  it('aggregates revenue, expenses, profit with daily buckets for short ranges', () => {
    const db = openDb(':memory:')
    insertOrder(db, '2026-06-01 10:00:00', 500)
    insertOrder(db, '2026-06-01 15:00:00', 200)
    insertOrder(db, '2026-06-15 09:00:00', 300)
    insertOrder(db, '2026-05-31 09:00:00', 999) // before range, excluded
    insertOrder(db, '2026-07-01 09:00:00', 888) // after range, excluded
    db.prepare("INSERT INTO expenses (date, category, amount) VALUES ('2026-06-10','rent',400)").run()
    db.prepare("INSERT INTO expenses (date, category, amount) VALUES ('2026-05-10','rent',999)").run()

    const r = rangeReport(db, '2026-06-01', '2026-06-30')
    expect(r.revenue).toBe(1000)
    expect(r.expenses).toBe(400)
    expect(r.profit).toBe(600)
    expect(r.granularity).toBe('day')
    expect(r.buckets.find((b) => b.label === '2026-06-01')?.revenue).toBe(700)
    expect(r.buckets.find((b) => b.label === '2026-06-15')?.revenue).toBe(300)
  })

  it('single day range works (daily report)', () => {
    const db = openDb(':memory:')
    insertOrder(db, '2026-06-12 09:00:00', 150)
    insertOrder(db, '2026-06-13 09:00:00', 999) // excluded

    const r = rangeReport(db, '2026-06-12', '2026-06-12')
    expect(r.revenue).toBe(150)
    expect(r.granularity).toBe('day')
    expect(r.buckets).toEqual([{ label: '2026-06-12', revenue: 150 }])
  })

  it('groups by month when range spans more than 62 days (annual report)', () => {
    const db = openDb(':memory:')
    insertOrder(db, '2026-01-15 09:00:00', 100)
    insertOrder(db, '2026-01-20 09:00:00', 200)
    insertOrder(db, '2026-06-12 09:00:00', 300)

    const r = rangeReport(db, '2026-01-01', '2026-12-31')
    expect(r.revenue).toBe(600)
    expect(r.granularity).toBe('month')
    expect(r.buckets.find((b) => b.label === '2026-01')?.revenue).toBe(300)
    expect(r.buckets.find((b) => b.label === '2026-06')?.revenue).toBe(300)
  })

  it('rejects invalid or reversed ranges', () => {
    const db = openDb(':memory:')
    expect(() => rangeReport(db, '2026-06-30', '2026-06-01')).toThrow()
    expect(() => rangeReport(db, 'junk', '2026-06-01')).toThrow()
  })
})
