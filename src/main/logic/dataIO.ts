import ExcelJS from 'exceljs'
import type Database from 'better-sqlite3'
import { SERVICE_LABELS } from '../../shared/labels'

// Export/import the three operational tables as single-sheet .xlsx files.
// Every export carries the row ID in the first column; import upserts on it
// (ID present + row exists -> update; blank/unknown ID -> insert). Names are
// not unique, so the DB id is the only stable round-trip key.
export type DataKind = 'orders' | 'customers' | 'expenses'
export interface ImportResult { inserted: number; updated: number; skipped: number }

const EXPENSE_CATS = ['supplies', 'utilities', 'rent', 'food', 'salary', 'other']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const labelServices = (keys: string | null): string =>
  (keys ?? '').split(',').filter(Boolean).map((k) => SERVICE_LABELS[k] ?? k).join(', ')

// --- export ---

interface ColSpec { header: string; key: string; width: number; numFmt?: string }

const SPECS: Record<DataKind, { columns: ColSpec[]; rows: (db: Database.Database) => Record<string, unknown>[] }> = {
  orders: {
    columns: [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Customer', key: 'customer', width: 22 },
      { header: 'Location', key: 'location', width: 22 },
      { header: 'Contact', key: 'contact', width: 18 },
      { header: 'Service', key: 'service', width: 28 },
      { header: 'Surcharge', key: 'surcharge', width: 12, numFmt: '#,##0' },
      { header: 'Total', key: 'total', width: 12, numFmt: '#,##0' }
    ],
    rows: (db) =>
      (db.prepare(
        `SELECT o.id, o.created_at, o.customer_name, o.customer_location, o.customer_contact,
                (SELECT GROUP_CONCAT(s.key) FROM order_items oi
                 JOIN services s ON s.id = oi.service_id WHERE oi.order_id = o.id) AS services,
                o.surcharge_amount, o.total
         FROM orders o ORDER BY o.created_at`
      ).all() as {
        id: number; created_at: string; customer_name: string; customer_location: string | null
        customer_contact: string | null; services: string | null; surcharge_amount: number; total: number | null
      }[]).map((o) => ({
        id: o.id, date: o.created_at, customer: o.customer_name, location: o.customer_location ?? '',
        contact: o.customer_contact ?? '', service: labelServices(o.services),
        surcharge: o.surcharge_amount ?? 0, total: o.total ?? 0
      }))
  },
  customers: {
    columns: [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Location', key: 'location', width: 22 },
      { header: 'Contact', key: 'contact', width: 18 },
      { header: 'Notes', key: 'notes', width: 32 }
    ],
    rows: (db) =>
      (db.prepare('SELECT id, name, location, contact, notes FROM customers ORDER BY name').all() as {
        id: number; name: string; location: string | null; contact: string | null; notes: string | null
      }[]).map((c) => ({
        id: c.id, name: c.name, location: c.location ?? '', contact: c.contact ?? '', notes: c.notes ?? ''
      }))
  },
  expenses: {
    columns: [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Description', key: 'description', width: 32 },
      { header: 'Amount', key: 'amount', width: 12, numFmt: '#,##0' }
    ],
    rows: (db) =>
      (db.prepare('SELECT id, date, category, description, amount FROM expenses ORDER BY date').all() as {
        id: number; date: string; category: string; description: string | null; amount: number
      }[]).map((e) => ({
        id: e.id, date: e.date, category: e.category, description: e.description ?? '', amount: e.amount
      }))
  }
}

export async function buildEntityWorkbook(db: Database.Database, kind: DataKind): Promise<Buffer> {
  const spec = SPECS[kind]
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DuckDuckWash'
  const ws = wb.addWorksheet(kind[0].toUpperCase() + kind.slice(1))
  ws.columns = spec.columns.map((c) => ({ header: c.header, key: c.key, width: c.width }))
  ws.getRow(1).font = { bold: true }
  for (const r of spec.rows(db)) ws.addRow(r)
  for (const c of spec.columns) if (c.numFmt) ws.getColumn(c.key).numFmt = c.numFmt
  return Buffer.from(await wb.xlsx.writeBuffer())
}

// --- import ---

// Pull a cell's plain text, treating rich-text / null / whitespace as empty.
function cellStr(v: ExcelJS.CellValue): string | null {
  if (v == null) return null
  const raw = typeof v === 'object' && v !== null && 'text' in v ? (v as { text: string }).text : v
  const s = String(raw).trim()
  return s === '' ? null : s
}
function cellNum(v: ExcelJS.CellValue): number {
  const raw = typeof v === 'object' && v !== null && 'result' in v ? (v as { result: unknown }).result : v
  return Number(raw)
}

