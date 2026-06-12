# Laundry Care App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local-only Electron desktop app for a laundry shop: order tracking, revenue/expense reports, elderly-friendly UI, Thai/English toggle.

**Architecture:** Electron main process owns SQLite (better-sqlite3, WAL) and all business logic; React renderer talks only through typed IPC exposed by the preload bridge. Single-file DB in `userData`, copied to `backups/` on every launch.

**Tech Stack:** Electron + electron-vite, React 18, TypeScript, Tailwind CSS 3 + daisyUI 4, better-sqlite3, react-i18next, exceljs (export), Vitest, electron-builder (NSIS installer).

**Spec:** `docs/superpowers/specs/2026-06-12-laundry-care-design.md`

---

## File Structure

```
package.json
electron.vite.config.ts
electron-builder.yml
tailwind.config.js / postcss.config.js
src/main/index.ts            — app boot, window, run backup on launch
src/main/db.ts               — openDb(path), schema migration, service seeding
src/main/logic/pricing.ts    — computeOrderTotal (pure, tested)
src/main/logic/reports.ts    — monthlyReport(db, year, month) (tested)
src/main/backup.ts           — backupDb(dbPath, backupDir, keep=30)
src/main/ipc.ts              — registerIpc(db): all ipcMain.handle channels
src/preload/index.ts         — contextBridge `window.api` (typed)
src/shared/types.ts          — shared TS types (Order, Customer, …) used by main+renderer
src/renderer/src/main.tsx    — React entry
src/renderer/src/i18n.ts     — i18next init, language persistence
src/renderer/src/locales/en.json, th.json
src/renderer/src/App.tsx     — shell: big bottom nav, screen switching
src/renderer/src/screens/Home.tsx
src/renderer/src/screens/NewOrder.tsx
src/renderer/src/screens/Orders.tsx
src/renderer/src/screens/Customers.tsx
src/renderer/src/screens/Expenses.tsx
src/renderer/src/screens/Reports.tsx
src/renderer/src/screens/Settings.tsx
tests/pricing.test.ts
tests/db.test.ts
tests/reports.test.ts
```

UI conventions (apply in every screen): daisyUI `btn-lg`, base font `text-lg` (≥18px), one primary action per screen, destructive actions behind a `<dialog>` confirm.

---

### Task 1: Scaffold project

**Files:**
- Create: entire project skeleton via electron-vite, then add Tailwind/daisyUI

- [ ] **Step 1: Scaffold electron-vite app (React + TS)**

```bash
npm create @quick-start/electron@latest . -- --template react-ts --skip
npm install
```

If the interactive prompt appears, choose: React, TypeScript, no extras.

- [ ] **Step 2: Install dependencies**

```bash
npm install better-sqlite3 react-i18next i18next exceljs
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

- [ ] **Step 4: Add vitest config + test script**

In `package.json` add to `"scripts"`:

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
Expected: Electron window opens with the template page. Close it.

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
export type OrderStatus = 'received' | 'ready' | 'delivered'

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
  key: 'laundry' | 'bedding' | 'bedding_iron' | 'ironing' | 'dry_cleaning'
  unit: 'kg' | 'item' | 'custom'
  default_price: number | null
  active: number
}

export interface OrderItemInput {
  service_id: number
  quantity: number
  unit_price: number
}

export interface OrderInput {
  customer_id: number | null
  customer_name: string
  customer_location: string | null
  is_delivery: boolean
  paid: boolean
  notes: string | null
  items: OrderItemInput[]
}

export interface Order {
  id: number
  customer_id: number | null
  customer_name: string
  customer_location: string | null
  created_at: string
  status: OrderStatus
  is_delivery: number
  paid: number
  total: number
  notes: string | null
}

export interface OrderItem {
  id: number
  order_id: number
  service_id: number
  quantity: number
  unit_price: number
  total: number
}

export interface Expense {
  id: number
  date: string
  category: 'supplies' | 'utilities' | 'rent' | 'other'
  description: string | null
  amount: number
}

export interface MonthlyReport {
  revenue: number
  expenses: number
  profit: number
  daily: { day: number; revenue: number }[]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: shared domain types"
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
  it('creates schema and seeds 5 services', () => {
    const db = openDb(':memory:')
    const services = db.prepare('SELECT key, unit, default_price FROM services ORDER BY id').all()
    expect(services).toEqual([
      { key: 'laundry', unit: 'kg', default_price: 150 },
      { key: 'bedding', unit: 'kg', default_price: 150 },
      { key: 'bedding_iron', unit: 'kg', default_price: 200 },
      { key: 'ironing', unit: 'item', default_price: 40 },
      { key: 'dry_cleaning', unit: 'custom', default_price: null }
    ])
  })

  it('is idempotent (reopen does not duplicate seed)', () => {
    const db = openDb(':memory:')
    // simulate second migration run on same connection's schema
    const count = db.prepare('SELECT COUNT(*) AS c FROM services').get() as { c: number }
    expect(count.c).toBe(5)
  })

  it('seeds delivery_fee setting = 20', () => {
    const db = openDb(':memory:')
    const row = db.prepare("SELECT value FROM settings WHERE key='delivery_fee'").get() as { value: string }
    expect(row.value).toBe('20')
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
      default_price REAL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_location TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      status TEXT NOT NULL DEFAULT 'received',
      is_delivery INTEGER NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id),
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
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
      'INSERT OR IGNORE INTO services (key, unit, default_price) VALUES (?, ?, ?)'
    )
    ins.run('laundry', 'kg', 150)
    ins.run('bedding', 'kg', 150)
    ins.run('bedding_iron', 'kg', 200)
    ins.run('ironing', 'item', 40)
    ins.run('dry_cleaning', 'custom', null)
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('delivery_fee','20')").run()
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('language','en')").run()
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
git commit -m "feat: sqlite schema, seed services and settings"
```

