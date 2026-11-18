# AI-PFMS — System Architecture & Module Dependency Map

**Status:** Phase 0 — Designed (Pending Environment Target Confirmation)  
**Architecture Pattern:** Secure Modular Monolith  
**Target Stack:** HTML5, CSS3, Vanilla JS, Chart.js | PHP 8.3+ (PDO) | MySQL 8+ / MariaDB | C++17+ (CMake) | PWA

---

## 1. Layered Modular Monolith Architecture

```text
+-------------------------------------------------------------------+
| Presentation Layer (HTML5, CSS3, Vanilla JS, Chart.js, PWA Shell) |
|  - Public Website (/, /pricing, /security, /contact, /terms)      |
|  - Auth Views (/login, /register, /2fa, /reset-password)          |
|  - App Shell (Sidebar, Topbar, 40+ Financial & Admin Views)       |
|  - PWA Assets (manifest.webmanifest, service-worker.js, offline)  |
+-------------------------------------------------------------------+
                                 |
                                 v
+-------------------------------------------------------------------+
| Routing & Middleware (routes/web.php, routes/api.php)             |
|  - SecurityHeadersMiddleware (CSP, HSTS, X-Frame-Options, nosniff)|
|  - SessionMiddleware (HttpOnly, Secure, SameSite=Lax)             |
|  - CsrfMiddleware (Synchronizer token on all state-changing ops)  |
|  - RateLimitMiddleware (Auth + API throttling)                    |
|  - AuthMiddleware & RbacMiddleware                                |
|  - IdempotencyMiddleware (Prevent duplicate financial postings)   |
+-------------------------------------------------------------------+
                                 |
                                 v
+-------------------------------------------------------------------+
| Controllers & Validators (app/Controllers, app/Validators)        |
|  - Web Controllers (SSR PHP views + localized templates)          |
|  - REST API v1 Controllers (/api/v1/* JSON envelope)              |
+-------------------------------------------------------------------+
                                 |
                                 v
+-------------------------------------------------------------------+
| Domain Services & Authorization Policies                          |
|  - Auth/RBAC Services & Ownership Policies (app/Policies/*)       |
|  - Double-Entry PostingService & ReversalService (Core Ledger)    |
|  - Accounts, Transactions, Income, Expenses, Transfers (FX)       |
|  - Budgets, Savings Goals, Debts, Bills, Recurring Engine         |
|  - Family Finance Sharing & Private Document Storage              |
|  - Notifications, Reports/Exports (PDF/CSV/XLSX), SaaS Billing    |
|  - AnalyticsOrchestrator (Validated JSON -> C++17 -> JSON)        |
+-------------------------------------------------------------------+
                                 |
          +----------------------+----------------------+
          |                                             |
          v                                             v
+-----------------------------------+   +-------------------------------+
| Repositories & MySQL 8 (PDO)      |   | C++17 Analytics Engine        |
| - InnoDB, utf8mb4, DECIMAL(19,4)  |   | - Zero DB access              |
| - Atomic DB transactions          |   | - Bounded JSON stdin/stdout   |
| - Balance snapshots & audit logs  |   | - Timeout & schema validated  |
+-----------------------------------+   +-------------------------------+
```

---

## 2. Proposed Directory Structure

