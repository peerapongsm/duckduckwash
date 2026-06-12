import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
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

  it('new orders default to waiting_input status and 0 total', () => {
    const db = openDb(':memory:')
    db.prepare("INSERT INTO orders (customer_name) VALUES ('walkin')").run()
    const o = db.prepare('SELECT status, total FROM orders').get() as { status: string; total: number }
    expect(o.status).toBe('waiting_input')
    expect(o.total).toBe(0)
  })

  it('migrates v1.0.0 phone columns to contact, keeping data', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'ddw-')), 'old.db')
    const old = new Database(path)
    old.exec(`
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, location TEXT, phone TEXT, notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY, customer_id INTEGER, customer_name TEXT NOT NULL,
        customer_location TEXT, customer_phone TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        status TEXT NOT NULL DEFAULT 'waiting_input', is_delivery INTEGER NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0, notes TEXT
      );
    `)
    old.prepare("INSERT INTO customers (name, phone) VALUES ('A', '0812345678')").run()
    old.close()

    const db = openDb(path)
    const c = db.prepare('SELECT contact FROM customers').get() as { contact: string }
    expect(c.contact).toBe('0812345678')
    const orderCols = (db.pragma('table_info(orders)') as { name: string }[]).map((x) => x.name)
    expect(orderCols).toContain('customer_contact')
    expect(orderCols).not.toContain('customer_phone')
    db.close()
  })
})