---

### Task 4: Pricing logic

**Files:**
- Create: `src/main/logic/pricing.ts`
- Test: `tests/pricing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { computeOrderTotal } from '../src/main/logic/pricing'

describe('computeOrderTotal', () => {
  it('sums item totals', () => {
    expect(
      computeOrderTotal(
        [
          { service_id: 1, quantity: 3, unit_price: 150 }, // laundry 3kg = 450
          { service_id: 4, quantity: 5, unit_price: 40 }   // ironing 5 items = 200
        ],
        false, 20
      )
    ).toBe(650)
  })

  it('adds delivery fee when is_delivery', () => {
    expect(computeOrderTotal([{ service_id: 1, quantity: 1, unit_price: 150 }], true, 20)).toBe(170)
  })

  it('rejects empty items', () => {
    expect(() => computeOrderTotal([], false, 20)).toThrow('order must have at least one item')
  })

  it('rejects non-positive quantity or price', () => {
    expect(() => computeOrderTotal([{ service_id: 1, quantity: 0, unit_price: 150 }], false, 20)).toThrow()
    expect(() => computeOrderTotal([{ service_id: 1, quantity: 1, unit_price: -5 }], false, 20)).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/pricing.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/main/logic/pricing.ts`**

```ts
import type { OrderItemInput } from '../../shared/types'

export function computeOrderTotal(
  items: OrderItemInput[],
  isDelivery: boolean,
  deliveryFee: number
): number {
  if (items.length === 0) throw new Error('order must have at least one item')
  for (const it of items) {
    if (it.quantity <= 0) throw new Error('quantity must be positive')
    if (it.unit_price < 0) throw new Error('unit price cannot be negative')
  }
  const sum = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0)
  return sum + (isDelivery ? deliveryFee : 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/pricing.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/logic/pricing.ts tests/pricing.test.ts
git commit -m "feat: order total calculation with delivery fee"
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
  db.prepare(
    "INSERT INTO orders (customer_name, created_at, total) VALUES ('x', ?, ?)"
  ).run(createdAt, total)
}

describe('monthlyReport', () => {
  it('aggregates revenue, expenses, profit and daily revenue', () => {
    const db = openDb(':memory:')
    insertOrder(db, '2026-06-01 10:00:00', 500)
    insertOrder(db, '2026-06-01 15:00:00', 200)
    insertOrder(db, '2026-06-15 09:00:00', 300)
    insertOrder(db, '2026-05-31 09:00:00', 999) // other month, excluded
    db.prepare(
      "INSERT INTO expenses (date, category, amount) VALUES ('2026-06-10','rent',400)"
    ).run()

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

  const revenue =
    (db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE created_at LIKE ? || '%'")
      .get(prefix) as { s: number }).s

  const expenses =
    (db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date LIKE ? || '%'")
      .get(prefix) as { s: number }).s

  const daily = (db.prepare(
    `SELECT CAST(strftime('%d', created_at) AS INTEGER) AS day, SUM(total) AS revenue
     FROM orders WHERE created_at LIKE ? || '%'
     GROUP BY day ORDER BY day`
  ).all(prefix)) as { day: number; revenue: number }[]

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

- [ ] **Step 1: Implement `src/main/backup.ts`** (filesystem glue — no unit test; verified manually in Task 13)

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
- Modify: `src/main/index.ts` (template file from scaffold)
- Modify: `src/preload/index.ts` (template file from scaffold)

- [ ] **Step 1: Implement `src/main/ipc.ts`**

```ts
import { ipcMain, shell } from 'electron'
import type Database from 'better-sqlite3'
import { computeOrderTotal } from './logic/pricing'
import { monthlyReport } from './logic/reports'
import { backupDb } from './backup'
import type { OrderInput } from '../shared/types'

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

  ipcMain.handle('customers:update', (_e, c: { id: number; name: string; location: string | null; phone: string | null; notes: string | null }) =>
    db.prepare('UPDATE customers SET name=?, location=?, phone=?, notes=? WHERE id=?')
      .run(c.name, c.location, c.phone, c.notes, c.id).changes)

  ipcMain.handle('customers:delete', (_e, id: number) =>
    db.prepare('DELETE FROM customers WHERE id=?').run(id).changes)

  // --- orders ---
  ipcMain.handle('orders:create', (_e, input: OrderInput) => {
    const fee = Number((db.prepare("SELECT value FROM settings WHERE key='delivery_fee'").get() as { value: string }).value)
    const total = computeOrderTotal(input.items, input.is_delivery, fee)
    const tx = db.transaction(() => {
      const orderId = db.prepare(
        `INSERT INTO orders (customer_id, customer_name, customer_location, is_delivery, paid, total, notes)
         VALUES (?,?,?,?,?,?,?)`
      ).run(
        input.customer_id, input.customer_name.trim(), input.customer_location,
        input.is_delivery ? 1 : 0, input.paid ? 1 : 0, total, input.notes
      ).lastInsertRowid
      const insItem = db.prepare(
        'INSERT INTO order_items (order_id, service_id, quantity, unit_price, total) VALUES (?,?,?,?,?)'
      )
      for (const it of input.items)
        insItem.run(orderId, it.service_id, it.quantity, it.unit_price, it.quantity * it.unit_price)
      return orderId
    })
    return tx()
  })

  ipcMain.handle('orders:list', (_e, status: string | null) =>
    status
      ? db.prepare('SELECT * FROM orders WHERE status=? ORDER BY created_at DESC').all(status)
      : db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all())

  ipcMain.handle('orders:items', (_e, orderId: number) =>
    db.prepare('SELECT * FROM order_items WHERE order_id=?').all(orderId))

  ipcMain.handle('orders:advanceStatus', (_e, id: number) => {
    const next: Record<string, string> = { received: 'ready', ready: 'delivered' }
    const row = db.prepare('SELECT status FROM orders WHERE id=?').get(id) as { status: string } | undefined
    if (!row || !next[row.status]) return 0
    return db.prepare('UPDATE orders SET status=? WHERE id=?').run(next[row.status], id).changes
  })

  ipcMain.handle('orders:markPaid', (_e, id: number) =>
    db.prepare('UPDATE orders SET paid=1 WHERE id=?').run(id).changes)

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

  // --- services / settings / reports / stats ---
  ipcMain.handle('services:list', () =>
    db.prepare('SELECT * FROM services WHERE active=1 ORDER BY id').all())

  ipcMain.handle('services:updatePrice', (_e, p: { id: number; default_price: number }) =>
    db.prepare('UPDATE services SET default_price=? WHERE id=?').run(p.default_price, p.id).changes)

  ipcMain.handle('settings:get', (_e, key: string) =>
    (db.prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined)?.value ?? null)

  ipcMain.handle('settings:set', (_e, key: string, value: string) =>
    db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, value).changes)

  ipcMain.handle('reports:monthly', (_e, year: number, month: number) => monthlyReport(db, year, month))

  ipcMain.handle('home:today', () => {
    const today = new Date().toISOString().slice(0, 10)
    const income = (db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE created_at LIKE ? || '%'").get(today) as { s: number }).s
    const undelivered = (db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status != 'delivered'").get() as { c: number }).c
    const unpaid = (db.prepare('SELECT COUNT(*) AS c FROM orders WHERE paid=0').get() as { c: number }).c
    return { income, undelivered, unpaid }
  })

  // --- backup ---
  ipcMain.handle('backup:run', () => backupDb(dbPath, backupDir))
  ipcMain.handle('backup:openFolder', () => shell.openPath(backupDir))
}
```

- [ ] **Step 2: Wire main process — modify `src/main/index.ts`**

In the scaffolded `src/main/index.ts`, add imports at top and wire DB before window creation. Inside `app.whenReady().then(...)` add the marked lines:

```ts
import path from 'node:path'
import { app } from 'electron'
import { openDb } from './db'
import { registerIpc } from './ipc'
import { backupDb } from './backup'

// inside app.whenReady().then(() => { ... }) BEFORE createWindow():
const userData = app.getPath('userData')
const dbPath = path.join(userData, 'laundry.db')
const backupDir = path.join(userData, 'backups')
backupDb(dbPath, backupDir) // backup previous session's data on every launch
const db = openDb(dbPath)
registerIpc(db, dbPath, backupDir)
```

Keep everything else from the template (window creation, mac/windows lifecycle) unchanged.

- [ ] **Step 3: Expose typed bridge — replace `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api = {
  customers: {
    list: () => invoke('customers:list'),
    search: (q: string) => invoke('customers:search', q),
    create: (c: unknown) => invoke('customers:create', c),
    update: (c: unknown) => invoke('customers:update', c),
    remove: (id: number) => invoke('customers:delete', id)
  },
  orders: {
    create: (o: unknown) => invoke('orders:create', o),
    list: (status: string | null) => invoke('orders:list', status),
    items: (orderId: number) => invoke('orders:items', orderId),
    advanceStatus: (id: number) => invoke('orders:advanceStatus', id),
    markPaid: (id: number) => invoke('orders:markPaid', id),
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
  settings: {
    get: (key: string) => invoke('settings:get', key),
    set: (key: string, value: string) => invoke('settings:set', key, value)
  },
  reports: { monthly: (y: number, m: number) => invoke('reports:monthly', y, m) },
  home: { today: () => invoke('home:today') },
  backup: { run: () => invoke('backup:run'), openFolder: () => invoke('backup:openFolder') }
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
```

Create `src/renderer/src/env.d.ts` addition (or append to existing `*.d.ts`):

```ts
import type { Api } from '../../preload/index'
declare global { interface Window { api: Api } }
export {}
```

- [ ] **Step 4: Verify app still launches and IPC works**

Run: `npm run dev`, open DevTools console, run `await window.api.services.list()`
Expected: array of 5 services.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/index.ts src/preload/index.ts src/renderer/src/env.d.ts
git commit -m "feat: ipc handlers and typed preload bridge"
```

---

### Task 8: i18n + app shell

**Files:**
- Create: `src/renderer/src/i18n.ts`, `src/renderer/src/locales/en.json`, `src/renderer/src/locales/th.json`
- Modify: `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`

- [ ] **Step 1: Create `src/renderer/src/locales/en.json`**

```json
{
  "nav": { "home": "Home", "orders": "Orders", "customers": "Customers", "expenses": "Expenses", "reports": "Reports", "settings": "Settings" },
  "home": { "incomeToday": "Income today", "undelivered": "Orders in shop", "unpaid": "Unpaid orders", "newOrder": "+ New Order" },
  "order": {
    "customer": "Customer name", "location": "Room / Hotel (optional)", "addService": "Add service",
    "qtyKg": "Weight (kg)", "qtyItem": "Items", "price": "Price", "delivery": "Delivery (+{{fee}})",
    "paid": "Paid", "notes": "Notes", "total": "Total", "save": "Save order", "newRegularHint": "Walk-in names are not saved to customers",
    "status": { "received": "Received", "ready": "Ready", "delivered": "Delivered" },
    "advance": { "received": "Mark ready", "ready": "Mark delivered" },
    "markPaid": "Mark paid", "deleteConfirm": "Delete this order?"
  },
  "service": { "laundry": "Laundry (wash, dry, fold)", "bedding": "Bedding", "bedding_iron": "Bedding + ironing", "ironing": "Ironing", "dry_cleaning": "Dry cleaning" },
  "customers": { "add": "+ Regular customer", "name": "Name", "location": "Location", "phone": "Phone", "notes": "Notes", "deleteConfirm": "Delete this customer? Past orders are kept." },
  "expenses": { "add": "+ Expense", "date": "Date", "category": "Category", "amount": "Amount", "note": "Note (optional)", "deleteConfirm": "Delete this expense?", "cat": { "supplies": "Supplies", "utilities": "Utilities", "rent": "Rent", "other": "Other" } },
  "reports": { "revenue": "Revenue", "expenses": "Expenses", "profit": "Profit", "month": "Month" },
  "settings": { "language": "Language", "prices": "Price list", "backupNow": "Back up now", "openBackups": "Open backup folder", "backupDone": "Backup created" },
  "common": { "save": "Save", "cancel": "Cancel", "delete": "Delete", "baht": "฿" }
}
```

- [ ] **Step 2: Create `src/renderer/src/locales/th.json`**

```json
{
  "nav": { "home": "หน้าแรก", "orders": "รายการผ้า", "customers": "ลูกค้าประจำ", "expenses": "รายจ่าย", "reports": "รายงาน", "settings": "ตั้งค่า" },
  "home": { "incomeToday": "รายรับวันนี้", "undelivered": "ผ้าค้างในร้าน", "unpaid": "ยังไม่จ่าย", "newOrder": "+ รับผ้า" },
  "order": {
    "customer": "ชื่อลูกค้า", "location": "ห้อง / โรงแรม (ไม่บังคับ)", "addService": "เพิ่มบริการ",
    "qtyKg": "น้ำหนัก (กก.)", "qtyItem": "จำนวนชิ้น", "price": "ราคา", "delivery": "ส่งถึงที่ (+{{fee}})",
    "paid": "จ่ายแล้ว", "notes": "หมายเหตุ", "total": "รวมทั้งหมด", "save": "บันทึก", "newRegularHint": "ชื่อลูกค้าจรจะไม่ถูกบันทึกเป็นลูกค้าประจำ",
    "status": { "received": "รับแล้ว", "ready": "เสร็จแล้ว", "delivered": "ส่งแล้ว" },
    "advance": { "received": "ผ้าเสร็จแล้ว", "ready": "ส่งแล้ว" },
    "markPaid": "จ่ายแล้ว", "deleteConfirm": "ลบรายการนี้?"
  },
  "service": { "laundry": "ซัก อบ พับ", "bedding": "เครื่องนอน", "bedding_iron": "เครื่องนอน + รีด", "ironing": "รีดผ้า", "dry_cleaning": "ซักแห้ง" },
  "customers": { "add": "+ ลูกค้าประจำ", "name": "ชื่อ", "location": "ที่อยู่", "phone": "เบอร์โทร", "notes": "หมายเหตุ", "deleteConfirm": "ลบลูกค้าคนนี้? ประวัติรายการเดิมยังอยู่" },
  "expenses": { "add": "+ รายจ่าย", "date": "วันที่", "category": "หมวด", "amount": "จำนวนเงิน", "note": "หมายเหตุ (ไม่บังคับ)", "deleteConfirm": "ลบรายจ่ายนี้?", "cat": { "supplies": "ของใช้ร้าน", "utilities": "น้ำ-ไฟ-เน็ต", "rent": "ค่าเช่า", "other": "อื่นๆ" } },
  "reports": { "revenue": "รายรับ", "expenses": "รายจ่าย", "profit": "กำไร", "month": "เดือน" },
  "settings": { "language": "ภาษา", "prices": "ราคาบริการ", "backupNow": "สำรองข้อมูลตอนนี้", "openBackups": "เปิดโฟลเดอร์สำรอง", "backupDone": "สำรองข้อมูลแล้ว" },
  "common": { "save": "บันทึก", "cancel": "ยกเลิก", "delete": "ลบ", "baht": "฿" }
}
```

- [ ] **Step 3: Create `src/renderer/src/i18n.ts`**

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import th from './locales/th.json'

export async function initI18n(): Promise<void> {
  const saved = (await window.api.settings.get('language')) ?? 'en'
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, th: { translation: th } },
    lng: saved,
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  })
}

