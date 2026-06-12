# DuckDuckWash — Design Spec

**Date:** 2026-06-12 (revised same day: app name, business flow, statuses, price model, English-only)
**Status:** Approved pending final user review

## 1. Overview

**DuckDuckWash** — a local-only store management app for a small laundry business, run by a non-technical elderly owner on a single Windows PC. Replaces a messy Excel workflow. No cloud, no customer-facing site, no data import — starts fresh.

**Primary goals:** laundry order tracking (two-phase entry matching the real shop flow), revenue reports, expense reports.
**UX north star:** usable by low-tech and elderly users — big text (≥18px), big buttons, every action reachable in ≤2 clicks, no nested menus, confirmation on destructive actions.
**Language:** English only.
**Branding:** assets in `./icon/` (`duckduckwash-logo*.png/svg`, `duckduckwash-icon-{32..512}.png`, `.svg`). Logo in the app header; 256px icon for the window/installer.

## 2. Business Flow (drives everything)

1. Customer walks in and drops off a load.
2. Owner creates the order at drop-off with only: customer name (+optional location/contact) and which **service types** the customer wants. Customer leaves. Order starts in **`waiting_input`**.
3. Later, owner opens the order and fills in the details: weight in kg per service, custom prices for per-item services, and a **garment checklist** — garment type (shirt, dress, skirt, blouse, …) with a count per type, plus a per-garment `special_care` flag (a deliberate boolean instead of fabric types). No iron flag on garments — ironing is already expressed by the service categories. The garment counts are a required part of detail input — at least one garment row must be entered before details can be saved. Saving details moves the order to **`in_progress`**.
4. When the laundry is done, owner marks it **`complete`** (waiting for pickup).
5. Customer returns, pays (cash only), takes the laundry → owner marks it **`closed`**. Closed implies paid; there is no separate paid flag.

The garment checklist is informational (anti-forget / anti-dispute). Price comes from services, never from garments.

## 3. Stack

- **Electron** (packaged with electron-builder, NSIS Windows installer)
- **React + TypeScript** (renderer)
- **Tailwind CSS + daisyUI** (UI components)
- **SQLite** via better-sqlite3 in the main process, WAL mode
- **Vitest** for tests

### Architecture

- Renderer never touches the DB. All data access goes through typed IPC channels (`orders:*`, `customers:*`, `expenses:*`, `reports:*`, `services:*`, `settings:*`, `backup:*`).
- Main process owns: SQLite access, business logic (price calculation, report aggregation), backup scheduler.
- This separation keeps a future move to cloud/LAN a data-layer-only change.

### Backup

- On every app launch, copy `laundry.db` to `backups/` with a timestamped filename; keep the newest 30.
- Settings screen: "Back up now" and "Open backup folder" buttons.

## 4. Data Model (SQLite)

```sql
customers (                     -- REGULARS ONLY, added deliberately by the user
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,          -- NOT unique: 3 Peters can coexist
  location TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
)

orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,  -- NULL for walk-ins
  customer_name TEXT NOT NULL, -- always inline; walk-ins never create customer rows
  customer_location TEXT,
  customer_phone TEXT,         -- optional contact captured at drop-off
  created_at TEXT NOT NULL,    -- full datetime; name+location+datetime identifies an order
  status TEXT NOT NULL DEFAULT 'waiting_input',
                               -- waiting_input | in_progress | complete | closed
  is_delivery INTEGER NOT NULL DEFAULT 0,   -- adds flat 20 THB
  total REAL NOT NULL DEFAULT 0,            -- 0 until details are entered; recomputed on detail save
  notes TEXT
)

services (                      -- editable price list, seeded with defaults
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,    -- wash_dry_fold | wash_dry_fold_iron | iron | dry_clean
  unit TEXT NOT NULL,          -- kg | item
  pricing TEXT NOT NULL,       -- fixed (price = default_price × qty) | custom (price entered per order)
  default_price REAL,          -- NULL for custom-priced services
  active INTEGER NOT NULL DEFAULT 1
)

order_items (                   -- one row per service chosen at drop-off
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id),
  quantity REAL,               -- NULL until detail input (kg or item count)
  unit_price REAL,             -- copied from service on detail save; entered manually for custom pricing
  total REAL                   -- quantity × unit_price, NULL until input
)

order_garments (                -- informational checklist filled at detail input
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  garment TEXT NOT NULL,       -- shirt | pants | dress | skirt | blouse | ... (preset + free text)
  quantity INTEGER NOT NULL DEFAULT 1,
  special_care INTEGER NOT NULL DEFAULT 0
)

expenses (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT NOT NULL,      -- supplies | utilities | rent | other
  description TEXT,
  amount REAL NOT NULL
)

settings (key TEXT PRIMARY KEY, value TEXT)   -- delivery_fee = '20', …
```