// Read every data row into a { header -> cell } map (row 1 is the header).
function readRows(buf: Buffer): Promise<Record<string, ExcelJS.CellValue>[]> {
  const wb = new ExcelJS.Workbook()
  return wb.xlsx.load(buf as unknown as ArrayBuffer).then(() => {
    const ws = wb.worksheets[0]
    if (!ws) return []
    const headers: string[] = []
    ws.getRow(1).eachCell((cell, col) => { headers[col] = String(cell.value ?? '').trim() })
    const out: Record<string, ExcelJS.CellValue>[] = []
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return
      const obj: Record<string, ExcelJS.CellValue> = {}
      let any = false
      row.eachCell((cell, col) => {
        const h = headers[col]
        if (h) { obj[h] = cell.value; if (cell.value != null && cell.value !== '') any = true }
      })
      if (any) out.push(obj)
    })
    return out
  })
}

const idOf = (r: Record<string, ExcelJS.CellValue>): number | null => {
  const v = cellNum(r['ID'])
  return Number.isInteger(v) && v > 0 ? v : null
}

// noon localtime matches the app's backdate convention; full datetimes pass through
function normalizeOrderDate(date: string | null): string | null {
  if (!date) return null
  return DATE_RE.test(date) ? `${date} 12:00:00` : date
}

export async function importEntityWorkbook(
  db: Database.Database,
  kind: DataKind,
  buf: Buffer
): Promise<ImportResult> {
  const rows = await readRows(buf)
  if (kind === 'customers') return importCustomers(db, rows)
  if (kind === 'expenses') return importExpenses(db, rows)
  return importOrders(db, rows)
}

function importCustomers(db: Database.Database, rows: Record<string, ExcelJS.CellValue>[]): ImportResult {
  const has = db.prepare('SELECT 1 FROM customers WHERE id=?')
  const upd = db.prepare('UPDATE customers SET name=?, location=?, contact=?, notes=? WHERE id=?')
  const ins = db.prepare('INSERT INTO customers (name, location, contact, notes) VALUES (?,?,?,?)')
  const res: ImportResult = { inserted: 0, updated: 0, skipped: 0 }
  db.transaction(() => {
    for (const r of rows) {
      const name = cellStr(r['Name'])
      if (!name) { res.skipped++; continue }
      const vals = [name, cellStr(r['Location']), cellStr(r['Contact']), cellStr(r['Notes'])] as const
      const id = idOf(r)
      if (id && has.get(id)) { upd.run(...vals, id); res.updated++ }
      else { ins.run(...vals); res.inserted++ }
    }
  })()
  return res
}

function importExpenses(db: Database.Database, rows: Record<string, ExcelJS.CellValue>[]): ImportResult {
  const has = db.prepare('SELECT 1 FROM expenses WHERE id=?')
  const upd = db.prepare('UPDATE expenses SET date=?, category=?, description=?, amount=? WHERE id=?')
  const ins = db.prepare('INSERT INTO expenses (date, category, description, amount) VALUES (?,?,?,?)')
  const res: ImportResult = { inserted: 0, updated: 0, skipped: 0 }
  db.transaction(() => {
    for (const r of rows) {
      const date = cellStr(r['Date'])
      const category = cellStr(r['Category'])?.toLowerCase() ?? null
      const amount = cellNum(r['Amount'])
      if (!date || !DATE_RE.test(date) || !category || !EXPENSE_CATS.includes(category) || !(amount > 0)) {
        res.skipped++; continue
      }
      const vals = [date, category, cellStr(r['Description']), amount] as const
      const id = idOf(r)
      if (id && has.get(id)) { upd.run(...vals, id); res.updated++ }
      else { ins.run(...vals); res.inserted++ }
    }
  })()
  return res
}

function importOrders(db: Database.Database, rows: Record<string, ExcelJS.CellValue>[]): ImportResult {
  const has = db.prepare('SELECT 1 FROM orders WHERE id=?')
  // only the exported (flat) fields change; blank Date keeps the stored created_at.
  // items/garments/status/delivery are intentionally left untouched (lossy round-trip).
  const upd = db.prepare(
    `UPDATE orders SET customer_name=?, customer_location=?, customer_contact=?,
     created_at=COALESCE(?, created_at), surcharge_amount=?, total=? WHERE id=?`
  )
  // imported new orders have no items, so they land as historical 'closed' rows.
  // ponytail: status fixed to 'closed' — the export has no status column and an
  // imported order with a total is a finished record.
  const ins = db.prepare(
    `INSERT INTO orders (customer_name, customer_location, customer_contact, created_at,
     status, is_delivery, total, surcharge_amount)
     VALUES (?,?,?, COALESCE(?, datetime('now','localtime')), 'closed', 0, ?, ?)`
  )
  const res: ImportResult = { inserted: 0, updated: 0, skipped: 0 }
  db.transaction(() => {
    for (const r of rows) {
      const name = cellStr(r['Customer'])
      if (!name) { res.skipped++; continue }
      const date = normalizeOrderDate(cellStr(r['Date']))
      const loc = cellStr(r['Location'])
      const contact = cellStr(r['Contact'])
      const surcharge = cellNum(r['Surcharge']) || 0
      const total = cellNum(r['Total']) || 0
      const id = idOf(r)
      if (id && has.get(id)) { upd.run(name, loc, contact, date, surcharge, total, id); res.updated++ }
      else { ins.run(name, loc, contact, date, total, surcharge); res.inserted++ }
    }
  })()
  return res
}
