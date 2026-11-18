# AI-PFMS — Architecture & Engineering Decision Register

## ADR-001: Authoritative Monetary Precision (`DECIMAL(19,4)`)
- **Context:** Multi-currency support including RWF (0 decimals) and USD/EUR (2 decimals) plus exchange-rate fractional intermediate precision.
- **Decision:** Store all authoritative monetary amounts in MySQL as `DECIMAL(19,4)` and exchange rates as `DECIMAL(19,8)`. Perform PHP calculations using `bcmath` string arithmetic or exact integer minor units; never use IEEE-754 `FLOAT`/`DOUBLE` in SQL or authoritative ledger checks.

## ADR-002: Double-Entry Ledger as Single Source of Financial Truth
- **Context:** Account balances, income/expense totals, transfers, debt payoffs, and reports must reconcile without drift.
- **Decision:** Every posted business transaction (`Opening Balance`, `Income`, `Expense`, `Transfer`, `Fee`, `Debt Drawdown/Payment`, `Savings Contribution`, `Reversal`) writes an atomic `journal_entries` + `journal_entry_lines` pair inside a MySQL `InnoDB` transaction. Transfers move value between Asset accounts (or Asset/Liability) and are strictly excluded from Income/Expense aggregates. Corrections create reversal entries rather than overwriting posted history.

## ADR-003: Isolated C++17 Analytical Engine over Stdin/Stdout JSON
- **Context:** Analytics must be written in C++17+ without Python and without direct MySQL database access.
- **Decision:** PHP prepares a sanitized, user-scoped JSON snapshot, executes the compiled C++17 binary via `proc_open` (bypassing `/bin/sh`) with strict timeout and byte caps, validates output JSON against the documented schema, and stores results in `analytics_results`. C++ never receives DB credentials and cannot mutate financial records.

## ADR-004: Privacy-First PWA Caching Policy
- **Context:** AI-PFMS must be installable on Windows, macOS, Android, and iOS while protecting sensitive financial data on shared or lost devices.
- **Decision:** Only static application shell assets (`manifest.webmanifest`, icons, CSS, JS, `offline.html`) are cached by `service-worker.js`. All `/api/*` requests, authentication routes, document downloads, and authenticated financial pages use a strict Network-Only strategy with `Cache-Control: no-store`.

## ADR-005: Pending Decision — AI Studio Live Preview Execution Target
- **Context:** Workspace inspection on Phase 0 found `node v22.23.2`, `vite`, `react`, `express`, `g++ 12.2.0`, and `git 2.34.1`, while `php 8.3+`, `mysql`/`mariadb`, `composer`, and `cmake` are not installed in the sandbox container. Rules 2 & 3 prohibit replacing PHP/MySQL without explicit user approval.
- **Status:** **PENDING USER APPROVAL** before Phase 1 begins.
