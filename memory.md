# DuckDuckWash — Memory Log
**Date:** 2026-06-12 | **Last updated:** 2026-06-12 (final-review fixes — commit 0c002e8)

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
- **App fully implemented and shipped to installer** (2026-06-12), branch `feat/duckduckwash-app`, all 14 plan tasks executed subagent-driven. Per-task details live in git history of that branch.
- Verification: 10/10 vitest green, `tsc --noEmit` clean (node+web), `npm run build` clean, installer built at `release/DuckDuckWash Setup 1.0.0.exe` (~97MB NSIS, oneClick, `deleteAppDataOnUninstall: false` so DB survives uninstall).
- Final integration review fixes (commit `0c002e8`): advanceStatus takes `from` status (double-click guard), alert() on mutation errors, `saving` double-submit guards, `updatePrice` rejects <=0, WAL-safe backups via `db.backup()` (openDb before startup backup), saveDetails rejects closed orders / empty garments.
- **ABI seesaw:** `npm test` needs node ABI (`npm run rebuild:node`); `npm run dev` needs Electron ABI (`npm run rebuild:electron`); `build:win` auto-rebuilds for Electron.
- Known non-fatal: `build:win` ends with `publish.provider null` warning (no update server — intentional); exe is produced before it.
- Branch `feat/duckduckwash-app` not yet merged to `main` — awaiting user decision.

## 4. Notes
- User invokes /memory-first each session; works in caveman+pordee terse mode.
