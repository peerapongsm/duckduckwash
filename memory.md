# DuckDuckWash — Memory Log
**Date:** 2026-06-12 | **Last updated:** 2026-06-12

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
3. Later she edits the order: kg, garment checklist (shirt, dress, skirt, blouse, …), per-garment flags `needs_ironing` and `special_care` (deliberate simplification: a special-care boolean instead of fabric types).
4. **Order status flow: `waiting_input` → `in_progress` → `complete` → `closed`.** New order starts at waiting_input; after detail input → in_progress; finished washing → complete; customer picked up AND paid → closed.
- Garment checklist is informational (anti-forget/anti-dispute); price comes from services, not garments.

### Price model (revised 2026-06-12)
| service | unit | price |
|---|---|---|
| wash/dry/fold | kg | 150 |
| wash/dry/fold/iron | kg | 200 |
| iron only | item | custom per item |
| dry clean | item | custom per item |
| bedding | kg | 150 |
| bedding + iron | kg | 200 |
| delivery | flat | always 20 |

- **Walk-ins are never added to the customers table.** Orders store `customer_name`/`customer_location` inline; nullable `customer_id` only when a saved regular is picked. Regulars created deliberately on Customers screen only (most walk-ins are foreign travelers).
- **Customer names are not unique** (3 Peters OK). Disambiguate in UI via location/phone/last-order date.
- **Orders store full datetime (`created_at`)** — name + location + datetime is the practical order identifier.
- Roles: now owner-only, no login. Future: admin + 1 shared assistant account (Reports hidden), PIN gate, no full user management.

## 3. Current State
- Spec and plan rewritten for the DuckDuckWash revision (name, two-phase flow, 4 statuses, new price model, English-only, garments) and committed:
  - Spec: `docs/superpowers/specs/2026-06-12-laundry-care-design.md`
  - Plan: `docs/superpowers/plans/2026-06-12-laundry-care-app.md` — 14 TDD tasks, scaffold → NSIS installer
- No code yet. Awaiting user review of revised spec/plan, then execute plan (subagent-driven or inline).

## 4. Notes
- User invokes /memory-first each session; works in caveman+pordee terse mode.
