# Laundry Care — Design Spec

**Date:** 2026-06-12
**Status:** Approved pending final user review

## 1. Overview

A local-only store management app for a small laundry business, run by a non-technical elderly owner on a single Windows PC. Replaces a messy Excel workflow. No cloud, no customer-facing site, no data import — starts fresh.

**Primary goals:** laundry order tracking, revenue reports, expense reports.
**UX north star:** usable by low-tech and elderly users — big text (≥18px), big buttons, every action reachable in ≤2 clicks, no nested menus, confirmation on destructive actions.

## 2. Stack

- **Electron** (packaged with electron-builder, Windows installer)
- **React + TypeScript** (renderer)
- **Tailwind CSS + daisyUI** (UI components)
- **SQLite** via better-sqlite3 in the main process, WAL mode
- **react-i18next** for i18n
- **Vitest** for tests

### Architecture

- Renderer never touches the DB. All data access goes through typed IPC channels (e.g., `orders:create`, `orders:list`, `reports:monthly`, `expenses:create`).
- Main process owns: SQLite access, business logic (price calculation, report aggregation), backup scheduler.
- This separation keeps a future move to cloud (or LAN server) a data-layer-only change.

### i18n

- Language toggle is a **text button labeled "ไทย" / "English"** — no flag icons.
- **Default language: English** (employees are Burmese and read English; owner uses Thai).
- Selected language persists in `settings`.

### Backup

- On every app launch, copy `laundry.db` to `backups/` with a timestamped filename; keep the most recent 30 copies.
- Settings screen has "Back up now" and "Open backup folder" buttons.
- Reports screen can export the current month to an Excel file.

## 3. Data Model (SQLite)

```sql
customers (                     -- REGULARS ONLY, added deliberately by the user
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,          -- NOT unique: 3 Peters can coexist
  location TEXT,               -- hotel/condo + room, optional
  phone TEXT,                  -- optional
  notes TEXT,
  created_at TEXT NOT NULL
)

orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),  -- NULL for walk-ins; set only when a saved regular is picked
  customer_name TEXT NOT NULL, -- always stored inline on the order (walk-in name, or snapshot of the regular's name)
  customer_location TEXT,      -- inline, optional
  created_at TEXT NOT NULL,    -- full datetime; name+location+datetime is the practical order identifier
  status TEXT NOT NULL DEFAULT 'received',  -- received | ready | delivered
  is_delivery INTEGER NOT NULL DEFAULT 0,   -- adds flat 20 THB
  paid INTEGER NOT NULL DEFAULT 0,          -- cash-only store, no payment method
  total REAL NOT NULL,         -- denormalized sum of items (+delivery)
  notes TEXT
)

services (                      -- editable price list, seeded with defaults
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,    -- laundry | bedding | bedding_iron | ironing | dry_cleaning
  unit TEXT NOT NULL,          -- kg | item | custom
  default_price REAL,          -- NULL for dry_cleaning (manual price)
  active INTEGER NOT NULL DEFAULT 1
)

order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  quantity REAL NOT NULL,      -- kg or item count; 1 for dry_cleaning
  unit_price REAL NOT NULL,    -- copied from services at creation; later price changes don't affect old orders
  total REAL NOT NULL
)

expenses (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT NOT NULL,      -- supplies | utilities | rent | other (preset, extensible)
  description TEXT,
  amount REAL NOT NULL
)

settings (key TEXT PRIMARY KEY, value TEXT)
```

Service names are not stored in the DB rows — `key` maps to i18n strings so names follow the language toggle.

### Seeded price list (THB)

| key | unit | default price |
|---|---|---|
| laundry (wash+dry+fold) | kg | 150 |
| bedding | kg | 150 |
| bedding_iron (bedding + ironing) | kg | 200 |
| ironing | item | 40 |
| dry_cleaning | custom | manual entry (from 100) |

Delivery: flat 20 THB, a flag on the order, not a service row.

Reports are computed live from queries — no stored totals beyond `orders.total`/`order_items.total`.

## 4. Screens

1. **Home** — today's summary cards (income today, undelivered orders, unpaid orders) + one big **+ New Order** button.
2. **New Order** — single form:
   - Customer: type name → autocomplete suggests **saved regulars only**. Each suggestion shows **name + location + phone + last-order date** to disambiguate duplicates. Typing a name that matches nothing just stores it inline on the order — walk-ins are NOT added to the customers table (most are foreign travelers who won't return). Saving a regular is a deliberate action on the Customers screen.
   - Tap a big service button (5 services) → enter kg/items → price auto-calculates and shows immediately. Dry cleaning asks for a manual price. Multiple line items per order.
   - Toggles: delivery (+20), paid.
   - Large running total at the bottom → Save → back to Home.
3. **Orders** — list with status tabs (Received / Ready / Delivered). Every row shows **customer name + location + datetime**. One big button per row advances status to the next step; a second button marks paid.
4. **Customers** — list of saved regulars + big **+ Regular Customer** button (name, location, phone, notes). This is the ONLY place customers are created; orders never auto-create them.
5. **Expenses** — list + big **+ Expense** button: date (defaults to today), 4 big category buttons, amount, optional note.
6. **Reports** — month picker → three cards: revenue / expenses / profit, plus one daily bar chart. Excel export. (Hidden from the future assistant role.)
7. **Settings** — language toggle, price list editor, backup now, open backup folder.

## 5. Roles

- **Phase 1 (now):** no login. App opens straight to Home. Owner is the only user.
- **Future (if scaled):** two fixed PIN-protected modes — admin (owner, sees everything) and one shared assistant account (employees; Reports hidden). No full user-management system. Schema requires no migration for this — it's a UI gate stored in `settings`.

## 6. Error Handling

- All writes in transactions; SQLite WAL mode — a power cut mid-write cannot corrupt data.
- Form validation: no negative prices/quantities, no empty required fields; Save disabled until valid.
- Deleting an order or customer always shows a confirmation dialog.
- Deleting a regular customer keeps their past orders intact — orders carry the name/location inline, so history never breaks.

## 7. Testing

- **Vitest** for business logic (price calculation, report aggregation) and the DB layer against in-memory SQLite.
- No e2e suite initially — manual testing with the owner is the acceptance test.

## 8. Out of Scope

- Excel data import (aunt's files are too inconsistent to parse reliably)
- Customer-facing anything (status page, notifications)
- Payment methods (cash only)
- Personal expense tracking (business only)
- Receipts/printing, multi-store, networking
