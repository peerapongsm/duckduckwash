# DuckDuckWash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local-only Electron desktop app (DuckDuckWash) for a laundry shop: two-phase order tracking matching the real shop flow, revenue/expense reports, elderly-friendly English-only UI.

**Architecture:** Electron main process owns SQLite (better-sqlite3, WAL) and all business logic; React renderer talks only through typed IPC exposed by the preload bridge. Single-file DB in `userData`, copied to `backups/` on every launch.

**Tech Stack:** Electron + electron-vite, React 18, TypeScript, Tailwind CSS 3 + daisyUI 4, better-sqlite3, Vitest, electron-builder (NSIS installer).

**Spec:** `docs/superpowers/specs/2026-06-12-laundry-care-design.md`

---

## File Structure

```
package.json
electron.vite.config.ts
electron-builder.yml
tailwind.config.js / postcss.config.js
icon/                          — provided branding (logo + 32..512px icons), already in repo
src/main/index.ts              — app boot, window (icon), run backup on launch
src/main/db.ts                 — openDb(path), schema, service/settings seeding
src/main/logic/pricing.ts      — computeOrderTotal (pure, tested)
src/main/logic/status.ts       — nextStatus (pure, tested)
src/main/logic/reports.ts      — monthlyReport(db, year, month) (tested)
src/main/backup.ts             — backupDb(dbPath, backupDir, keep=30)
src/main/ipc.ts                — registerIpc(db): all ipcMain.handle channels
src/preload/index.ts           — contextBridge `window.api` (typed)
src/shared/types.ts            — shared TS types used by main+renderer
src/renderer/src/main.tsx      — React entry
src/renderer/src/App.tsx       — shell: logo header, big bottom nav
src/renderer/src/screens/Home.tsx
src/renderer/src/screens/NewOrder.tsx        — phase 1: drop-off intake
src/renderer/src/screens/Orders.tsx          — status tabs + actions
src/renderer/src/screens/OrderDetails.tsx    — phase 2: kg/prices/garments
src/renderer/src/screens/Customers.tsx
src/renderer/src/screens/Expenses.tsx
src/renderer/src/screens/Reports.tsx
src/renderer/src/screens/Settings.tsx
tests/pricing.test.ts
tests/status.test.ts
tests/db.test.ts
tests/reports.test.ts
```

UI conventions (every screen): daisyUI `btn-lg`, base font ≥18px (`html { font-size: 18px }`), one primary action per screen, destructive actions behind a `<dialog>` confirm. English only — no i18n layer.

---

### Task 1: Scaffold project

**Files:**
- Create: project skeleton via electron-vite, then Tailwind/daisyUI config

- [ ] **Step 1: Scaffold electron-vite app (React + TS)**

```bash
npm create @quick-start/electron@latest . -- --template react-ts --skip
npm install
```

If the interactive prompt appears, choose: React, TypeScript, no extras.

- [ ] **Step 2: Install dependencies**

```bash
npm install better-sqlite3
npm install -D tailwindcss@3 postcss autoprefixer daisyui@4 vitest @types/better-sqlite3 electron-rebuild
npx electron-rebuild -f -w better-sqlite3
```

- [ ] **Step 3: Configure Tailwind + daisyUI**

Create `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [require('daisyui')],
  daisyui: { themes: ['corporate'] }
}
```

Create `postcss.config.js`:

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

Replace `src/renderer/src/assets/main.css` content with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html { font-size: 18px; } /* elderly-friendly base size */
```

- [ ] **Step 4: Vitest config + test script**

In `package.json` `"scripts"` add:

```json
"test": "vitest run"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } })
```

- [ ] **Step 5: Verify dev app launches**

Run: `npm run dev`
Expected: Electron window opens with template page. Close it.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold electron-vite + react-ts + tailwind/daisyui"
```

---

### Task 2: Shared types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Write the types file**

```ts
export type OrderStatus = 'waiting_input' | 'in_progress' | 'complete' | 'closed'

export type ServiceKey =
  | 'wash_dry_fold'
  | 'wash_dry_fold_iron'
  | 'iron'
  | 'dry_clean'

export interface Customer {
  id: number
  name: string
  location: string | null
  phone: string | null
  notes: string | null
  created_at: string
}

export interface Service {
  id: number
  key: ServiceKey
  unit: 'kg' | 'item'
  pricing: 'fixed' | 'custom'
  default_price: number | null
  active: number
}

export interface Order {
  id: number
  customer_id: number | null
  customer_name: string
  customer_location: string | null
  customer_phone: string | null
  created_at: string
  status: OrderStatus
  is_delivery: number
  total: number
  notes: string | null
}

export interface OrderItem {
  id: number
  order_id: number
  service_id: number
  quantity: number | null
  unit_price: number | null
  total: number | null
}

export interface OrderGarment {
  id: number
  order_id: number
  garment: string
  quantity: number
  special_care: number
}

// phase 1: drop-off intake
export interface OrderIntake {
  customer_id: number | null
  customer_name: string
  customer_location: string | null
  customer_phone: string | null
  is_delivery: boolean
  service_ids: number[]
  notes: string | null
}

// phase 2: detail input
export interface ItemDetailInput {
  item_id: number
  quantity: number
  unit_price: number // for fixed pricing the caller passes the service default; main re-validates
}

export interface GarmentInput {
  garment: string
  quantity: number
  special_care: boolean
}

export interface OrderDetailsInput {
  order_id: number
  items: ItemDetailInput[]
  garments: GarmentInput[]
}

export interface MonthlyReport {
  revenue: number
  expenses: number
  profit: number
  daily: { day: number; revenue: number }[]
}

export interface Expense {
  id: number
  date: string
  category: 'supplies' | 'utilities' | 'rent' | 'other'
  description: string | null
  amount: number
}

export interface TodayStats {
  income: number
  waitingInput: number
  inProgress: number
  readyForPickup: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: shared domain types for two-phase orders"
```

---

### Task 3: DB layer (schema + seed)

**Files:**
- Create: `src/main/db.ts`
- Test: `tests/db.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/db.test.ts`
Expected: FAIL — `Cannot find module '../src/main/db'`

- [ ] **Step 3: Implement `src/main/db.ts`**

