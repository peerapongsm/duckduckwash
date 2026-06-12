# Laundry Care — Memory Log
**Date:** 2026-06-12 | **Last updated:** 2026-06-12

---

## 1. Project Overview
- Pet project for the user's aunt, who owns a local laundry care business.
- Goal: replace her current Excel-based workflow, which covers everything — order tracking, billing, customer records — but is inefficient.
- Primary user is the aunt (non-technical small-business owner) — keep UI simple.
- **UI: Thai/English language toggle, default English.** (Employees are Burmese — they read English, not Thai. Owner uses Thai.)
- Language toggle = text button labeled "Thai" / "English". No flag icons — flags cause confusion.

## 2. Key Decisions
- Scope: cover all current Excel use cases (orders, billing, customers). Two Excel files in repo root are the source of truth for the data model: `LAUNDRY REVENUE 2026.xlsx` (orders, daily income, fixed expenses, staff pay) and `Jeab Expenses 2026.xlsx` (daily expenses by category).
- **Deployment: fully local, single Windows PC.** No customer-facing site, no cloud. Aunt wants management app only.
- **Stack: Electron + React + TypeScript + SQLite** (user chose Electron over Tauri to stay all-JS). SQLite = single file DB, easy backup.
- **UI library: Tailwind CSS + daisyUI** (user requirement when using Electron).
- **No data import — start fresh.** (Reversed earlier decision: aunt's Excel is too messy/inconsistent to parse reliably. Excel files stay only as feature reference.)
- **UX priority: must be easy for low-tech and elderly users.** Big buttons, minimal fields, no jargon, hard to make mistakes.
- **Cash-only store.** No payment method field — orders just have a paid/unpaid flag.
- **Walk-ins are never added to the customers table.** Orders store `customer_name`/`customer_location` inline; `customer_id` is nullable and set only when a saved regular is picked. Regulars are added deliberately on the Customers screen only (most walk-ins are foreign travelers who won't return).
- **Customer names are not unique.** Walk-ins may give only a name (first/last/nickname/alias) — duplicates expected (3 Peters, 2 Michelles). No unique constraint; UI must disambiguate via location/phone/last-order date and allow "create new customer with same name".
- **Orders store full datetime (`created_at`), not just date.** Name + location + datetime is the practical identifier for an order — display all three together everywhere orders are listed.
- **Service price list** (THB):
  - Laundry (wash+dry+fold): 150/kg
  - Bedding: 150/kg, or 200/kg with ironing
  - Ironing: 40/item
  - Dry cleaning: from 100 — user toggles dry-clean on order and inputs price manually
  - Delivery: flat 20
- **Business-only tracking** — exclude aunt's personal expenses (FOOD/MEDICAL/Personal columns in Excel).
- Users/roles: initially owner only. If scaled to production: 2 fixed accounts — 1 admin (owner) + 1 shared assistant account for all employees, with restricted access (no reports, etc.). Keep it simple, no full user-management system.
- Tech stack and platform (web/mobile/desktop) not decided yet.
- MongoDB MCP server is available in this environment — candidate for the database if needed.

## 3. Current State
- Design spec written and committed: `docs/superpowers/specs/2026-06-12-laundry-care-design.md` — covers stack, schema, screens, roles, error handling, testing.
- Git repo initialized (branch `main`). `.gitignore` excludes `*.xlsx` (aunt's real financial data must never be committed), `*.db`, `backups/`.
- Awaiting user review of the spec, then next step is the writing-plans skill → implementation plan.
- No code yet.

## 4. Notes
- Role model when scaling: admin sees everything; assistant blocked from reports and similar sensitive views. Exact restriction list TBD.