### Seeded price list (THB)

| key | unit | pricing | default |
|---|---|---|---|
| wash_dry_fold | kg | fixed | 150 |
| wash_dry_fold_iron | kg | fixed | 200 |
| iron | item | custom | — |
| dry_clean | item | custom | — |

Delivery: always flat 20 THB (a flag on the order; `delivery_fee` in settings).

`orders.total` = Σ(order_items.total) + delivery fee, recomputed whenever details are saved. Items without input yet contribute 0. Reports aggregate live from queries; revenue is attributed to `orders.created_at`.

## 5. Screens

1. **Home** — logo header + today's summary cards: income today, orders waiting for input, orders in progress, ready for pickup (complete). One big **+ New Order** button.
2. **New Order (drop-off, phase 1)** — deliberately tiny form:
   - Customer: type name → autocomplete suggests **saved regulars only** (showing name + location + phone + last-order date to disambiguate duplicates). Free-typed walk-in names stay inline on the order; optional location and phone fields.
   - Big toggle buttons for the 4 service categories (multi-select) + delivery toggle (+20).
   - Save → order created in `waiting_input`, back to Home. No quantities, no prices at this stage.
3. **Orders** — status tabs **Waiting input / In progress / Complete / Closed**. Every row: customer name + location + created datetime + total (or "—" before input). Row actions by status:
   - waiting_input → big **Add details** button (opens Order Details)
   - in_progress → **Mark complete**
   - complete → **Close (paid & picked up)** behind a confirm
   - closed → read-only
   - Delete (✕) always behind a confirm dialog.
4. **Order Details (phase 2 edit)** — for each chosen service: kg input for per-kg services; quantity + custom price input for iron and dry clean. Garment checklist: preset garment buttons (shirt, pants, shorts, dress, skirt, blouse, jacket, bras, underwear, other) each with quantity stepper and one checkbox — **special care**. Live total at the bottom. Save recomputes total and moves `waiting_input → in_progress` (editing later keeps the current status).
5. **Customers** — saved regulars CRUD; the only place customers are created. Deleting a regular keeps past orders (inline name).
6. **Expenses** — list + big **+ Expense**: date (default today), 4 big category buttons, amount, optional note.
7. **Reports** — month picker → cards: revenue / expenses / profit + daily revenue bar chart. (Hidden from the future assistant role.)
8. **Settings** — price list editor (fixed-price services only), backup now, open backup folder.

## 6. Roles

- **Phase 1 (now):** no login; owner only.
- **Future:** two fixed PIN-protected modes — admin (owner) and one shared assistant account (Reports hidden). UI gate in `settings`, no schema migration needed.

## 7. Error Handling

- All multi-row writes in transactions; WAL mode — power cut cannot corrupt data.
- Validation: quantities and prices ≥ 0 (custom prices > 0 to save details), at least one service per order, at least one garment row (with count ≥ 1) to save details, non-empty customer name; Save disabled until valid.
- Status can only move forward along waiting_input → in_progress → complete → closed (no skips via UI).
- Deleting an order or customer always confirms first. Deleting a regular keeps their past orders intact.

## 8. Testing

- **Vitest**: pricing (fixed + custom + delivery), status transitions, report aggregation, DB schema/seed — against in-memory SQLite.
- No e2e suite initially — manual testing with the owner is the acceptance test.

## 9. Out of Scope

- Excel data import
- Customer-facing anything
- Payment methods (cash only; closed = paid)
- Thai language / i18n (English only — scrapped 2026-06-12)
- Personal expense tracking
- Receipts/printing, multi-store, networking
