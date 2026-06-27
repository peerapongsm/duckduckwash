import { ipcMain, shell, dialog } from 'electron'
import { writeFile, readFile } from 'fs/promises'
import type Database from 'better-sqlite3'
import { computeOrderTotal } from './logic/pricing'
import { nextStatus } from './logic/status'
import { listOrders } from './logic/orders'
import { rangeReport } from './logic/reports'
import { buildReportWorkbook } from './logic/reportExport'
import { buildEntityWorkbook, importEntityWorkbook, type DataKind } from './logic/dataIO'
import { backupDb } from './backup'
import type { OrderIntake, OrderDetailsInput, OrderStatus } from '../shared/types'

export function registerIpc(db: Database.Database, backupDir: string): void {
  // --- customers (regulars only; never auto-created from orders) ---
  ipcMain.handle('customers:list', () =>
    db.prepare('SELECT * FROM customers ORDER BY name').all())

  ipcMain.handle('customers:search', (_e, q: string) =>
    db.prepare(
      `SELECT c.*, (SELECT MAX(created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order
       FROM customers c WHERE c.name LIKE '%' || ? || '%' ORDER BY c.name LIMIT 8`
    ).all(q))

  ipcMain.handle('customers:create', (_e, c: { name: string; location: string | null; contact: string | null; notes: string | null }) => {
    if (!c.name?.trim()) throw new Error('name required')
    return db.prepare('INSERT INTO customers (name, location, contact, notes) VALUES (?,?,?,?)')
      .run(c.name.trim(), c.location, c.contact, c.notes).lastInsertRowid
  })

  ipcMain.handle('customers:delete', (_e, id: number) =>
    db.prepare('DELETE FROM customers WHERE id=?').run(id).changes)

  // --- orders: phase 1 (drop-off intake) ---
  ipcMain.handle('orders:intake', (_e, input: OrderIntake) => {
    if (!input.customer_name?.trim()) throw new Error('customer name required')
    if (input.service_ids.length === 0) throw new Error('pick at least one service')
    // optional backdate for old orders; noon localtime keeps the stored format consistent
    const createdAt = input.created_at && /^\d{4}-\d{2}-\d{2}$/.test(input.created_at)
      ? `${input.created_at} 12:00:00`
      : null
    const tx = db.transaction(() => {
      const orderId = db.prepare(
        `INSERT INTO orders (customer_id, customer_name, customer_location, customer_contact, is_delivery, notes, created_at)
         VALUES (?,?,?,?,?,?, COALESCE(?, datetime('now','localtime')))`
      ).run(
        input.customer_id, input.customer_name.trim(), input.customer_location,
        input.customer_contact, input.is_delivery ? 1 : 0, input.notes, createdAt
      ).lastInsertRowid
      const insItem = db.prepare('INSERT INTO order_items (order_id, service_id) VALUES (?,?)')
      for (const sid of input.service_ids) insItem.run(orderId, sid)
      return orderId
    })
    return tx()
  })

  // --- orders: phase 2 (detail input) ---
  ipcMain.handle('orders:saveDetails', (_e, input: OrderDetailsInput) => {
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(input.order_id) as { is_delivery: number; status: OrderStatus } | undefined
    if (!order) throw new Error('order not found')
    if (input.garments.length === 0) throw new Error('add at least one garment')
    for (const g of input.garments) if (g.quantity <= 0) throw new Error('garment quantity must be positive')
    const surchargeAmount = input.surcharge_amount ?? 0
    if (surchargeAmount < 0) throw new Error('surcharge must not be negative')
    const total = computeOrderTotal(
      input.items.map((i) => ({ quantity: i.quantity, unit_price: i.unit_price })),
      surchargeAmount
    )
    // optional date edit; noon localtime matches the backdate convention
    const createdAt = input.created_at && /^\d{4}-\d{2}-\d{2}$/.test(input.created_at)
      ? `${input.created_at} 12:00:00`
      : null
    const tx = db.transaction(() => {
      const upd = db.prepare('UPDATE order_items SET quantity=?, unit_price=?, total=? WHERE id=? AND order_id=?')
      for (const i of input.items) upd.run(i.quantity, i.unit_price, i.quantity * i.unit_price, i.item_id, input.order_id)

      db.prepare('DELETE FROM order_garments WHERE order_id=?').run(input.order_id)
      const insG = db.prepare(
        'INSERT INTO order_garments (order_id, garment, quantity, special_care, wearer) VALUES (?,?,?,?,?)'
      )
      const wearers = ['male', 'female', 'child']
      for (const g of input.garments)
        insG.run(input.order_id, g.garment, g.quantity, g.special_care ? 1 : 0,
          wearers.includes(g.wearer) ? g.wearer : 'female')

      const newStatus = order.status === 'waiting_input' ? 'in_progress' : order.status
      db.prepare(
        `UPDATE orders SET total=?, status=?, is_delivery=?, surcharge_amount=?,
         created_at=COALESCE(?, created_at) WHERE id=?`
      ).run(total, newStatus, input.is_delivery ? 1 : 0, surchargeAmount, createdAt, input.order_id)
    })
    tx()
    return total
  })

  // Optional from/to (YYYY-MM-DD) filter on the order's calendar day. Either
  // bound may be omitted (open-ended); both omitted = every order in the status.
  ipcMain.handle('orders:list', (_e, status: OrderStatus, from?: string, to?: string) =>
    listOrders(db, status, from, to))

  ipcMain.handle('orders:get', (_e, id: number) => ({
    order: db.prepare('SELECT * FROM orders WHERE id=?').get(id),
    items: db.prepare(
      `SELECT oi.*, s.key AS service_key, s.unit, s.pricing, s.default_price
       FROM order_items oi JOIN services s ON s.id = oi.service_id WHERE oi.order_id=?`
    ).all(id),
    garments: db.prepare('SELECT * FROM order_garments WHERE order_id=?').all(id)
  }))

  ipcMain.handle('orders:advanceStatus', (_e, id: number, from: OrderStatus) => {
    const row = db.prepare('SELECT status FROM orders WHERE id=?').get(id) as { status: OrderStatus } | undefined
    if (!row || row.status !== from) return 0
    const next = nextStatus(row.status)
    if (!next) return 0
    return db.prepare('UPDATE orders SET status=? WHERE id=?').run(next, id).changes
  })

  ipcMain.handle('orders:delete', (_e, id: number) =>
    db.prepare('DELETE FROM orders WHERE id=?').run(id).changes)

  // --- garments: every name ever used, for reusable preset buttons ---
  ipcMain.handle('garments:types', () =>
    (db.prepare('SELECT DISTINCT garment FROM order_garments ORDER BY garment').all() as { garment: string }[])
      .map((r) => r.garment))

  // --- expenses ---
  ipcMain.handle('expenses:createMany', (_e, xs: { date: string; category: string; description: string | null; amount: number }[]) => {
    if (xs.length === 0) throw new Error('add at least one expense')
    for (const x of xs) if (x.amount <= 0) throw new Error('amount must be positive')
    const ins = db.prepare('INSERT INTO expenses (date, category, description, amount) VALUES (?,?,?,?)')
    const tx = db.transaction(() => {
      for (const x of xs) ins.run(x.date, x.category, x.description, x.amount)
    })
    tx()
    return xs.length
  })

  ipcMain.handle('expenses:list', (_e, monthPrefix: string) =>
    db.prepare("SELECT * FROM expenses WHERE date LIKE ? || '%' ORDER BY date DESC").all(monthPrefix))

  ipcMain.handle('expenses:update', (_e, x: { id: number; date: string; category: string; description: string | null; amount: number }) => {
    if (x.amount <= 0) throw new Error('amount must be positive')
    return db.prepare('UPDATE expenses SET date=?, category=?, description=?, amount=? WHERE id=?')
      .run(x.date, x.category, x.description, x.amount, x.id).changes
  })

  ipcMain.handle('expenses:delete', (_e, id: number) =>
    db.prepare('DELETE FROM expenses WHERE id=?').run(id).changes)

  // --- services / settings / reports / home ---
  ipcMain.handle('services:list', () =>
    db.prepare('SELECT * FROM services WHERE active=1 ORDER BY id').all())

  ipcMain.handle('services:updatePrice', (_e, p: { id: number; default_price: number }) => {
    if (!Number.isFinite(p.default_price) || p.default_price <= 0) throw new Error('price must be positive')
    return db.prepare("UPDATE services SET default_price=? WHERE id=? AND pricing='fixed'").run(p.default_price, p.id).changes
  })

  ipcMain.handle('settings:get', (_e, key: string) =>
    (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined)?.value ?? null)

  ipcMain.handle('reports:range', (_e, from: string, to: string) => rangeReport(db, from, to))

  ipcMain.handle('reports:export', async (_e, from: string, to: string) => {
    const res = await dialog.showSaveDialog({
      title: 'Export report',
      defaultPath: `DuckDuckWash report ${from} to ${to}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (res.canceled || !res.filePath) return null
    await writeFile(res.filePath, await buildReportWorkbook(db, from, to))
    return res.filePath
  })

  // --- per-table .xlsx export / import (upsert on the ID column) ---
  ipcMain.handle('data:export', async (_e, kind: DataKind) => {
    const res = await dialog.showSaveDialog({
      title: `Export ${kind}`,
      defaultPath: `DuckDuckWash ${kind}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (res.canceled || !res.filePath) return null
    await writeFile(res.filePath, await buildEntityWorkbook(db, kind))
    return res.filePath
  })

  ipcMain.handle('data:import', async (_e, kind: DataKind) => {
    const res = await dialog.showOpenDialog({
      title: `Import ${kind}`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      properties: ['openFile']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return importEntityWorkbook(db, kind, await readFile(res.filePaths[0]))
  })

  ipcMain.handle('home:today', () => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const n = (sql: string) => (db.prepare(sql).get() as { c: number }).c
    return {
      income: (db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE created_at LIKE ? || '%'").get(today) as { s: number }).s,
      waitingInput: n("SELECT COUNT(*) AS c FROM orders WHERE status='waiting_input'"),
      inProgress: n("SELECT COUNT(*) AS c FROM orders WHERE status='in_progress'"),
      readyForPickup: n("SELECT COUNT(*) AS c FROM orders WHERE status='complete'")
    }
  })

  // --- backup ---
  ipcMain.handle('backup:run', () => backupDb(db, backupDir))
  ipcMain.handle('backup:openFolder', () => shell.openPath(backupDir))
}
