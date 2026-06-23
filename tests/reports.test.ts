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

  it('breaks revenue down by service (+ surcharge) and expenses by category', () => {
    const db = openDb(':memory:')
    const svc = (k: string): number =>
      (db.prepare('SELECT id FROM services WHERE key=?').get(k) as { id: number }).id

    db.prepare("INSERT INTO orders (id, customer_name, created_at, total, surcharge_amount) VALUES (1,'a','2026-06-10 09:00:00',300,0)").run()
    db.prepare("INSERT INTO orders (id, customer_name, created_at, total, surcharge_amount) VALUES (2,'b','2026-06-11 09:00:00',250,50)").run()
    db.prepare("INSERT INTO orders (id, customer_name, created_at, total, surcharge_amount) VALUES (3,'c','2026-05-20 09:00:00',999,0)").run() // out of range
    db.prepare('INSERT INTO order_items (order_id, service_id, total) VALUES (1, ?, 300)').run(svc('wash_dry_fold'))
    db.prepare('INSERT INTO order_items (order_id, service_id, total) VALUES (2, ?, 200)').run(svc('iron'))
    db.prepare('INSERT INTO order_items (order_id, service_id, total) VALUES (3, ?, 999)').run(svc('dry_clean'))

    db.prepare("INSERT INTO expenses (date, category, amount) VALUES ('2026-06-10','supplies',100)").run()
    db.prepare("INSERT INTO expenses (date, category, amount) VALUES ('2026-06-12','rent',400)").run()
    db.prepare("INSERT INTO expenses (date, category, amount) VALUES ('2026-05-01','rent',777)").run() // out of range

    const r = rangeReport(db, '2026-06-01', '2026-06-30')

    // sorted by amount desc, out-of-range dry_clean excluded, surcharge its own line
    expect(r.revenueByService).toEqual([
      { label: 'Wash / Dry / Fold', amount: 300 },
      { label: 'Iron', amount: 200 },
      { label: 'Urgent surcharge', amount: 50 }
    ])
    // slices reconcile to the headline revenue figure
    expect(r.revenueByService.reduce((s, i) => s + i.amount, 0)).toBe(r.revenue)

    expect(r.expensesByCategory).toEqual([
      { label: 'Rent', amount: 400 },
      { label: 'Supplies', amount: 100 }
    ])
    expect(r.expensesByCategory.reduce((s, i) => s + i.amount, 0)).toBe(r.expenses)
  })
})
