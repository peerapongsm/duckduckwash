import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { openDb } from '../src/main/db'
import { buildEntityWorkbook, importEntityWorkbook, type DataKind } from '../src/main/logic/dataIO'

// Build an .xlsx buffer with the given header row + data rows (cells in order).
async function makeBuf(headers: string[], rows: (string | number | null)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet')
  ws.addRow(headers)
  for (const r of rows) ws.addRow(r)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

const imp = (db: ReturnType<typeof openDb>, kind: DataKind, buf: Buffer) =>
  importEntityWorkbook(db, kind, buf)

describe('customers import/export', () => {
  it('round-trips: exporting then importing the same file updates in place (no dupes)', async () => {
    const db = openDb(':memory:')
    db.prepare('INSERT INTO customers (name, location, contact, notes) VALUES (?,?,?,?)').run('Ann', 'Soi 1', '0812345678', null)
    db.prepare('INSERT INTO customers (name, location, contact, notes) VALUES (?,?,?,?)').run('Bob', null, null, 'regular')

    const buf = await buildEntityWorkbook(db, 'customers')
    const res = await imp(db, 'customers', buf)

    expect(res).toEqual({ inserted: 0, updated: 2, skipped: 0 })
    expect((db.prepare('SELECT COUNT(*) c FROM customers').get() as { c: number }).c).toBe(2)
  })

  it('updates only the edited field, matched by ID', async () => {
    const db = openDb(':memory:')
    db.prepare('INSERT INTO customers (name, location, contact, notes) VALUES (?,?,?,?)').run('Ann', 'Soi 1', 'x', 'keep')

    const buf = await makeBuf(['ID', 'Name', 'Location', 'Contact', 'Notes'], [[1, 'Ann', 'Soi 99', 'x', 'keep']])
    const res = await imp(db, 'customers', buf)

    expect(res.updated).toBe(1)
    const row = db.prepare('SELECT location, notes FROM customers WHERE id=1').get() as { location: string; notes: string }
    expect(row.location).toBe('Soi 99')
    expect(row.notes).toBe('keep')
  })

  it('inserts rows whose ID is blank or not in the table, skips nameless rows', async () => {
    const db = openDb(':memory:')
    const buf = await makeBuf(
      ['ID', 'Name', 'Location', 'Contact', 'Notes'],
      [[null, 'New', 'here', null, null], [999, 'GhostId', null, null, null], [null, '', 'nameless', null, null]]
    )
    const res = await imp(db, 'customers', buf)

    expect(res).toEqual({ inserted: 2, updated: 0, skipped: 1 })
    expect((db.prepare('SELECT COUNT(*) c FROM customers').get() as { c: number }).c).toBe(2)
  })
})

describe('expenses import', () => {
  it('upserts valid rows and skips invalid category / non-positive amount / bad date', async () => {
    const db = openDb(':memory:')
    const buf = await makeBuf(
      ['ID', 'Date', 'Category', 'Description', 'Amount'],
      [
        [null, '2026-06-01', 'supplies', 'soap', 120],
        [null, '2026-06-02', 'SALARY', 'staff', 5000], // case-insensitive category
        [null, '2026-06-03', 'bogus', 'x', 50], // bad category -> skip
        [null, '2026-06-04', 'food', 'y', 0], // non-positive -> skip
        [null, 'June 5', 'rent', 'z', 100] // bad date -> skip
      ]
    )
    const res = await imp(db, 'expenses', buf)

    expect(res).toEqual({ inserted: 2, updated: 0, skipped: 3 })
    expect((db.prepare("SELECT category FROM expenses WHERE description='staff'").get() as { category: string }).category).toBe('salary')
  })
})

describe('orders import/export', () => {
  it('round-trips flat fields, keeps status untouched on update', async () => {
    const db = openDb(':memory:')
    db.prepare(
      "INSERT INTO orders (customer_name, customer_location, customer_contact, created_at, status, total, surcharge_amount) VALUES (?,?,?,?,?,?,?)"
    ).run('Cara', 'Hotel A', '0800000000', '2026-06-10 12:00:00', 'closed', 350, 50)

    const buf = await buildEntityWorkbook(db, 'orders')
    const res = await imp(db, 'orders', buf)

    expect(res).toEqual({ inserted: 0, updated: 1, skipped: 0 })
    const o = db.prepare('SELECT status, total, surcharge_amount FROM orders WHERE id=1').get() as { status: string; total: number; surcharge_amount: number }
    expect(o.status).toBe('closed')
    expect(o.total).toBe(350)
    expect(o.surcharge_amount).toBe(50)
  })

  it('inserts new orders (blank ID) as historical closed rows with a noon datetime', async () => {
    const db = openDb(':memory:')
    const buf = await makeBuf(
      ['ID', 'Date', 'Customer', 'Location', 'Contact', 'Service', 'Surcharge', 'Total'],
      [[null, '2026-05-01', 'Dan', 'Soi 2', null, 'Wash / Dry / Fold', 0, 200]]
    )
    const res = await imp(db, 'orders', buf)

    expect(res).toEqual({ inserted: 1, updated: 0, skipped: 0 })
    const o = db.prepare('SELECT status, created_at, total FROM orders WHERE customer_name=?').get('Dan') as { status: string; created_at: string; total: number }
    expect(o.status).toBe('closed')
    expect(o.created_at).toBe('2026-05-01 12:00:00')
    expect(o.total).toBe(200)
  })
})
