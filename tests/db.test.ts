import { describe, it, expect } from 'vitest'
import { openDb } from '../src/main/db'

describe('openDb', () => {
  it('seeds 4 services with the agreed price model', () => {
    const db = openDb(':memory:')
    const services = db
      .prepare('SELECT key, unit, pricing, default_price FROM services ORDER BY id')
      .all()
    expect(services).toEqual([
      { key: 'wash_dry_fold', unit: 'kg', pricing: 'fixed', default_price: 150 },
      { key: 'wash_dry_fold_iron', unit: 'kg', pricing: 'fixed', default_price: 200 },
      { key: 'iron', unit: 'item', pricing: 'custom', default_price: null },
      { key: 'dry_clean', unit: 'item', pricing: 'custom', default_price: null }
    ])
  })

  it('seeds delivery_fee = 20', () => {
    const db = openDb(':memory:')
    const row = db.prepare("SELECT value FROM settings WHERE key='delivery_fee'").get() as { value: string }
    expect(row.value).toBe('20')
  })

  it('new orders default to waiting_input status and 0 total', () => {
    const db = openDb(':memory:')
    db.prepare("INSERT INTO orders (customer_name) VALUES ('walkin')").run()
    const o = db.prepare('SELECT status, total FROM orders').get() as { status: string; total: number }
    expect(o.status).toBe('waiting_input')
    expect(o.total).toBe(0)
  })
})