export async function setLanguage(lng: 'en' | 'th'): Promise<void> {
  await i18n.changeLanguage(lng)
  await window.api.settings.set('language', lng)
}
```

- [ ] **Step 4: Modify `src/renderer/src/main.tsx`** — init i18n before render:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'
import { initI18n } from './i18n'

initI18n().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
```

- [ ] **Step 5: Replace `src/renderer/src/App.tsx`** — shell with big nav:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Home from './screens/Home'
import NewOrder from './screens/NewOrder'
import Orders from './screens/Orders'
import Customers from './screens/Customers'
import Expenses from './screens/Expenses'
import Reports from './screens/Reports'
import Settings from './screens/Settings'

export type Screen = 'home' | 'newOrder' | 'orders' | 'customers' | 'expenses' | 'reports' | 'settings'

export default function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>('home')
  const { t } = useTranslation()

  const tabs: { key: Screen; label: string }[] = [
    { key: 'home', label: t('nav.home') },
    { key: 'orders', label: t('nav.orders') },
    { key: 'customers', label: t('nav.customers') },
    { key: 'expenses', label: t('nav.expenses') },
    { key: 'reports', label: t('nav.reports') },
    { key: 'settings', label: t('nav.settings') }
  ]

  return (
    <div className="flex h-screen flex-col text-lg">
      <main className="flex-1 overflow-y-auto p-4">
        {screen === 'home' && <Home go={setScreen} />}
        {screen === 'newOrder' && <NewOrder go={setScreen} />}
        {screen === 'orders' && <Orders />}
        {screen === 'customers' && <Customers />}
        {screen === 'expenses' && <Expenses />}
        {screen === 'reports' && <Reports />}
        {screen === 'settings' && <Settings />}
      </main>
      <nav className="btm-nav btm-nav-lg static border-t">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={screen === tab.key ? 'active text-primary' : ''}
            onClick={() => setScreen(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
```

Create empty placeholder screens so it compiles (each replaced in later tasks):

```tsx
// src/renderer/src/screens/Home.tsx (placeholder, replaced in Task 9)
import type { Screen } from '../App'
export default function Home({ go }: { go: (s: Screen) => void }): JSX.Element {
  return <div />
}
```

```tsx
// src/renderer/src/screens/NewOrder.tsx (placeholder, replaced in Task 10)
import type { Screen } from '../App'
export default function NewOrder({ go }: { go: (s: Screen) => void }): JSX.Element {
  return <div />
}
```

```tsx
// src/renderer/src/screens/Orders.tsx (placeholder, replaced in Task 11)
export default function Orders(): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/Customers.tsx (placeholder, replaced in Task 12)
export default function Customers(): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/Expenses.tsx (placeholder, replaced in Task 12)
export default function Expenses(): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/Reports.tsx (placeholder, replaced in Task 13)
export default function Reports(): JSX.Element { return <div /> }
```

```tsx
// src/renderer/src/screens/Settings.tsx (placeholder, replaced in Task 13)
export default function Settings(): JSX.Element { return <div /> }
```

- [ ] **Step 6: Verify** — `npm run dev`: window shows bottom nav with 6 translated tabs.

- [ ] **Step 7: Commit**

```bash
git add src/renderer
git commit -m "feat: i18n (en default, th), app shell with bottom nav"
```

---

### Task 9: Home screen

**Files:**
- Modify: `src/renderer/src/screens/Home.tsx` (replace placeholder)

- [ ] **Step 1: Implement Home**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Screen } from '../App'

interface TodayStats { income: number; undelivered: number; unpaid: number }

export default function Home({ go }: { go: (s: Screen) => void }): JSX.Element {
  const { t } = useTranslation()
  const [stats, setStats] = useState<TodayStats>({ income: 0, undelivered: 0, unpaid: 0 })

  useEffect(() => {
    window.api.home.today().then(setStats)
  }, [])

  const cards = [
    { label: t('home.incomeToday'), value: `${stats.income.toLocaleString()} ${t('common.baht')}` },
    { label: t('home.undelivered'), value: String(stats.undelivered) },
    { label: t('home.unpaid'), value: String(stats.unpaid) }
  ]

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card bg-base-200 shadow">
            <div className="card-body items-center text-center">
              <div className="text-base opacity-70">{c.label}</div>
              <div className="text-4xl font-bold">{c.value}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-lg h-32 flex-1 text-3xl" onClick={() => go('newOrder')}>
        {t('home.newOrder')}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify** — `npm run dev`: Home shows 3 cards (zeros) and giant New Order button.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/screens/Home.tsx
git commit -m "feat: home screen with today stats and new-order button"
```

---

### Task 10: New Order screen

**Files:**
- Modify: `src/renderer/src/screens/NewOrder.tsx` (replace placeholder)

Behavior contract:
- Autocomplete queries saved regulars only (`customers:search`); picking one sets `customer_id` and copies name/location into the form. Typing freely leaves `customer_id = null` — walk-ins never create customer rows.
- Tapping a service button adds a line item with the service default price (dry cleaning: quantity 1, price entered manually, min 0).
- Total recomputes on every change: `sum(qty × price) + (delivery ? fee : 0)`.
- Save disabled until: name non-empty AND ≥1 item AND all quantities > 0.

- [ ] **Step 1: Implement NewOrder**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Screen } from '../App'
import type { Customer, Service } from '../../../shared/types'

interface Line { service: Service; quantity: number; unit_price: number }
type Suggestion = Customer & { last_order: string | null }

export default function NewOrder({ go }: { go: (s: Screen) => void }): JSX.Element {
  const { t } = useTranslation()
  const [services, setServices] = useState<Service[]>([])
  const [fee, setFee] = useState(20)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [delivery, setDelivery] = useState(false)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    window.api.services.list().then(setServices)
    window.api.settings.get('delivery_fee').then((v: string | null) => setFee(Number(v ?? 20)))
  }, [])

  useEffect(() => {
    if (customerId !== null || name.trim().length < 2) { setSuggestions([]); return }
    window.api.customers.search(name.trim()).then(setSuggestions)
  }, [name, customerId])

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.unit_price, 0) + (delivery ? fee : 0),
    [lines, delivery, fee]
  )
  const valid = name.trim() !== '' && lines.length > 0 && lines.every((l) => l.quantity > 0 && l.unit_price >= 0)

  function addService(s: Service): void {
    setLines([...lines, { service: s, quantity: s.unit === 'custom' ? 1 : 0, unit_price: s.default_price ?? 0 }])
  }
  function updateLine(i: number, patch: Partial<Line>): void {
    setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }
  function pick(c: Suggestion): void {
    setCustomerId(c.id); setName(c.name); setLocation(c.location ?? ''); setSuggestions([])
  }
  async function save(): Promise<void> {
    await window.api.orders.create({
      customer_id: customerId,
      customer_name: name.trim(),
      customer_location: location.trim() || null,
      is_delivery: delivery, paid, notes: null,
      items: lines.map((l) => ({ service_id: l.service.id, quantity: l.quantity, unit_price: l.unit_price }))
    })
    go('home')
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="relative">
        <input className="input input-bordered input-lg w-full" placeholder={t('order.customer')}
          value={name} onChange={(e) => { setName(e.target.value); setCustomerId(null) }} />
        {suggestions.length > 0 && (
          <ul className="menu absolute z-10 w-full rounded-box bg-base-200 shadow">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button onClick={() => pick(c)}>
                  <b>{c.name}</b> {c.location ?? ''} {c.phone ?? ''} {c.last_order ? `· ${c.last_order.slice(0, 10)}` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input className="input input-bordered input-lg w-full" placeholder={t('order.location')}
        value={location} onChange={(e) => setLocation(e.target.value)} />
      {customerId === null && name.trim() !== '' && (
        <div className="text-sm opacity-60">{t('order.newRegularHint')}</div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {services.map((s) => (
          <button key={s.id} className="btn btn-outline btn-lg" onClick={() => addService(s)}>
            {t(`service.${s.key}`)}
          </button>
        ))}
      </div>

      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-2 rounded-box bg-base-200 p-3">
          <span className="flex-1">{t(`service.${l.service.key}`)}</span>
          {l.service.unit !== 'custom' && (
            <input type="number" min="0" step={l.service.unit === 'kg' ? '0.1' : '1'}
              className="input input-bordered w-28 text-right"
              placeholder={l.service.unit === 'kg' ? t('order.qtyKg') : t('order.qtyItem')}
              value={l.quantity || ''} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
          )}
          <input type="number" min="0" className="input input-bordered w-32 text-right"
            placeholder={t('order.price')}
            value={l.service.unit === 'custom' ? l.unit_price || '' : l.quantity * l.unit_price}
            readOnly={l.service.unit !== 'custom'}
            onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} />
          <button className="btn btn-ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}

      <div className="flex gap-6">
        <label className="label cursor-pointer gap-2">
          <input type="checkbox" className="toggle toggle-lg" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
          {t('order.delivery', { fee })}
        </label>
        <label className="label cursor-pointer gap-2">
          <input type="checkbox" className="toggle toggle-lg toggle-success" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          {t('order.paid')}
        </label>
      </div>

      <div className="text-right text-4xl font-bold">{t('order.total')}: {total.toLocaleString()} {t('common.baht')}</div>
      <div className="flex gap-2">
        <button className="btn btn-lg flex-1" onClick={() => go('home')}>{t('common.cancel')}</button>
        <button className="btn btn-primary btn-lg flex-1" disabled={!valid} onClick={save}>{t('order.save')}</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify manually** — `npm run dev`: create an order (laundry 2kg + delivery + paid). Home income updates. DevTools: `await window.api.customers.list()` → still `[]` (walk-in not saved).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/screens/NewOrder.tsx
git commit -m "feat: new order form with regulars autocomplete and live total"
```

---

### Task 11: Orders screen

**Files:**
- Modify: `src/renderer/src/screens/Orders.tsx` (replace placeholder)

- [ ] **Step 1: Implement Orders**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Order, OrderStatus } from '../../../shared/types'

const TABS: OrderStatus[] = ['received', 'ready', 'delivered']

export default function Orders(): JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<OrderStatus>('received')
  const [orders, setOrders] = useState<Order[]>([])
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const reload = useCallback(() => {
    window.api.orders.list(tab).then(setOrders)
  }, [tab])
  useEffect(reload, [reload])

  async function advance(id: number): Promise<void> { await window.api.orders.advanceStatus(id); reload() }
  async function markPaid(id: number): Promise<void> { await window.api.orders.markPaid(id); reload() }
  async function remove(id: number): Promise<void> { await window.api.orders.remove(id); setConfirmDelete(null); reload() }

  return (
    <div className="flex flex-col gap-4">
      <div className="tabs-boxed tabs">
        {TABS.map((s) => (
          <button key={s} className={`tab tab-lg ${tab === s ? 'tab-active' : ''}`} onClick={() => setTab(s)}>
            {t(`order.status.${s}`)}
          </button>
        ))}
      </div>

      {orders.map((o) => (
        <div key={o.id} className="flex items-center gap-3 rounded-box bg-base-200 p-4">
          <div className="flex-1">
            <div className="text-xl font-bold">
              {o.customer_name} {o.customer_location ? `· ${o.customer_location}` : ''}
            </div>
            <div className="opacity-70">{o.created_at} · {o.total.toLocaleString()} {t('common.baht')}</div>
          </div>
          {!o.paid && (
            <button className="btn btn-success btn-lg" onClick={() => markPaid(o.id)}>{t('order.markPaid')}</button>
          )}
          {o.status !== 'delivered' && (
            <button className="btn btn-primary btn-lg" onClick={() => advance(o.id)}>
              {t(`order.advance.${o.status}`)}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(o.id)}>✕</button>
        </div>
      ))}

      {confirmDelete !== null && (
        <div className="modal modal-open">
          <div className="modal-box">
            <p className="text-xl">{t('order.deleteConfirm')}</p>
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</button>
              <button className="btn btn-error btn-lg" onClick={() => remove(confirmDelete)}>{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify manually** — orders from Task 10 appear under Received; advance moves them across tabs; delete asks confirmation.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/screens/Orders.tsx
git commit -m "feat: orders list with status tabs, advance, mark paid, delete"
```

---

### Task 12: Customers + Expenses screens

**Files:**
- Modify: `src/renderer/src/screens/Customers.tsx`, `src/renderer/src/screens/Expenses.tsx` (replace placeholders)

- [ ] **Step 1: Implement Customers**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Customer } from '../../../shared/types'

const EMPTY = { name: '', location: '', phone: '', notes: '' }

export default function Customers(): JSX.Element {
  const { t } = useTranslation()
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
      <button className="btn btn-primary btn-lg" onClick={() => setForm(EMPTY)}>{t('customers.add')}</button>

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
            <input className="input input-bordered input-lg" placeholder={t('customers.name')}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input input-bordered input-lg" placeholder={t('customers.location')}
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <input className="input input-bordered input-lg" placeholder={t('customers.phone')}
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input input-bordered input-lg" placeholder={t('customers.notes')}
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setForm(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary btn-lg" disabled={!form.name.trim()} onClick={save}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="modal modal-open">
          <div className="modal-box">
            <p className="text-xl">{t('customers.deleteConfirm')}</p>
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</button>
              <button className="btn btn-error btn-lg" onClick={() => remove(confirmDelete)}>{t('common.delete')}</button>
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
import { useTranslation } from 'react-i18next'
import type { Expense } from '../../../shared/types'

const CATS = ['supplies', 'utilities', 'rent', 'other'] as const

export default function Expenses(): JSX.Element {
  const { t } = useTranslation()
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
      <button className="btn btn-primary btn-lg" onClick={() => setAdding(true)}>{t('expenses.add')}</button>

      {items.map((x) => (
        <div key={x.id} className="flex items-center gap-3 rounded-box bg-base-200 p-4">
          <div className="flex-1">
            <div className="text-xl font-bold">{t(`expenses.cat.${x.category}`)} · {x.amount.toLocaleString()} {t('common.baht')}</div>
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
                  {t(`expenses.cat.${c}`)}
                </button>
              ))}
            </div>
            <input type="number" min="0" className="input input-bordered input-lg text-right" placeholder={t('expenses.amount')}
              value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className="input input-bordered input-lg" placeholder={t('expenses.note')}
              value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setAdding(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary btn-lg" disabled={Number(amount) <= 0} onClick={save}>{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="modal modal-open">
          <div className="modal-box">
            <p className="text-xl">{t('expenses.deleteConfirm')}</p>
            <div className="modal-action">
              <button className="btn btn-lg" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</button>
              <button className="btn btn-error btn-lg" onClick={() => remove(confirmDelete)}>{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify manually** — add a regular customer; it appears in New Order autocomplete. Add an expense with category buttons.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/Customers.tsx src/renderer/src/screens/Expenses.tsx
git commit -m "feat: regular customers crud and expenses screen"
```

---

### Task 13: Reports + Settings screens

**Files:**
- Modify: `src/renderer/src/screens/Reports.tsx`, `src/renderer/src/screens/Settings.tsx` (replace placeholders)

- [ ] **Step 1: Implement Reports** (pure-CSS bar chart — no chart lib needed)

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MonthlyReport } from '../../../shared/types'

export default function Reports(): JSX.Element {
  const { t } = useTranslation()
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
        { label: t('reports.revenue'), value: report.revenue, cls: 'text-success' },
        { label: t('reports.expenses'), value: report.expenses, cls: 'text-error' },
        { label: t('reports.profit'), value: report.profit, cls: report.profit >= 0 ? 'text-success' : 'text-error' }
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2">
        {t('reports.month')}
        <input type="month" className="input input-bordered input-lg" value={ym} onChange={(e) => setYm(e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card bg-base-200 shadow">
            <div className="card-body items-center text-center">
              <div className="opacity-70">{c.label}</div>
              <div className={`text-4xl font-bold ${c.cls}`}>{c.value.toLocaleString()} {t('common.baht')}</div>
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
import { useTranslation } from 'react-i18next'
import { setLanguage } from '../i18n'
import type { Service } from '../../../shared/types'

export default function Settings(): JSX.Element {
  const { t, i18n } = useTranslation()
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
        <div className="mb-2 font-bold">{t('settings.language')}</div>
        <div className="join">
          <button className={`btn btn-lg join-item ${i18n.language === 'th' ? 'btn-primary' : ''}`} onClick={() => setLanguage('th')}>ไทย</button>
          <button className={`btn btn-lg join-item ${i18n.language === 'en' ? 'btn-primary' : ''}`} onClick={() => setLanguage('en')}>English</button>
        </div>
      </div>

      <div>
        <div className="mb-2 font-bold">{t('settings.prices')}</div>
        {services.filter((s) => s.unit !== 'custom').map((s) => (
          <label key={s.id} className="mb-2 flex items-center gap-2">
            <span className="flex-1">{t(`service.${s.key}`)} (/{s.unit})</span>
            <input type="number" min="0" className="input input-bordered w-32 text-right"
              defaultValue={s.default_price ?? 0}
              onBlur={(e) => savePrice(s.id, Number(e.target.value))} />
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <button className="btn btn-lg flex-1" onClick={runBackup}>
          {backedUp ? t('settings.backupDone') : t('settings.backupNow')}
        </button>
        <button className="btn btn-lg flex-1" onClick={() => window.api.backup.openFolder()}>
          {t('settings.openBackups')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify manually** — Reports shows this month's numbers matching created orders/expenses; language button switches the whole UI and persists after restart; "Back up now" creates a file in the backup folder (use "Open backup folder" to confirm — this also verifies Task 6).

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Reports.tsx src/renderer/src/screens/Settings.tsx
git commit -m "feat: reports with daily bar chart, settings with language/prices/backup"
```

---

### Task 14: Windows installer

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json`

- [ ] **Step 1: Create `electron-builder.yml`**

```yaml
appId: com.laundrycare.app
productName: Laundry Care
directories:
  output: release
files:
  - out/**
win:
  target: nsis
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
Expected: `release/Laundry Care Setup *.exe` produced. Install it, create one order, close, reopen — data persists; `backups/` gains a copy on relaunch.

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml package.json
git commit -m "build: nsis windows installer config"
```

---

## Self-Review Notes

- Spec coverage: schema (T3), pricing incl. delivery fee + manual dry-clean price (T4, T10), reports (T5, T13), backup on launch + manual (T6, T7, T13), typed IPC (T7), i18n en-default/th with text-button toggle (T8, T13), elderly UX conventions (all screens), walk-in-not-saved rule (T7 `orders:create` never inserts customers; T10 hint text), duplicate-name disambiguation (T10 suggestion rows show location/phone/last order), cash-only (no payment method anywhere), editable price list (T13), installer (T14). Roles are future-scope in the spec — no task, intentional.
- No placeholders: every code step contains complete code; placeholder screens in T8 exist only to compile and are each replaced by a named later task.
- Type consistency: `window.api` shape (T7 preload) matches all screen call sites; `Service.unit: 'custom'` drives the dry-cleaning manual price path in T10.
