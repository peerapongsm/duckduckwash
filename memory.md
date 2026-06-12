# DuckDuckWash — Memory Log
**Date:** 2026-06-12 | **Last updated:** 2026-06-12 | **Status: v1.0.1 installer built, awaiting delivery to aunt** (aunt has v1.0.0)

---

## 1. Project Overview
- **App name: DuckDuckWash.** Pet project for the user's aunt, who owns a local laundry care business.
- Goal: replace her Excel-based workflow (orders, billing, customers) which is inefficient. Excel files in repo root are feature reference only — too messy to import.
- Primary user is the aunt (non-technical, elderly) — UX must be easy for low-tech and elderly users: big buttons, minimal fields, no jargon.
- **English-only UI.** (Earlier Thai/English toggle idea was scrapped 2026-06-12 — develop in English only.)
- Branding: single source file `icon/duckduckwash.png` (now alt duck art, 1024x1024 square — swapped from old 488x512 art, commit `e8dc379`; original alt kept at `icon/alt-duckduckwash.png`). Derived copies: `src/renderer/src/assets/logo.png` (in-app), `resources/icon.png` (window), `build/icon.png` (installer; square already, no padding needed).

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

- **Delivery is free (changed post-v1.0.0, commit `4704cf8`)** — `is_delivery` is an informational tag only; no fee in totals, `delivery_fee` setting no longer seeded/used. Old closed orders keep their +20 totals (historical).

At order creation aunt only picks categories; later she fills in kg (per-kg services) or the custom price (iron, dry clean).
- **Service category is single-select (2026-06-12, post-v1.0.1):** one category per order; clicking another replaces selection, clicking selected deselects. IPC still takes `service_ids` array (now length 1) — no backend change.

- **Walk-ins are never added to the customers table.** Orders store `customer_name`/`customer_location` inline; nullable `customer_id` only when a saved regular is picked. Regulars created deliberately on Customers screen only (most walk-ins are foreign travelers).
- **Customer names are not unique** (3 Peters OK). Disambiguate in UI via location/phone/last-order date.
- **Orders store full datetime (`created_at`)** — name + location + datetime is the practical order identifier.
- Roles: now owner-only, no login. Future: admin + 1 shared assistant account (Reports hidden), PIN gate, no full user management.

## 3. Current State
- **App fully implemented and shipped to installer** (2026-06-12), branch `feat/duckduckwash-app`, all 14 plan tasks executed subagent-driven. Per-task details live in git history of that branch.
- Verification: 10/10 vitest green, `tsc --noEmit` clean (node+web), `npm run build` clean, installer built at `release/DuckDuckWash Setup 1.0.0.exe` (~97MB NSIS, oneClick, `deleteAppDataOnUninstall: false` so DB survives uninstall).
- Final integration review fixes (commit `0c002e8`): advanceStatus takes `from` status (double-click guard), alert() on mutation errors, `saving` double-submit guards, `updatePrice` rejects <=0, WAL-safe backups via `db.backup()` (openDb before startup backup), saveDetails rejects closed orders / empty garments.
- **ABI seesaw:** `npm test` needs node ABI (`npm run rebuild:node`); `npm run dev` needs Electron ABI (`npm run rebuild:electron`); `build:win` auto-rebuilds for Electron.
- `build:win` now exits 0 cleanly (`publish: null` in electron-builder.yml fixed the old provider crash; `win.icon: build/icon.png` set explicitly).
- Merged to `main` (fast-forward) 2026-06-12; feature branch deleted; tests re-verified green on main.
- Post-merge UX round (commit `ef06e97`): THB unit labels in Settings; phone fields validate `^\d{10}$` when non-empty (intake + customers); garment "Other" replaced by free-text input — names persist in `order_garments` and resurface as preset buttons via new `garments:types` IPC (distinct query, no new table).
- UI redesign (commit `de20fdb`, frontend-design skill): custom daisyUI theme `duckwash` — duck-yellow primary #FFC93C, wash-blue secondary #4FA8D8, cream base #FFFBF2; Fredoka (display) + Nunito (body) bundled offline via @fontsource; left sidebar nav with emoji icons replaced bottom nav; status-colored left-edge order cards (warning/secondary/success/neutral); `rise` stagger animation + `lift` hover classes in main.css.
- Reports are date-range based (commit `92bbc15`): `rangeReport(db, from, to)` replaced monthlyReport; presets Today / This month / This year + free from/to pickers; buckets daily for spans ≤62 days, monthly beyond (annual readable); IPC `reports:range`.
- Delivery is editable on Order Details (commit `5b09c5b`): toggle persists via `saveDetails.is_delivery`, total recomputed with/without the 20 fee; complete-status rows also show Edit (customer picks up instead of delivery).
- **SHIPPED 2026-06-12:** installer `release/DuckDuckWash Setup 1.0.0.exe` (96.4MB, 15:35, SHA256 02E499CF…) sent to aunt — duckwash theme, range reports, editable delivery, desktop + start menu shortcuts.
- **Icon swapped to alt duck art post-ship** (commit `e8dc379`): installer rebuilt 16:16 (~105MB) with new icon.
- **Feedback round 1 (commit `4704cf8`):** phone → contact everywhere (free text, maxLength 256, 10-digit validation dropped; DB columns renamed `customers.contact` / `orders.customer_contact` with auto ALTER TABLE migration for v1.0.0 DBs — migration covered by test); expense categories now supplies/utilities/rent/food/salary/other; expense modal does batch entry (rows + shared date, `expenses:createMany` transaction, replaced `expenses:create`); delivery free (see price model). 12/12 tests + typecheck green.
- **v1.0.1 installer ready to send** (16:42, 100.6MB, SHA256 C71DDA62…) at `release/DuckDuckWash Setup 1.0.1.exe` — new duck icon + all round-1 changes; version bumped commit `11c80f2`. Stale `Setup 1.0.0.exe` builds still in `release/` (gitignored). Dev server stopped.
- **Uncommitted (post-v1.0.1):** NewOrder service buttons single-select; OrderDetails garment preset/custom add increments existing row on case-insensitive name match instead of spawning duplicate. Typecheck green; not in v1.0.1 installer — needs rebuild before next ship.

## 4. Notes
- User invokes /memory-first each session; works in caveman+pordee terse mode.
- **Next step: deliver v1.0.1 to aunt.** Distribution: MediaFire blocked by SmartScreen + Chrome Safe Browsing (unsigned exe, zero reputation, bad-rep file host). Advice given: share via Google Drive/OneDrive or USB; first run needs SmartScreen "More info → Run anyway". Code signing cert deemed overkill for one user.
- Known deferred items: assistant role w/ PIN (Reports hidden), auto-start on Windows boot (`app.setLoginItemSettings`) — user asked about "startup" once, clarified as Start Menu shortcut, boot-launch explicitly not done yet.
- If logo changes again: replace `icon/duckduckwash.png`, then re-copy to `src/renderer/src/assets/logo.png` + `resources/icon.png` and regenerate square `build/icon.png`, then `npm run build:win`.