```ts
import Database from 'better-sqlite3'

export function openDb(path: string): Database.Database {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      phone TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      pricing TEXT NOT NULL,
      default_price REAL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_location TEXT,
      customer_phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      status TEXT NOT NULL DEFAULT 'waiting_input',
      is_delivery INTEGER NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id),
      quantity REAL,
      unit_price REAL,
      total REAL
    );
    CREATE TABLE IF NOT EXISTS order_garments (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      garment TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      special_care INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  `)

  const seed = db.transaction(() => {
    const ins = db.prepare(
      'INSERT OR IGNORE INTO services (key, unit, pricing, default_price) VALUES (?, ?, ?, ?)'
    )
    ins.run('wash_dry_fold', 'kg', 'fixed', 150)
    ins.run('wash_dry_fold_iron', 'kg', 'fixed', 200)
    ins.run('iron', 'item', 'custom', null)
    ins.run('dry_clean', 'item', 'custom', null)
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('delivery_fee','20')").run()
  })
  seed()
  return db
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/db.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/db.ts tests/db.test.ts
git commit -m "feat: sqlite schema with two-phase orders and garments, seed price model"
```

---

### Task 4: Pricing + status logic

**Files:**
- Create: `src/main/logic/pricing.ts`, `src/main/logic/status.ts`
- Test: `tests/pricing.test.ts`, `tests/status.test.ts`

- [ ] **Step 1: Write the failing pricing test (`tests/pricing.test.ts`)**

```ts
import { describe, it, expect } from 'vitest'
import { computeOrderTotal } from '../src/main/logic/pricing'

describe('computeOrderTotal', () => {
  it('sums item totals plus delivery', () => {
    expect(
      computeOrderTotal(
        [
          { quantity: 3, unit_price: 150 },  // wash/dry/fold 3kg = 450
          { quantity: 4, unit_price: 60 }    // dry clean 4 items @ custom 60 = 240
        ],
        true,
        20
      )
    ).toBe(710)
  })

  it('no delivery fee when not delivery', () => {
    expect(computeOrderTotal([{ quantity: 2, unit_price: 200 }], false, 20)).toBe(400)
  })

  it('rejects empty items', () => {
    expect(() => computeOrderTotal([], false, 20)).toThrow('order must have at least one item')
  })

  it('rejects non-positive quantity or price', () => {
    expect(() => computeOrderTotal([{ quantity: 0, unit_price: 100 }], false, 20)).toThrow()
    expect(() => computeOrderTotal([{ quantity: 1, unit_price: 0 }], false, 20)).toThrow()
  })
})
```

- [ ] **Step 2: Write the failing status test (`tests/status.test.ts`)**

```ts
import { describe, it, expect } from 'vitest'
import { nextStatus } from '../src/main/logic/status'