```text
ai-pfms/
├── app/
│   ├── Controllers/        # Web & API v1 controllers
│   ├── Exceptions/         # Domain, Validation, Auth, Accounting exceptions
│   ├── Middleware/         # Auth, CSRF, RateLimit, Idempotency, SecurityHeaders
│   ├── Models/             # Typed DTOs & domain entities
│   ├── Policies/           # Server-side ownership & RBAC policies
│   ├── Repositories/       # PDO prepared-statement repositories
│   ├── Services/           # Business logic + Double-Entry PostingService
│   ├── Support/            # Money, Currency, Translator, Logger, Response
│   └── Validators/         # Strict server-side request validation
├── analytics/
│   └── cpp/
│       ├── include/        # Header-only JSON schema & math modules
│       ├── src/            # main.cpp, stats, trend, cashflow, debt, anomaly
│       ├── tests/          # C++17 unit tests (CTest / standalone runner)
│       ├── CMakeLists.txt
│       └── README.md
├── config/                 # app.php, database.php, security.php, services.php
├── database/
│   ├── migrations/         # Versioned SQL/PHP migrations (001..N)
│   ├── seeders/            # Currencies, roles, permissions, categories, plans
│   └── factories/          # Test data factories
├── docs/                   # 20 mandatory engineering & operational docs
├── public/                 # ONLY web-accessible root
│   ├── index.php           # Front controller
│   ├── manifest.webmanifest
│   ├── service-worker.js
│   ├── offline.html
│   ├── .htaccess
│   └── assets/
│       ├── css/            # tokens.css, app.css, install.css
│       ├── js/             # app.js, pwa-install.js, charts.js, i18n.js
│       ├── images/
│       └── icons/          # icon-192.png, icon-512.png, maskable, favicon.ico
├── resources/
│   ├── lang/en/            # English localization dictionaries
│   ├── lang/rw/            # Kinyarwanda localization dictionaries
│   └── views/              # layouts/, components/, pages/
├── routes/                 # web.php, api.php
├── storage/                # OUTSIDE public web root
│   ├── private/            # Uploaded receipts/invoices/avatars
│   ├── logs/               # Application & security logs (no secrets)
│   ├── cache/              # Non-sensitive i18n/template cache
│   └── exports/            # Temporary authorized PDF/CSV/XLSX exports
├── tests/                  # Unit, Integration, Security, Financial, Acceptance
├── .env.example
├── .gitignore
├── composer.json
└── README.md
```

---

## 3. Module Dependency Map

1. **Foundation (`Config`, `Database/PDO`, `Support`, `Security`, `i18n`, `UI Shell`, `PWA Shell`)**
   - Required by all modules.
2. **Auth & RBAC (`FR-AUTH`) + Public Website (`FR-PUB`)**
   - Depends on Foundation. Provides authenticated identity, session cookies, CSRF, and policies.
3. **Double-Entry Accounting Engine (`FR-GL`) + Currencies**
   - Depends on Foundation + Auth. Core financial invariant (`Debits === Credits`).
4. **Financial Accounts (`FR-ACC`)**
   - Depends on `FR-GL` (opening balance equity posting, asset GL mapping).
5. **Transactions (`FR-TXN`), Income (`FR-INC`), Expenses (`FR-EXP`), Transfers (`FR-TRF`)**
   - Depends on `FR-ACC` + `FR-GL` + `Idempotency` + `Documents` (`FR-DOC` for attachments).
6. **Budgets (`FR-BUD`) & Savings Goals (`FR-SAV`)**
   - Depends on `FR-EXP` (budget utilization) and `FR-ACC`/`FR-TRF` (linked accounts & contributions).
7. **Debts (`FR-DEB`), Bills (`FR-BIL`), Recurring (`FR-REC`)**
   - Depends on `FR-TXN` + `FR-GL` + `FR-NOT` (reminders).
8. **Reports (`FR-RPT`) & C++ Analytics (`FR-AI`)**
   - Read-only consumers of `FR-GL`, `FR-TXN`, `FR-BUD`, `FR-SAV`, `FR-DEB`.
9. **Family Finance (`FR-FAM`), Notifications (`FR-NOT`), User Settings (`FR-SET`)**
   - Cross-cutting ownership, alerts, preferences.
10. **Administration (`FR-ADM`) & Commercial SaaS (`FR-SaaS`)**
    - Enforces plan limits across `FR-ACC`, `FR-BUD`, `FR-FAM`, `FR-DOC`, `FR-AI`; audits all modules.

---

## 4. PWA & Security Caching Boundary

- **Cacheable (Cache-First / Stale-While-Revalidate):** Static icons, `manifest.webmanifest`, `tokens.css`, `app.css`, `install.css`, `pwa-install.js`, `offline.html`, public brand logo.
- **Strictly Network-Only (NEVER Cached in Service Worker):** `/api/*`, `/login`, `/logout`, `/register`, `/dashboard`, `/accounts`, `/transactions`, `/documents/*`, `/admin/*`, and any response carrying `Set-Cookie`, `Authorization`, session identifiers, or private financial figures.
- **Offline Behavior:** When offline, navigation to authenticated or uncached routes renders `offline.html` ("You're currently offline. Reconnect to the internet to access your latest financial information securely.") with a retry button. Zero fake balances or offline transaction posting.
