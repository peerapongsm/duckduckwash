# DuckDuckWash — Memory Log
**Date:** 2026-06-12 | **Last updated:** 2026-06-12 (Tasks 8+9 done)

---

## 1. Project Overview
- **App name: DuckDuckWash.** Pet project for the user's aunt, who owns a local laundry care business.
- Goal: replace her Excel-based workflow (orders, billing, customers) which is inefficient. Excel files in repo root are feature reference only — too messy to import.
- Primary user is the aunt (non-technical, elderly) — UX must be easy for low-tech and elderly users: big buttons, minimal fields, no jargon.
- **English-only UI.** (Earlier Thai/English toggle idea was scrapped 2026-06-12 — develop in English only.)
- Branding assets in `./icon/`: `duckduckwash-logo.png(@2x)/.svg`, `duckduckwash-icon-{32,64,128,256,512}.png/.svg`. Resize freely to fit.

## 2. Key Decisions
- **Deployment: fully local, single Windows PC.** No customer-facing site, no cloud. Ship NSIS installer directly to aunt.
- **Stack: Electron + React + TypeScript + SQLite** (better-sqlite3, WAL) + **Tailwind CSS + daisyUI**. Renderer talks to main only via typed IPC.
- **No data import — start fresh.**
- **Business-only tracking** — exclude aunt's personal expenses.
- **Cash-only store.** No payment-method field.
- Git is local-only version control; `.gitignore` blocks `*.xlsx` (aunt's real financial data), `*.db`, `backups/`, `.~lock.*#`.

### Business flow (defined by user 2026-06-12)
1. Customer walks in, drops off load.
2. Aunt creates order at drop-off with just: customer name/contact + which service types they want. Customer leaves.
3. Later she edits the order: kg, garment checklist (shirt, dress, skirt, blouse, …) with count per type, per-garment flag `special_care` only (deliberate simplification: a boolean instead of fabric types). **No iron flag on garments** — ironing is already expressed by the service categories [wash/dry/fold/iron] and [iron].
4. **Order status flow: `waiting_input` → `in_progress` → `complete` → `closed`.** New order starts at waiting_input; after detail input → in_progress; finished washing → complete; customer picked up AND paid → closed.
- Garment checklist is informational (anti-forget/anti-dispute); price comes from services, not garments. **But it is required at detail input** — aunt must specify how many shirts/dresses/blouses etc. the order contains (≥1 garment row) before details can be saved.

### Price model (final 2026-06-12 — exactly 4 service categories, bedding dropped)
| service | unit | price |
|---|---|---|
| wash/dry/fold | kg | 150 |
| wash/dry/fold/iron | kg | 200 |
| iron | item | custom |
| dry clean | item | custom |
| delivery | flat | always 20 |

At order creation aunt only picks categories; later she fills in kg (per-kg services) or the custom price (iron, dry clean).

- **Walk-ins are never added to the customers table.** Orders store `customer_name`/`customer_location` inline; nullable `customer_id` only when a saved regular is picked. Regulars created deliberately on Customers screen only (most walk-ins are foreign travelers).
- **Customer names are not unique** (3 Peters OK). Disambiguate in UI via location/phone/last-order date.
- **Orders store full datetime (`created_at`)** — name + location + datetime is the practical order identifier.
- Roles: now owner-only, no login. Future: admin + 1 shared assistant account (Reports hidden), PIN gate, no full user management.

## 3. Current State
- **Task 9: Home screen — DONE** (commit `eecba42` on `feat/duckduckwash-app`):
  - Created `src/renderer/src/screens/Home.tsx`: 4-stat grid (income/waiting/in-progress/ready) from `window.api.home.today()` + large "New Order" button; casts result to TodayStats
- **Task 8: App shell + branding — DONE** (commit `910e420` on `feat/duckduckwash-app`):
  - Logo copied to `src/renderer/src/assets/logo.png`
  - Replaced `App.tsx` and `main.tsx` with typed shell: `Screen` union type, `TABS` bottom nav, screen router
  - Created placeholder screens (all 7) in `src/renderer/src/screens/` with `import type { JSX } from 'react'` (needed for react-jsx transform)
  - Deleted template leftovers: `Versions.tsx`, `electron.svg`, `wavy-lines.svg`
  - Fixed `tsconfig.web.json`: added `src/shared/**/*` to includes (fixes TS6307 for shared types)
  - `tsc --noEmit -p tsconfig.web.json` clean; 10/10 tests pass; dev boots cleanly
- **Review fixes — DONE** (commit `635585e` on `feat/duckduckwash-app`):
  - `src/main/ipc.ts` `home:today`: replaced UTC `toISOString().slice(0,10)` with local-date construction (fixes Thailand UTC+7 midnight bug)
  - `src/main/index.ts`: wrapped startup `backupDb` call in try/catch to prevent crash on disk-full/permission errors
  - `src/main/index.ts`: added `app.on('before-quit', () => db.close())` after `openDb`
  - 10/10 tests pass; `tsc --noEmit -p tsconfig.node.json` clean
- **Task 7: IPC layer + typed preload bridge — DONE** (commit `d04fc60` on `feat/duckduckwash-app`):
  - Created `src/main/ipc.ts`: `registerIpc(db, dbPath, backupDir)` — all IPC handlers (customers CRUD, orders 2-phase, expenses, services, settings, reports, home stats, backup)
  - Updated `src/main/index.ts`: imports db/ipc/backup, wires userData paths, calls `backupDb` on launch then `openDb` + `registerIpc`; removed template `ipcMain.on('ping')` handler
  - Replaced `src/preload/index.ts`: typed `api` object via `contextBridge.exposeInMainWorld`; exports `Api` type
  - Updated `src/preload/index.d.ts`: declares `Window.api: Api` + retains `Window.electron: ElectronAPI` for template renderer files
  - Updated `src/renderer/src/env.d.ts`: imports `Api`, extends `Window.api`
  - Added `rebuild:electron` and `rebuild:node` scripts to `package.json`
  - Fixed `tsconfig.node.json` include: added `src/shared/**/*` (was missing, caused TS6307 error)
  - Dev boot verified: main + preload build cleanly, Electron window opens, no main-process exceptions
- **Task 6: Backup module — DONE** (commit `ebf2f36` on `feat/duckduckwash-app`):
  - Created `src/main/backup.ts`: `backupDb(dbPath, backupDir, keep=30)` — timestamped copy, prunes oldest beyond keep limit
- **Task 5: Reports logic — DONE** (commit `f267435` on `feat/duckduckwash-app`):
  - Created `src/main/logic/reports.ts`: `monthlyReport(db, year, month)` — queries orders + expenses by LIKE prefix, returns `MonthlyReport` (revenue, expenses, profit, daily[])
  - Created `tests/reports.test.ts`: 1 test — in-memory db, 3 June orders + 1 excluded May order + 1 June expense; verifies all aggregates + daily breakdown
- **Task 4: Pricing + status logic — DONE** (commit `2e50220` on `feat/duckduckwash-app`):
  - Created `src/main/logic/pricing.ts`: `computeOrderTotal(items, isDelivery, deliveryFee)` — validates non-empty items, positive qty/price, sums + adds delivery fee
  - Created `src/main/logic/status.ts`: `nextStatus(s)` — forward-only status flow via FLOW record; closed returns null
  - Created `tests/pricing.test.ts` (4 tests) and `tests/status.test.ts` (2 tests)
  - Full suite: 10/10 tests pass (db 3 + pricing 4 + status 2 + reports 1)
- **Task 3: DB layer — DONE** (commit `99e179c` on `feat/duckduckwash-app`):
  - Created `src/main/db.ts`: `openDb(path)` — creates all 7 tables (customers, services, orders, order_items, order_garments, expenses, settings), WAL + FK pragmas, seeds 4 services + delivery_fee=20
  - Created `tests/db.test.ts`: 3 tests covering service seed, delivery_fee seed, and order defaults
  - ABI mismatch hit (Electron rebuilt for NODE_MODULE_VERSION 140, system Node needs 137) — ran `npm rebuild better-sqlite3`; all 3 tests pass. Packaging relies on electron-builder re-rebuilding for Electron ABI (already configured in electron-builder.yml).


- Spec and plan rewritten for the DuckDuckWash revision (name, two-phase flow, 4 statuses, new price model, English-only, garments) and committed:
  - Spec: `docs/superpowers/specs/2026-06-12-laundry-care-design.md`
  - Plan: `docs/superpowers/plans/2026-06-12-laundry-care-app.md` — 14 TDD tasks, scaffold → NSIS installer
- Scaffold review fixes applied (commit `04a5af3` on `feat/duckduckwash-app`):
  - `electron-builder.yml`: removed `npmRebuild: false` — native rebuild re-enabled for better-sqlite3 ABI correctness
  - `vitest.config.ts`: added `passWithNoTests: true` — `npm test` now exits 0 with no test files
  - `src/renderer/src/assets/base.css`: deleted (template file, nothing imported it)
- `npm test` → exit 0 ("No test files found"); `npm run dev` → boots cleanly (main + preload + renderer, localhost:5173)
- Config fixes applied (commit `3e14ca8` on `feat/duckduckwash-app`):
  - `vitest.config.ts`: added `environment: 'node'` — explicit for upcoming better-sqlite3 DB tests
  - `electron-builder.yml`: `appId` changed to `com.duckduckwash.app`; `!src/*` → `!src/**` (recursive exclude); `asarUnpack` extended with `**/node_modules/better-sqlite3/**`
  - `src/main/index.ts`: `setAppUserModelId` aligned to `com.duckduckwash.app`
- **Task 2: Shared types — DONE** (commit `3fd23c8` on `feat/duckduckwash-app`):
  - Created `src/shared/types.ts` with 16 exports: OrderStatus, ServiceKey, Customer, Service, Order, OrderItem, OrderGarment, OrderIntake, ItemDetailInput, GarmentInput, OrderDetailsInput, MonthlyReport, Expense, TodayStats
  - TypeScript verification: `tsc --noEmit -p tsconfig.node.json` ✓ and `tsc --noEmit -p tsconfig.web.json` ✓ both pass
  - Both tsconfigs already include `src/**` via `include` glob; no tsconfig restructuring needed

## 4. Notes
- User invokes /memory-first each session; works in caveman+pordee terse mode.