describe('nextStatus', () => {
  it('follows waiting_input → in_progress → complete → closed', () => {
    expect(nextStatus('waiting_input')).toBe('in_progress')
    expect(nextStatus('in_progress')).toBe('complete')
    expect(nextStatus('complete')).toBe('closed')
  })

  it('closed is terminal', () => {
    expect(nextStatus('closed')).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify both fail**

Run: `npm test -- tests/pricing.test.ts tests/status.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 4: Implement `src/main/logic/pricing.ts`**

```ts
export interface PricedItem {
  quantity: number
  unit_price: number
}

export function computeOrderTotal(items: PricedItem[], isDelivery: boolean, deliveryFee: number): number {
  if (items.length === 0) throw new Error('order must have at least one item')
  for (const it of items) {
    if (it.quantity <= 0) throw new Error('quantity must be positive')
    if (it.unit_price <= 0) throw new Error('unit price must be positive')
  }
  const sum = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0)
  return sum + (isDelivery ? deliveryFee : 0)
}
```

- [ ] **Step 5: Implement `src/main/logic/status.ts`**

```ts
import type { OrderStatus } from '../../shared/types'

const FLOW: Record<OrderStatus, OrderStatus | null> = {
  waiting_input: 'in_progress',
  in_progress: 'complete',
  complete: 'closed',
  closed: null
}

export function nextStatus(s: OrderStatus): OrderStatus | null {
  return FLOW[s]
}
```

- [ ] **Step 6: Run tests to verify both pass**

Run: `npm test -- tests/pricing.test.ts tests/status.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add src/main/logic tests/pricing.test.ts tests/status.test.ts
git commit -m "feat: order pricing and forward-only status flow"
```

---

### Task 5: Reports logic

**Files:**
- Create: `src/main/logic/reports.ts`
- Test: `tests/reports.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/reports.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/main/logic/reports.ts`**

```ts
import type Database from 'better-sqlite3'
import type { MonthlyReport } from '../../shared/types'

export function monthlyReport(db: Database.Database, year: number, month: number): MonthlyReport {
  const prefix = `${year}-${String(month).padStart(2, '0')}`

  const revenue = (db
    .prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE created_at LIKE ? || '%'")
    .get(prefix) as { s: number }).s

  const expenses = (db
    .prepare("SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date LIKE ? || '%'")
    .get(prefix) as { s: number }).s

  const daily = db
    .prepare(
      `SELECT CAST(strftime('%d', created_at) AS INTEGER) AS day, SUM(total) AS revenue
       FROM orders WHERE created_at LIKE ? || '%'
       GROUP BY day ORDER BY day`
    )
    .all(prefix) as { day: number; revenue: number }[]

  return { revenue, expenses, profit: revenue - expenses, daily }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/reports.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/logic/reports.ts tests/reports.test.ts
git commit -m "feat: monthly revenue/expense/profit report query"
```

---

### Task 6: Backup module

**Files:**
- Create: `src/main/backup.ts`

- [ ] **Step 1: Implement `src/main/backup.ts`** (filesystem glue — verified manually in Task 13)

```ts
import fs from 'node:fs'
import path from 'node:path'

export function backupDb(dbPath: string, backupDir: string, keep = 30): string | null {
  if (!fs.existsSync(dbPath)) return null
  fs.mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const dest = path.join(backupDir, `laundry-${stamp}.db`)
  fs.copyFileSync(dbPath, dest)

  const old = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith('laundry-') && f.endsWith('.db'))
    .sort()
    .reverse()
    .slice(keep)
  for (const f of old) fs.unlinkSync(path.join(backupDir, f))
  return dest
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/backup.ts
git commit -m "feat: timestamped db backup, keep newest 30"
```

---

### Task 7: IPC layer + preload bridge

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts` (scaffold template)
- Modify: `src/preload/index.ts` (scaffold template)
- Create: `src/renderer/src/env.d.ts` addition

- [ ] **Step 1: Implement `src/main/ipc.ts`**

```ts
import { ipcMain, shell } from 'electron'
import type Database from 'better-sqlite3'
import { computeOrderTotal } from './logic/pricing'
import { nextStatus } from './logic/status'
import { monthlyReport } from './logic/reports'
import { backupDb } from './backup'
import type { OrderIntake, OrderDetailsInput, OrderStatus } from '../shared/types'

export function registerIpc(db: Database.Database, dbPath: string, backupDir: string): void {
  // --- customers (regulars only; never auto-created from orders) ---
  ipcMain.handle('customers:list', () =>
    db.prepare('SELECT * FROM customers ORDER BY name').all())

  ipcMain.handle('customers:search', (_e, q: string) =>
    db.prepare(
      `SELECT c.*, (SELECT MAX(created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order
       FROM customers c WHERE c.name LIKE '%' || ? || '%' ORDER BY c.name LIMIT 8`
    ).all(q))

  ipcMain.handle('customers:create', (_e, c: { name: string; location: string | null; phone: string | null; notes: string | null }) => {
    if (!c.name?.trim()) throw new Error('name required')
    return db.prepare('INSERT INTO customers (name, location, phone, notes) VALUES (?,?,?,?)')
      .run(c.name.trim(), c.location, c.phone, c.notes).lastInsertRowid
  })

  ipcMain.handle('customers:delete', (_e, id: number) =>
    db.prepare('DELETE FROM customers WHERE id=?').run(id).changes)

  // --- orders: phase 1 (drop-off intake) ---
  ipcMain.handle('orders:intake', (_e, input: OrderIntake) => {
    if (!input.customer_name?.trim()) throw new Error('customer name required')
    if (input.service_ids.length === 0) throw new Error('pick at least one service')
    const tx = db.transaction(() => {
      const orderId = db.prepare(
        `INSERT INTO orders (customer_id, customer_name, customer_location, customer_phone, is_delivery, notes)
         VALUES (?,?,?,?,?,?)`
      ).run(
        input.customer_id, input.customer_name.trim(), input.customer_location,
        input.customer_phone, input.is_delivery ? 1 : 0, input.notes
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
    const fee = Number((db.prepare("SELECT value FROM settings WHERE key='delivery_fee'").get() as { value: string }).value)
    const total = computeOrderTotal(
      input.items.map((i) => ({ quantity: i.quantity, unit_price: i.unit_price })),
      order.is_delivery === 1,
      fee
    )
    const tx = db.transaction(() => {
      const upd = db.prepare('UPDATE order_items SET quantity=?, unit_price=?, total=? WHERE id=? AND order_id=?')
      for (const i of input.items) upd.run(i.quantity, i.unit_price, i.quantity * i.unit_price, i.item_id, input.order_id)

      db.prepare('DELETE FROM order_garments WHERE order_id=?').run(input.order_id)
      const insG = db.prepare(
        'INSERT INTO order_garments (order_id, garment, quantity, special_care) VALUES (?,?,?,?)'
      )
      for (const g of input.garments)
        insG.run(input.order_id, g.garment, g.quantity, g.special_care ? 1 : 0)

      const newStatus = order.status === 'waiting_input' ? 'in_progress' : order.status
      db.prepare('UPDATE orders SET total=?, status=? WHERE id=?').run(total, newStatus, input.order_id)
    })
    tx()
    return total
  })

  ipcMain.handle('orders:list', (_e, status: OrderStatus) =>
    db.prepare('SELECT * FROM orders WHERE status=? ORDER BY created_at DESC').all(status))

  ipcMain.handle('orders:get', (_e, id: number) => ({
    order: db.prepare('SELECT * FROM orders WHERE id=?').get(id),
    items: db.prepare(
      `SELECT oi.*, s.key AS service_key, s.unit, s.pricing, s.default_price
       FROM order_items oi JOIN services s ON s.id = oi.service_id WHERE oi.order_id=?`
    ).all(id),
    garments: db.prepare('SELECT * FROM order_garments WHERE order_id=?').all(id)
  }))

  ipcMain.handle('orders:advanceStatus', (_e, id: number) => {
    const row = db.prepare('SELECT status FROM orders WHERE id=?').get(id) as { status: OrderStatus } | undefined
    if (!row) return 0
    const next = nextStatus(row.status)
    if (!next) return 0
    return db.prepare('UPDATE orders SET status=? WHERE id=?').run(next, id).changes
  })

  ipcMain.handle('orders:delete', (_e, id: number) =>
    db.prepare('DELETE FROM orders WHERE id=?').run(id).changes)

  // --- expenses ---
  ipcMain.handle('expenses:create', (_e, x: { date: string; category: string; description: string | null; amount: number }) => {
    if (x.amount <= 0) throw new Error('amount must be positive')
    return db.prepare('INSERT INTO expenses (date, category, description, amount) VALUES (?,?,?,?)')
      .run(x.date, x.category, x.description, x.amount).lastInsertRowid
  })

  ipcMain.handle('expenses:list', (_e, monthPrefix: string) =>
    db.prepare("SELECT * FROM expenses WHERE date LIKE ? || '%' ORDER BY date DESC").all(monthPrefix))

  ipcMain.handle('expenses:delete', (_e, id: number) =>
    db.prepare('DELETE FROM expenses WHERE id=?').run(id).changes)

  // --- services / settings / reports / home ---
  ipcMain.handle('services:list', () =>
    db.prepare('SELECT * FROM services WHERE active=1 ORDER BY id').all())

  ipcMain.handle('services:updatePrice', (_e, p: { id: number; default_price: number }) =>
    db.prepare("UPDATE services SET default_price=? WHERE id=? AND pricing='fixed'").run(p.default_price, p.id).changes)

  ipcMain.handle('settings:get', (_e, key: string) =>
    (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined)?.value ?? null)

  ipcMain.handle('reports:monthly', (_e, year: number, month: number) => monthlyReport(db, year, month))

  ipcMain.handle('home:today', () => {
    const today = new Date().toISOString().slice(0, 10)
    const n = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { c: number }).c
    return {
      income: (db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE created_at LIKE ? || '%'").get(today) as { s: number }).s,
      waitingInput: n("SELECT COUNT(*) AS c FROM orders WHERE status='waiting_input'"),
      inProgress: n("SELECT COUNT(*) AS c FROM orders WHERE status='in_progress'"),
      readyForPickup: n("SELECT COUNT(*) AS c FROM orders WHERE status='complete'")
    }
  })

  // --- backup ---
  ipcMain.handle('backup:run', () => backupDb(dbPath, backupDir))
  ipcMain.handle('backup:openFolder', () => shell.openPath(backupDir))
}
```

- [ ] **Step 2: Wire main process — modify `src/main/index.ts`**

Add imports at top; inside `app.whenReady().then(() => { ... })` BEFORE `createWindow()`:

```ts
import path from 'node:path'
import { app } from 'electron'
import { openDb } from './db'
import { registerIpc } from './ipc'
import { backupDb } from './backup'

// inside app.whenReady():
const userData = app.getPath('userData')
const dbPath = path.join(userData, 'laundry.db')
const backupDir = path.join(userData, 'backups')
backupDb(dbPath, backupDir) // snapshot previous session's data on every launch
const db = openDb(dbPath)
registerIpc(db, dbPath, backupDir)
```

Also set the window icon in the `new BrowserWindow({ ... })` options:

```ts
icon: path.join(__dirname, '../../icon/duckduckwash-icon-256.png')
```

Keep everything else from the template unchanged.

- [ ] **Step 3: Replace `src/preload/index.ts` with typed bridge**

```ts
import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api = {
  customers: {
    list: () => invoke('customers:list'),
    search: (q: string) => invoke('customers:search', q),
    create: (c: unknown) => invoke('customers:create', c),
    remove: (id: number) => invoke('customers:delete', id)
  },
  orders: {
    intake: (o: unknown) => invoke('orders:intake', o),
    saveDetails: (d: unknown) => invoke('orders:saveDetails', d),
    list: (status: string) => invoke('orders:list', status),
    get: (id: number) => invoke('orders:get', id),
    advanceStatus: (id: number) => invoke('orders:advanceStatus', id),
    remove: (id: number) => invoke('orders:delete', id)
  },
  expenses: {
    create: (x: unknown) => invoke('expenses:create', x),
    list: (monthPrefix: string) => invoke('expenses:list', monthPrefix),
    remove: (id: number) => invoke('expenses:delete', id)
  },
  services: {
    list: () => invoke('services:list'),
    updatePrice: (p: unknown) => invoke('services:updatePrice', p)
  },
  settings: { get: (key: string) => invoke('settings:get', key) },
  reports: { monthly: (y: number, m: number) => invoke('reports:monthly', y, m) },
  home: { today: () => invoke('home:today') },
  backup: { run: () => invoke('backup:run'), openFolder: () => invoke('backup:openFolder') }
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
```

Append to `src/renderer/src/env.d.ts`:

```ts
import type { Api } from '../../preload/index'
declare global { interface Window { api: Api } }
export {}
```

- [ ] **Step 4: Verify** — `npm run dev`, DevTools console: `await window.api.services.list()` → 4 services.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/index.ts src/preload/index.ts src/renderer/src/env.d.ts
git commit -m "feat: ipc for two-phase orders, typed preload bridge, window icon"
```

---

### Task 8: App shell with logo

**Files:**
- Modify: `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`
- Create: placeholder screens (each replaced in later tasks)

- [ ] **Step 1: Copy logo into renderer assets**

```bash
cp icon/duckduckwash-logo.png src/renderer/src/assets/logo.png
```

- [ ] **Step 2: Replace `src/renderer/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: Replace `src/renderer/src/App.tsx`**

```tsx
import { useState } from 'react'
import logo from './assets/logo.png'
import Home from './screens/Home'
import NewOrder from './screens/NewOrder'
import Orders from './screens/Orders'
import OrderDetails from './screens/OrderDetails'
import Customers from './screens/Customers'
import Expenses from './screens/Expenses'
import Reports from './screens/Reports'
import Settings from './screens/Settings'

export type Screen =
  | { name: 'home' } | { name: 'newOrder' } | { name: 'orders' }
  | { name: 'orderDetails'; orderId: number }
  | { name: 'customers' } | { name: 'expenses' } | { name: 'reports' } | { name: 'settings' }

const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' }
] as const

export default function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  return (
    <div className="flex h-screen flex-col text-lg">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <img src={logo} alt="DuckDuckWash" className="h-10" />
        <span className="text-xl font-bold">DuckDuckWash</span>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        {screen.name === 'home' && <Home go={setScreen} />}
        {screen.name === 'newOrder' && <NewOrder go={setScreen} />}
        {screen.name === 'orders' && <Orders go={setScreen} />}
        {screen.name === 'orderDetails' && <OrderDetails orderId={screen.orderId} go={setScreen} />}
        {screen.name === 'customers' && <Customers />}
        {screen.name === 'expenses' && <Expenses />}
        {screen.name === 'reports' && <Reports />}
        {screen.name === 'settings' && <Settings />}
      </main>
      <nav className="btm-nav btm-nav-lg static border-t">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={screen.name === tab.key ? 'active text-primary' : ''}
            onClick={() => setScreen({ name: tab.key } as Screen)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
```

- [ ] **Step 4: Create placeholder screens** (each is fully replaced by its later task)

```tsx
// src/renderer/src/screens/Home.tsx (replaced in Task 9)
import type { Screen } from '../App'
export default function Home({ go }: { go: (s: Screen) => void }): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/NewOrder.tsx (replaced in Task 10)
import type { Screen } from '../App'
export default function NewOrder({ go }: { go: (s: Screen) => void }): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/Orders.tsx (replaced in Task 11)
import type { Screen } from '../App'
export default function Orders({ go }: { go: (s: Screen) => void }): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/OrderDetails.tsx (replaced in Task 11)
import type { Screen } from '../App'
export default function OrderDetails({ orderId, go }: { orderId: number; go: (s: Screen) => void }): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/Customers.tsx (replaced in Task 12)
export default function Customers(): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/Expenses.tsx (replaced in Task 12)
export default function Expenses(): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/Reports.tsx (replaced in Task 13)
export default function Reports(): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/Settings.tsx (replaced in Task 13)
export default function Settings(): JSX.Element { return <div /> }
```

- [ ] **Step 5: Verify** — `npm run dev`: header shows duck logo + name, bottom nav has 6 tabs.

- [ ] **Step 6: Commit**

```bash
git add src/renderer
git commit -m "feat: app shell with DuckDuckWash branding and bottom nav"
```

---

### Task 9: Home screen

**Files:**
- Modify: `src/renderer/src/screens/Home.tsx` (replace placeholder)

- [ ] **Step 1: Implement Home**

```tsx
import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import type { TodayStats } from '../../../shared/types'

export default function Home({ go }: { go: (s: Screen) => void }): JSX.Element {
  const [stats, setStats] = useState<TodayStats>({ income: 0, waitingInput: 0, inProgress: 0, readyForPickup: 0 })

  useEffect(() => {
    window.api.home.today().then(setStats)
  }, [])

  const cards = [
    { label: 'Income today', value: `${stats.income.toLocaleString()} ฿` },
    { label: 'Waiting for input', value: String(stats.waitingInput) },
    { label: 'In progress', value: String(stats.inProgress) },
    { label: 'Ready for pickup', value: String(stats.readyForPickup) }
  ]

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card bg-base-200 shadow">
            <div className="card-body items-center text-center">
              <div className="text-base opacity-70">{c.label}</div>
              <div className="text-4xl font-bold">{c.value}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-lg h-32 flex-1 text-3xl" onClick={() => go({ name: 'newOrder' })}>
        + New Order
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify** — `npm run dev`: 4 cards (zeros) + giant New Order button.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/screens/Home.tsx
git commit -m "feat: home screen with status counts and new-order button"
```

---

### Task 10: New Order screen (phase 1: drop-off)

**Files:**
- Modify: `src/renderer/src/screens/NewOrder.tsx` (replace placeholder)

Behavior contract:
- Autocomplete queries saved regulars only; picking one sets `customer_id` and copies name/location/phone. Free-typed walk-ins keep `customer_id = null` — never create customer rows.
- Service buttons are multi-select toggles (no quantities/prices here).
- Save disabled until: name non-empty AND ≥1 service selected. Save → status `waiting_input`, back to Home.

- [ ] **Step 1: Implement NewOrder**

```tsx
import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import type { Customer, Service } from '../../../shared/types'

type Suggestion = Customer & { last_order: string | null }

const SERVICE_LABELS: Record<string, string> = {
  wash_dry_fold: 'Wash / Dry / Fold',
  wash_dry_fold_iron: 'Wash / Dry / Fold / Iron',
  iron: 'Iron',
  dry_clean: 'Dry clean'
}

export default function NewOrder({ go }: { go: (s: Screen) => void }): JSX.Element {
  const [services, setServices] = useState<Service[]>([])
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [phone, setPhone] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [delivery, setDelivery] = useState(false)

  useEffect(() => {
    window.api.services.list().then(setServices)
  }, [])

  useEffect(() => {
    if (customerId !== null || name.trim().length < 2) { setSuggestions([]); return }
    window.api.customers.search(name.trim()).then(setSuggestions)
  }, [name, customerId])

  const valid = name.trim() !== '' && selected.length > 0

  function toggleService(id: number): void {
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }
  function pick(c: Suggestion): void {
    setCustomerId(c.id); setName(c.name); setLocation(c.location ?? ''); setPhone(c.phone ?? ''); setSuggestions([])
  }
  async function save(): Promise<void> {
    await window.api.orders.intake({
      customer_id: customerId,
      customer_name: name.trim(),
      customer_location: location.trim() || null,
      customer_phone: phone.trim() || null,
      is_delivery: delivery,
      service_ids: selected,
      notes: null
    })
    go({ name: 'home' })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="relative">
        <input className="input input-bordered input-lg w-full" placeholder="Customer name"
          value={name} onChange={(e) => { setName(e.target.value); setCustomerId(null) }} />
        {suggestions.length > 0 && (
          <ul className="menu absolute z-10 w-full rounded-box bg-base-200 shadow">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button onClick={() => pick(c)}>
                  <b>{c.name}</b> {c.location ?? ''} {c.phone ?? ''} {c.last_order ? `· last ${c.last_order.slice(0, 10)}` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input className="input input-bordered input-lg w-full" placeholder="Room / Hotel (optional)"
        value={location} onChange={(e) => setLocation(e.target.value)} />
      <input className="input input-bordered input-lg w-full" placeholder="Phone (optional)"
        value={phone} onChange={(e) => setPhone(e.target.value)} />
      {customerId === null && name.trim() !== '' && (
        <div className="text-sm opacity-60">Walk-in names are not saved as regular customers</div>
      )}

      <div className="font-bold">Services</div>
      <div className="grid grid-cols-2 gap-2">
        {services.map((s) => (
          <button key={s.id}
            className={`btn btn-lg ${selected.includes(s.id) ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => toggleService(s.id)}>
            {SERVICE_LABELS[s.key]}
          </button>
        ))}
      </div>

      <label className="label cursor-pointer justify-start gap-2">
        <input type="checkbox" className="toggle toggle-lg" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
        Delivery (+20 ฿)
      </label>

      <div className="flex gap-2">
        <button className="btn btn-lg flex-1" onClick={() => go({ name: 'home' })}>Cancel</button>
        <button className="btn btn-primary btn-lg flex-1" disabled={!valid} onClick={save}>Create order</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify manually** — create order with 2 services; Home "Waiting for input" becomes 1. DevTools: `await window.api.customers.list()` → `[]` (walk-in not saved).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/screens/NewOrder.tsx
git commit -m "feat: drop-off intake form with service multi-select"
```

---

### Task 11: Orders + Order Details screens

**Files:**
- Modify: `src/renderer/src/screens/Orders.tsx`, `src/renderer/src/screens/OrderDetails.tsx` (replace placeholders)

- [ ] **Step 1: Implement Orders**

```tsx
import { useCallback, useEffect, useState } from 'react'
import type { Screen } from '../App'
import type { Order, OrderStatus } from '../../../shared/types'

const TABS: { key: OrderStatus; label: string }[] = [
  { key: 'waiting_input', label: 'Waiting input' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'complete', label: 'Ready for pickup' },
  { key: 'closed', label: 'Closed' }
]

export default function Orders({ go }: { go: (s: Screen) => void }): JSX.Element {
  const [tab, setTab] = useState<OrderStatus>('waiting_input')
  const [orders, setOrders] = useState<Order[]>([])
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'close'; id: number } | null>(null)

  const reload = useCallback(() => { window.api.orders.list(tab).then(setOrders) }, [tab])
  useEffect(reload, [reload])

  async function advance(id: number): Promise<void> { await window.api.orders.advanceStatus(id); setConfirm(null); reload() }
  async function remove(id: number): Promise<void> { await window.api.orders.remove(id); setConfirm(null); reload() }

  return (
    <div className="flex flex-col gap-4">
      <div className="tabs-boxed tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab tab-lg ${tab === t.key ? 'tab-active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {orders.map((o) => (
        <div key={o.id} className="flex items-center gap-3 rounded-box bg-base-200 p-4">
          <div className="flex-1">
            <div className="text-xl font-bold">
              {o.customer_name} {o.customer_location ? `· ${o.customer_location}` : ''}
            </div>
            <div className="opacity-70">
              {o.created_at} · {o.total > 0 ? `${o.total.toLocaleString()} ฿` : '—'}
              {o.is_delivery ? ' · delivery' : ''}
            </div>
          </div>
          {o.status === 'waiting_input' && (
            <button className="btn btn-primary btn-lg" onClick={() => go({ name: 'orderDetails', orderId: o.id })}>
              Add details
            </button>
          )}
          {o.status === 'in_progress' && (
            <>
              <button className="btn btn-lg" onClick={() => go({ name: 'orderDetails', orderId: o.id })}>Edit</button>
              <button className="btn btn-primary btn-lg" onClick={() => advance(o.id)}>Mark complete</button>
            </>
          )}
          {o.status === 'complete' && (
            <button className="btn btn-success btn-lg" onClick={() => setConfirm({ kind: 'close', id: o.id })}>
              Close (paid & picked up)
            </button>
          )}
          {o.status !== 'closed' && (
            <button className="btn btn-ghost" onClick={() => setConfirm({ kind: 'delete', id: o.id })}>✕</button>
          )}
        </div>
      ))}

      {confirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <p className="text-xl">
              {confirm.kind === 'delete' ? 'Delete this order?' : 'Customer paid and picked up — close this order?'}
            </p>
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setConfirm(null)}>Cancel</button>
              {confirm.kind === 'delete'
                ? <button className="btn btn-error btn-lg" onClick={() => remove(confirm.id)}>Delete</button>
                : <button className="btn btn-success btn-lg" onClick={() => advance(confirm.id)}>Close order</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement OrderDetails (phase 2)**

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { Screen } from '../App'
import type { Order, OrderGarment } from '../../../shared/types'

interface ItemRow {
  id: number
  service_key: string
  unit: 'kg' | 'item'
  pricing: 'fixed' | 'custom'
  default_price: number | null
  quantity: number | null
  unit_price: number | null
}

const SERVICE_LABELS: Record<string, string> = {
  wash_dry_fold: 'Wash / Dry / Fold',
  wash_dry_fold_iron: 'Wash / Dry / Fold / Iron',
  iron: 'Iron',
  dry_clean: 'Dry clean'
}
const GARMENT_PRESETS = ['Shirt', 'Pants', 'Shorts', 'Dress', 'Skirt', 'Blouse', 'Jacket', 'Bras', 'Underwear', 'Other']

interface GarmentRow { garment: string; quantity: number; special_care: boolean }

export default function OrderDetails({ orderId, go }: { orderId: number; go: (s: Screen) => void }): JSX.Element {
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [garments, setGarments] = useState<GarmentRow[]>([])
  const [fee, setFee] = useState(20)

  useEffect(() => {
    window.api.orders.get(orderId).then((r: { order: Order; items: ItemRow[]; garments: OrderGarment[] }) => {
      setOrder(r.order)
      setItems(r.items.map((i) => ({ ...i, unit_price: i.unit_price ?? i.default_price })))
      setGarments(r.garments.map((g) => ({
        garment: g.garment, quantity: g.quantity, special_care: g.special_care === 1
      })))
    })
    window.api.settings.get('delivery_fee').then((v: string | null) => setFee(Number(v ?? 20)))
  }, [orderId])

  const total = useMemo(() => {
    const sum = items.reduce((s, i) => s + (i.quantity ?? 0) * (i.unit_price ?? 0), 0)
    return sum + (order?.is_delivery ? fee : 0)
  }, [items, order, fee])

  const valid =
    items.every((i) => (i.quantity ?? 0) > 0 && (i.unit_price ?? 0) > 0) &&
    garments.length > 0 &&
    garments.every((g) => g.quantity >= 1)

  function updItem(id: number, patch: Partial<ItemRow>): void {
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }
  function addGarment(g: string): void {
    setGarments([...garments, { garment: g, quantity: 1, special_care: false }])
  }
  function updGarment(idx: number, patch: Partial<GarmentRow>): void {
    setGarments(garments.map((g, i) => (i === idx ? { ...g, ...patch } : g)))
  }

  async function save(): Promise<void> {
    await window.api.orders.saveDetails({
      order_id: orderId,
      items: items.map((i) => ({ item_id: i.id, quantity: i.quantity!, unit_price: i.unit_price! })),
      garments
    })
    go({ name: 'orders' })
  }

  if (!order) return <div />

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="text-xl font-bold">
        {order.customer_name} {order.customer_location ? `· ${order.customer_location}` : ''} · {order.created_at}
      </div>

      <div className="font-bold">Services</div>
      {items.map((i) => (
        <div key={i.id} className="flex items-center gap-2 rounded-box bg-base-200 p-3">
          <span className="flex-1">{SERVICE_LABELS[i.service_key]}</span>
          <input type="number" min="0" step={i.unit === 'kg' ? '0.1' : '1'}
            className="input input-bordered w-28 text-right"
            placeholder={i.unit === 'kg' ? 'kg' : 'items'}
            value={i.quantity ?? ''} onChange={(e) => updItem(i.id, { quantity: Number(e.target.value) || null })} />
          <input type="number" min="0" className="input input-bordered w-32 text-right"
            placeholder="price/unit"
            value={i.unit_price ?? ''} readOnly={i.pricing === 'fixed'}
            onChange={(e) => updItem(i.id, { unit_price: Number(e.target.value) || null })} />
          <span className="w-24 text-right font-bold">
            {((i.quantity ?? 0) * (i.unit_price ?? 0)).toLocaleString()} ฿
          </span>
        </div>
      ))}

      <div className="font-bold">Garments (required — what is in this order?)</div>
      <div className="flex flex-wrap gap-2">
        {GARMENT_PRESETS.map((g) => (
          <button key={g} className="btn btn-outline" onClick={() => addGarment(g)}>+ {g}</button>
        ))}
      </div>
      {garments.map((g, idx) => (
        <div key={idx} className="flex items-center gap-3 rounded-box bg-base-200 p-3">
          <span className="flex-1">{g.garment}</span>
          <input type="number" min="1" className="input input-bordered w-20 text-right"
            value={g.quantity} onChange={(e) => updGarment(idx, { quantity: Number(e.target.value) || 1 })} />
          <label className="label cursor-pointer gap-1">
            <input type="checkbox" className="checkbox checkbox-warning" checked={g.special_care}
              onChange={(e) => updGarment(idx, { special_care: e.target.checked })} />
            special care
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => setGarments(garments.filter((_, i2) => i2 !== idx))}>✕</button>
        </div>
      ))}

      <div className="text-right text-4xl font-bold">
        Total: {total.toLocaleString()} ฿ {order.is_delivery ? `(incl. ${fee} delivery)` : ''}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-lg flex-1" onClick={() => go({ name: 'orders' })}>Cancel</button>
        <button className="btn btn-primary btn-lg flex-1" disabled={!valid} onClick={save}>Save details</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify manually** — order from Task 10: "Add details" → fill kg; Save stays disabled until at least one garment row is added (counts ≥1) → add garments with flags → Save → order appears under In progress with total; Mark complete → Ready for pickup; Close (confirm) → Closed tab, read-only.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/Orders.tsx src/renderer/src/screens/OrderDetails.tsx
git commit -m "feat: orders board with status flow and detail input screen"
```

---

### Task 12: Customers + Expenses screens

**Files:**
- Modify: `src/renderer/src/screens/Customers.tsx`, `src/renderer/src/screens/Expenses.tsx` (replace placeholders)

- [ ] **Step 1: Implement Customers**

```tsx
import { useCallback, useEffect, useState } from 'react'
import type { Customer } from '../../../shared/types'

const EMPTY = { name: '', location: '', phone: '', notes: '' }

export default function Customers(): JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const reload = useCallback(() => { window.api.customers.list().then(setCustomers) }, [])
  useEffect(reload, [reload])

  async function save(): Promise<void> {
    if (!form || !form.name.trim()) return
    await window.api.customers.create({
      name: form.name, location: form.location || null, phone: form.phone || null, notes: form.notes || null
    })
    setForm(null); reload()
  }
  async function remove(id: number): Promise<void> {
    await window.api.customers.remove(id); setConfirmDelete(null); reload()
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="btn btn-primary btn-lg" onClick={() => setForm(EMPTY)}>+ Regular customer</button>

      {customers.map((c) => (
        <div key={c.id} className="flex items-center gap-3 rounded-box bg-base-200 p-4">
          <div className="flex-1">
            <div className="text-xl font-bold">{c.name}</div>
            <div className="opacity-70">{[c.location, c.phone, c.notes].filter(Boolean).join(' · ')}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(c.id)}>✕</button>
        </div>
      ))}

      {form && (
        <div className="modal modal-open">
          <div className="modal-box flex flex-col gap-3">
            <input className="input input-bordered input-lg" placeholder="Name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input input-bordered input-lg" placeholder="Location"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <input className="input input-bordered input-lg" placeholder="Phone"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input input-bordered input-lg" placeholder="Notes"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary btn-lg" disabled={!form.name.trim()} onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="modal modal-open">
          <div className="modal-box">
            <p className="text-xl">Delete this customer? Past orders are kept.</p>
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-error btn-lg" onClick={() => remove(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement Expenses**

```tsx
import { useCallback, useEffect, useState } from 'react'
import type { Expense } from '../../../shared/types'

const CATS = ['supplies', 'utilities', 'rent', 'other'] as const
const CAT_LABELS: Record<(typeof CATS)[number], string> = {
  supplies: 'Supplies', utilities: 'Utilities', rent: 'Rent', other: 'Other'
}

export default function Expenses(): JSX.Element {
  const month = new Date().toISOString().slice(0, 7)
  const [items, setItems] = useState<Expense[]>([])
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [cat, setCat] = useState<(typeof CATS)[number]>('supplies')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const reload = useCallback(() => { window.api.expenses.list(month).then(setItems) }, [month])
  useEffect(reload, [reload])

  async function save(): Promise<void> {
    await window.api.expenses.create({ date, category: cat, description: note || null, amount: Number(amount) })
    setAdding(false); setAmount(''); setNote(''); reload()
  }
  async function remove(id: number): Promise<void> {
    await window.api.expenses.remove(id); setConfirmDelete(null); reload()
  }

  return (
    <div className="flex flex-col gap-4">
      <button className="btn btn-primary btn-lg" onClick={() => setAdding(true)}>+ Expense</button>

      {items.map((x) => (
        <div key={x.id} className="flex items-center gap-3 rounded-box bg-base-200 p-4">
          <div className="flex-1">
            <div className="text-xl font-bold">{CAT_LABELS[x.category]} · {x.amount.toLocaleString()} ฿</div>
            <div className="opacity-70">{x.date} {x.description ? `· ${x.description}` : ''}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(x.id)}>✕</button>
        </div>
      ))}

      {adding && (
        <div className="modal modal-open">
          <div className="modal-box flex flex-col gap-3">
            <input type="date" className="input input-bordered input-lg" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              {CATS.map((c) => (
                <button key={c} className={`btn btn-lg ${cat === c ? 'btn-primary' : 'btn-outline'}`} onClick={() => setCat(c)}>
                  {CAT_LABELS[c]}
                </button>
              ))}
            </div>
            <input type="number" min="0" className="input input-bordered input-lg text-right" placeholder="Amount"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className="input input-bordered input-lg" placeholder="Note (optional)"
              value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-primary btn-lg" disabled={Number(amount) <= 0} onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="modal modal-open">
          <div className="modal-box">
            <p className="text-xl">Delete this expense?</p>
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-error btn-lg" onClick={() => remove(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify manually** — add a regular; appears in New Order autocomplete. Add an expense.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/Customers.tsx src/renderer/src/screens/Expenses.tsx
git commit -m "feat: regular customers crud and expenses screen"
```

---

### Task 13: Reports + Settings screens

**Files:**
- Modify: `src/renderer/src/screens/Reports.tsx`, `src/renderer/src/screens/Settings.tsx` (replace placeholders)

- [ ] **Step 1: Implement Reports** (pure-CSS bar chart)

```tsx
import { useEffect, useState } from 'react'
import type { MonthlyReport } from '../../../shared/types'

export default function Reports(): JSX.Element {
  const now = new Date()
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [report, setReport] = useState<MonthlyReport | null>(null)

  useEffect(() => {
    const [y, m] = ym.split('-').map(Number)
    window.api.reports.monthly(y, m).then(setReport)
  }, [ym])

  const max = Math.max(1, ...(report?.daily.map((d) => d.revenue) ?? [1]))
  const cards = report
    ? [
        { label: 'Revenue', value: report.revenue, cls: 'text-success' },
        { label: 'Expenses', value: report.expenses, cls: 'text-error' },
        { label: 'Profit', value: report.profit, cls: report.profit >= 0 ? 'text-success' : 'text-error' }
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2">
        Month
        <input type="month" className="input input-bordered input-lg" value={ym} onChange={(e) => setYm(e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card bg-base-200 shadow">
            <div className="card-body items-center text-center">
              <div className="opacity-70">{c.label}</div>
              <div className={`text-4xl font-bold ${c.cls}`}>{c.value.toLocaleString()} ฿</div>
            </div>
          </div>
        ))}
      </div>
      {report && (
        <div className="flex h-48 items-end gap-1 rounded-box bg-base-200 p-3">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
            const rev = report.daily.find((d) => d.day === day)?.revenue ?? 0
            return (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-primary" style={{ height: `${(rev / max) * 100}%` }} title={`${day}: ${rev}`} />
                {day % 5 === 0 && <span className="text-xs opacity-50">{day}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement Settings**

```tsx
import { useEffect, useState } from 'react'
import type { Service } from '../../../shared/types'

const SERVICE_LABELS: Record<string, string> = {
  wash_dry_fold: 'Wash / Dry / Fold',
  wash_dry_fold_iron: 'Wash / Dry / Fold / Iron',
  iron: 'Iron',
  dry_clean: 'Dry clean'
}

export default function Settings(): JSX.Element {
  const [services, setServices] = useState<Service[]>([])
  const [backedUp, setBackedUp] = useState(false)

  useEffect(() => { window.api.services.list().then(setServices) }, [])

  async function savePrice(id: number, price: number): Promise<void> {
    await window.api.services.updatePrice({ id, default_price: price })
  }
  async function runBackup(): Promise<void> {
    await window.api.backup.run(); setBackedUp(true); setTimeout(() => setBackedUp(false), 3000)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <div className="mb-2 font-bold">Price list (per kg services)</div>
        {services.filter((s) => s.pricing === 'fixed').map((s) => (
          <label key={s.id} className="mb-2 flex items-center gap-2">
            <span className="flex-1">{SERVICE_LABELS[s.key]} (/{s.unit})</span>
            <input type="number" min="0" className="input input-bordered w-32 text-right"
              defaultValue={s.default_price ?? 0}
              onBlur={(e) => savePrice(s.id, Number(e.target.value))} />
          </label>
        ))}
        <div className="text-sm opacity-60">Iron and Dry clean are priced per order.</div>
      </div>

      <div className="flex gap-2">
        <button className="btn btn-lg flex-1" onClick={runBackup}>
          {backedUp ? 'Backup created ✓' : 'Back up now'}
        </button>
        <button className="btn btn-lg flex-1" onClick={() => window.api.backup.openFolder()}>
          Open backup folder
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify manually** — Reports matches created orders/expenses; price edit persists; "Back up now" creates a file (check via "Open backup folder" — also verifies Task 6).

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Reports.tsx src/renderer/src/screens/Settings.tsx
git commit -m "feat: reports with daily bar chart, settings with prices and backup"
```

---

### Task 14: Windows installer

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json`

- [ ] **Step 1: Create `electron-builder.yml`**

```yaml
appId: com.duckduckwash.app
productName: DuckDuckWash
directories:
  output: release
files:
  - out/**
win:
  target: nsis
  icon: icon/duckduckwash-icon-256.png
nsis:
  oneClick: true
  perMachine: false
  deleteAppDataOnUninstall: false   # never wipe the database on uninstall
```

- [ ] **Step 2: Add build script to `package.json`**

```json
"build:win": "electron-vite build && electron-builder --win"
```

- [ ] **Step 3: Build and smoke-test the installer**

Run: `npm run build:win`
Expected: `release/DuckDuckWash Setup *.exe` produced with the duck icon. Install, run the full flow (intake → details → complete → close), relaunch — data persists, `backups/` gains a copy.

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml package.json
git commit -m "build: nsis windows installer with DuckDuckWash branding"
```

---

## Self-Review Notes

- Spec coverage: two-phase flow (T7 `orders:intake`/`orders:saveDetails`, T10 intake UI, T11 details UI), status flow waiting_input→in_progress→complete→closed forward-only (T4 `nextStatus`, T7, T11; close behind confirm), price model with fixed/custom pricing + flat 20 delivery (T3 seed, T4, T11), garment checklist with counts and special_care flag, required at detail save, no iron flag (T3 `order_garments`, T11), walk-in-not-saved rule (T7 intake never inserts customers, T10 hint), duplicate-name disambiguation (T10 suggestions show location/phone/last order), English-only (no i18n anywhere), branding from `./icon` (T7 window icon, T8 header logo, T14 installer icon), backup on launch + manual (T6, T7, T13), reports (T5, T13), editable fixed prices (T13), installer that preserves DB on uninstall (T14). Roles = future scope, no task, intentional.
- No placeholders: every code step has complete code; T8 placeholder screens exist only to compile and are each replaced by a named later task.
- Type consistency: `window.api` (T7) matches all screen call sites; `Screen` union with `orderDetails.orderId` (T8) matches T11 usage; `pricing: 'fixed' | 'custom'` drives readonly price inputs in T11 and the Settings filter in T13; statuses everywhere match the `OrderStatus` union.
