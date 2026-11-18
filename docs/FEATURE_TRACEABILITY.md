# AI-PFMS — Feature Traceability Register

**Project:** AI Personal Finance Management System (AI-PFMS)  
**Version:** 2.0 + Mandatory PWA Module  
**Phase:** Phase 0 — Discovery & Requirements Analysis  
**Total Tracked Requirements:** 328 (21 Core Modules + Mandatory PWA Module)

## Status Legend
- `NOT STARTED` — Mapped only, awaiting design/build
- `ANALYSIS` — Requirements analyzed and dependencies mapped in Phase 0
- `DESIGNED` — Architecture, schema, and API contracts designed
- `IMPLEMENTING` — Active code implementation
- `IMPLEMENTED` — Code written, pending full verification
- `TESTING` — Under automated/manual verification
- `VERIFIED` — Acceptance criteria and tests passed
- `BLOCKED` — Blocked by environment or external dependency
- `DEFERRED WITH APPROVAL` — Explicitly deferred by user approval

---

## Module 01 — Public Website (`FR-PUB`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-PUB-001 | Landing page | Public `/` view | N/A | `PublicController@home` | N/A | CSP, XSS escaping | Pending | ANALYSIS |
| FR-PUB-002 | Product introduction | Hero section | N/A | `PublicController@home` | N/A | Escaped i18n strings | Pending | ANALYSIS |
| FR-PUB-003 | Features section | 6 feature cards | N/A | `PublicController@home` | N/A | Escaped i18n strings | Pending | ANALYSIS |
| FR-PUB-004 | How it works | 3-step section | N/A | `PublicController@home` | N/A | Escaped i18n strings | Pending | ANALYSIS |
| FR-PUB-005 | Security and privacy information | Security banner & `/security` | N/A | `PublicController@security` | N/A | Static safe claims | Pending | ANALYSIS |
| FR-PUB-006 | Subscription pricing | Pricing section | `subscription_plans` | `PublicController@home` | `GET /api/v1/plans` | Public read-only | Pending | ANALYSIS |
| FR-PUB-007 | Frequently asked questions | FAQ accordion | N/A | `PublicController@home` | N/A | Accessible ARIA | Pending | ANALYSIS |
| FR-PUB-008 | Contact page | `/contact` form | `support_tickets` | `PublicController@contact` | `POST /api/v1/contact` | CSRF, rate limit | Pending | ANALYSIS |
| FR-PUB-009 | Terms of service | `/terms` | N/A | `PublicController@terms` | N/A | Static safe page | Pending | ANALYSIS |
| FR-PUB-010 | Privacy policy | `/privacy` | N/A | `PublicController@privacy` | N/A | Static safe page | Pending | ANALYSIS |
| FR-PUB-011 | Responsive navigation | Navbar + mobile drawer | N/A | Layout partial | N/A | Keyboard nav | Pending | ANALYSIS |
| FR-PUB-012 | Language selector | EN / RW switcher | `users.locale` (if auth) | `LocaleController` | `POST /api/v1/locale` | Allowlisted `en`/`rw` | Pending | ANALYSIS |
| FR-PUB-013 | Login navigation | Header `Log In` link | N/A | `AuthController@showLogin` | N/A | Guest middleware | Pending | ANALYSIS |
| FR-PUB-014 | Registration calls to action | Header & Hero CTAs | N/A | `AuthController@showRegister` | N/A | Guest middleware | Pending | ANALYSIS |

## Module 02 — Authentication and Authorization (`FR-AUTH`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-AUTH-001 | User registration | `/register` | `users`, `user_roles` | `AuthService@register` | `POST /api/v1/auth/register` | Argon2id, CSRF, rate limit | Pending | ANALYSIS |
| FR-AUTH-002 | Login | `/login` | `users`, `user_sessions` | `AuthService@login` | `POST /api/v1/auth/login` | Enumeration guard, rate limit | Pending | ANALYSIS |
| FR-AUTH-003 | Logout | Topbar/menu logout | `user_sessions` | `AuthService@logout` | `POST /api/v1/auth/logout` | CSRF, session destroy | Pending | ANALYSIS |
| FR-AUTH-004 | Email verification | `/verify-email` | `email_verifications` | `VerificationService` | `POST /api/v1/auth/verify` | Signed expiring token | Pending | ANALYSIS |
| FR-AUTH-005 | Forgot password | `/forgot-password` | `password_resets` | `PasswordResetService` | `POST /api/v1/auth/forgot` | Generic response, rate limit | Pending | ANALYSIS |
| FR-AUTH-006 | Reset password | `/reset-password` | `password_resets`, `users` | `PasswordResetService` | `POST /api/v1/auth/reset` | One-time hashed token | Pending | ANALYSIS |
| FR-AUTH-007 | Secure password hashing | Registration/Settings | `users.password_hash` | `PasswordHasher` | Internal | `PASSWORD_ARGON2ID` | Pending | ANALYSIS |
| FR-AUTH-008 | Secure sessions | All auth pages | `user_sessions` | `SessionManager` | Cookie middleware | HttpOnly, Secure, SameSite=Lax | Pending | ANALYSIS |
| FR-AUTH-009 | Session identifier regeneration | Login / privilege change | `user_sessions` | `SessionManager@regenerate` | Internal | `session_regenerate_id(true)` | Pending | ANALYSIS |
| FR-AUTH-010 | Two-factor authentication | `/2fa` & Security Settings | `two_factor_auth` | `TwoFactorService` | `POST /api/v1/auth/2fa/*` | Encrypted TOTP secret | Pending | ANALYSIS |
| FR-AUTH-011 | Role management | Admin Roles screen | `roles` | `RoleService` | `/api/v1/admin/roles` | Admin RBAC policy | Pending | ANALYSIS |
| FR-AUTH-012 | Permission management | Admin Permissions | `permissions`, `role_permissions` | `PermissionService` | `/api/v1/admin/permissions` | Admin RBAC policy | Pending | ANALYSIS |
| FR-AUTH-013 | User-role assignment | Admin User Edit | `user_roles` | `UserRoleService` | `/api/v1/admin/users/{id}/roles` | Admin RBAC + audit log | Pending | ANALYSIS |
| FR-AUTH-014 | Login history | Security Settings | `login_history` | `SecurityLogService` | `GET /api/v1/security/logins` | Owner-only policy | Pending | ANALYSIS |
| FR-AUTH-015 | Login attempt tracking | Internal / Admin | `login_attempts` | `RateLimitService` | Internal | IP + account identifier | Pending | ANALYSIS |
| FR-AUTH-016 | Rate limiting | Auth/API feedback | `login_attempts` | `RateLimitMiddleware` | Middleware | 429 + Retry-After | Pending | ANALYSIS |
| FR-AUTH-017 | Active session management | Security Settings | `user_sessions` | `SessionService` | `DELETE /api/v1/sessions/{id}` | Owner-only revocation | Pending | ANALYSIS |
| FR-AUTH-018 | Trusted device management | Security Settings | `trusted_devices` | `TrustedDeviceService` | `/api/v1/security/devices` | Signed device fingerprint | Pending | ANALYSIS |
| FR-AUTH-019 | Account security settings | `/settings/security` | `users`, `two_factor_auth` | `SecuritySettingsController` | `/api/v1/settings/security` | Password re-confirm | Pending | ANALYSIS |
| FR-AUTH-020 | Password recovery security | Recovery flow | `password_resets`, `audit_logs` | `PasswordResetService` | `/api/v1/auth/reset` | Session invalidation on reset | Pending | ANALYSIS |

## Module 03 — Financial Accounts (`FR-ACC`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-ACC-001 | Create account | `/accounts/create` | `financial_accounts` | `AccountService@create` | `POST /api/v1/accounts` | Auth + plan limit + CSRF | Pending | ANALYSIS |
| FR-ACC-002 | Edit account details | `/accounts/{id}/edit` | `financial_accounts` | `AccountService@update` | `PUT /api/v1/accounts/{id}` | Ownership policy | Pending | ANALYSIS |
| FR-ACC-003 | Account types | Account form select | `account_types` | `AccountTypeRepository` | `GET /api/v1/account-types` | Read-only reference | Pending | ANALYSIS |
| FR-ACC-004 | Cash accounts | Account type option | `account_types` | `AccountService` | `POST /api/v1/accounts` | Asset GL mapping | Pending | ANALYSIS |
| FR-ACC-005 | Bank accounts | Account type option | `account_types` | `AccountService` | `POST /api/v1/accounts` | Asset GL mapping | Pending | ANALYSIS |
| FR-ACC-006 | Mobile-money accounts | Account type option | `account_types` | `AccountService` | `POST /api/v1/accounts` | Asset GL mapping | Pending | ANALYSIS |
| FR-ACC-007 | Savings accounts | Account type option | `account_types` | `AccountService` | `POST /api/v1/accounts` | Asset GL mapping | Pending | ANALYSIS |
| FR-ACC-008 | Digital wallets | Account type option | `account_types` | `AccountService` | `POST /api/v1/accounts` | Asset GL mapping | Pending | ANALYSIS |
| FR-ACC-009 | Multiple currencies | Currency selector | `currencies`, `financial_accounts` | `CurrencyService` | `GET /api/v1/currencies` | Validated ISO 4217 | Pending | ANALYSIS |
| FR-ACC-010 | Opening balances | Create account modal | `financial_accounts`, `journal_entries` | `AccountService@create` | `POST /api/v1/accounts` | Equity opening-balance GL | Pending | ANALYSIS |
| FR-ACC-011 | Account listing | `/accounts` | `financial_accounts` | `AccountController@index` | `GET /api/v1/accounts` | Scoped to `user_id` | Pending | ANALYSIS |
| FR-ACC-012 | Account detail | `/accounts/{id}` | `financial_accounts` | `AccountController@show` | `GET /api/v1/accounts/{id}` | Ownership policy | Pending | ANALYSIS |
| FR-ACC-013 | Account transaction history | `/accounts/{id}` table | `transactions` | `TransactionRepository` | `GET /api/v1/accounts/{id}/transactions` | Ownership policy | Pending | ANALYSIS |
| FR-ACC-014 | Account balance display | Account cards & KPIs | `account_balance_snapshots`, `journal_entry_lines` | `BalanceService` | `GET /api/v1/accounts/{id}` | `DECIMAL(19,4)` | Pending | ANALYSIS |
| FR-ACC-015 | Account reconciliation | `/accounts/{id}/reconcile` | `account_reconciliations`, `reconciliation_items` | `ReconciliationService` | `POST /api/v1/accounts/{id}/reconcile` | Ownership + audit | Pending | ANALYSIS |
| FR-ACC-016 | Balance snapshots | Internal / detail view | `account_balance_snapshots` | `SnapshotService` | Internal | Recomputed on GL commit | Pending | ANALYSIS |
| FR-ACC-017 | Account archiving | Account actions | `financial_accounts.status` | `AccountService@archive` | `POST /api/v1/accounts/{id}/archive` | Preserve historical GL | Pending | ANALYSIS |
| FR-ACC-018 | Account status | Status badge | `financial_accounts.status` | `AccountService` | `GET /api/v1/accounts` | Enum validation | Pending | ANALYSIS |
| FR-ACC-019 | Account ownership enforcement | All account routes | `financial_accounts.user_id` | `AccountPolicy` | All `/accounts/*` | Server-side IDOR check | Pending | ANALYSIS |

## Module 04 — Double-Entry Accounting (`FR-GL`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-GL-001 | Chart of accounts | Settings / Ledger view | `chart_of_accounts` | `ChartOfAccountsService` | `GET /api/v1/ledger/accounts` | Owner-scoped | Pending | ANALYSIS |
| FR-GL-002 | Asset accounts | GL breakdown | `chart_of_accounts` | `ChartOfAccountsService` | Internal / Ledger API | Normal debit | Pending | ANALYSIS |
| FR-GL-003 | Liability accounts | GL breakdown | `chart_of_accounts` | `ChartOfAccountsService` | Internal / Ledger API | Normal credit | Pending | ANALYSIS |
| FR-GL-004 | Equity accounts | Opening balance equity | `chart_of_accounts` | `ChartOfAccountsService` | Internal / Ledger API | Normal credit | Pending | ANALYSIS |
| FR-GL-005 | Income accounts | Income GL mapping | `chart_of_accounts` | `ChartOfAccountsService` | Internal / Ledger API | Normal credit | Pending | ANALYSIS |
| FR-GL-006 | Expense accounts | Expense GL mapping | `chart_of_accounts` | `ChartOfAccountsService` | Internal / Ledger API | Normal debit | Pending | ANALYSIS |
| FR-GL-007 | Journal entries | Transaction detail GL tab | `journal_entries` | `PostingService` | `GET /api/v1/ledger/journals` | Immutable once posted | Pending | ANALYSIS |
| FR-GL-008 | Journal entry lines | Transaction detail GL lines | `journal_entry_lines` | `PostingService` | `GET /api/v1/ledger/journals/{id}` | `DECIMAL(19,4)` | Pending | ANALYSIS |
| FR-GL-009 | Debit and credit validation | Validation error toast | `journal_entry_lines` | `JournalValidator` | Internal | Reject negative/both >0 | Pending | ANALYSIS |
| FR-GL-010 | Balanced journal enforcement | Atomic commit check | `journal_entries` | `PostingService@post` | Internal | `sum(debit) === sum(credit)` | Pending | ANALYSIS |
| FR-GL-011 | Accounting periods | Period management | `accounting_periods` | `AccountingPeriodService` | `/api/v1/ledger/periods` | Reject closed-period posts | Pending | ANALYSIS |
| FR-GL-012 | Transactional posting | All financial actions | `journal_entries`, `transactions` | `PostingService` | All write endpoints | PDO `beginTransaction` / `rollBack` | Pending | ANALYSIS |
| FR-GL-013 | Reversal entries | Reverse transaction modal | `journal_entries`, `transaction_reversals` | `ReversalService` | `POST /api/v1/transactions/{id}/reverse` | Idempotent + owner policy | Pending | ANALYSIS |
| FR-GL-014 | Posting references | Journal reference column | `journal_entries.reference_no` | `ReferenceGenerator` | API payloads | Unique per user/entry | Pending | ANALYSIS |
| FR-GL-015 | Accounting audit trail | Audit view | `audit_logs`, `journal_entries` | `AuditService` | `GET /api/v1/audit` | Append-only | Pending | ANALYSIS |
| FR-GL-016 | Reconciliation support | Reconcile screen | `reconciliation_items` | `ReconciliationService` | `/api/v1/accounts/{id}/reconcile` | Owner policy | Pending | ANALYSIS |
| FR-GL-017 | Financial period validation | Posting error feedback | `accounting_periods` | `PeriodValidator` | Internal | Open-period check | Pending | ANALYSIS |

## Module 05 — Transactions (`FR-TXN`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-TXN-001 | Create transaction | `/transactions/create` | `transactions` | `TransactionService@create` | `POST /api/v1/transactions` | CSRF, idempotency, policy | Pending | ANALYSIS |
| FR-TXN-002 | Transaction details | `/transactions/{id}` | `transactions`, `journal_entries` | `TransactionController@show` | `GET /api/v1/transactions/{id}` | Ownership policy | Pending | ANALYSIS |
| FR-TXN-003 | Transaction history | `/transactions` | `transactions` | `TransactionController@index` | `GET /api/v1/transactions` | Owner-scoped query | Pending | ANALYSIS |
| FR-TXN-004 | Transaction categories | Category dropdown | `transaction_categories` | `CategoryService` | `GET /api/v1/categories` | System + owner categories | Pending | ANALYSIS |
| FR-TXN-005 | Transaction tags | Tag input chips | `transaction_tags`, `transaction_tag_links` | `TagService` | `/api/v1/tags` | Owner-scoped | Pending | ANALYSIS |
| FR-TXN-006 | Attachments | Receipt uploader | `transaction_attachments`, `documents` | `DocumentService` | `POST /api/v1/transactions/{id}/attachments` | Private storage, MIME check | Pending | ANALYSIS |
| FR-TXN-007 | Date filters | Filter bar | `transactions.occurred_at` | `TransactionFilter` | `GET /api/v1/transactions?from=&to=` | Validated dates | Pending | ANALYSIS |
| FR-TXN-008 | Account filters | Account dropdown | `transactions.account_id` | `TransactionFilter` | `GET /api/v1/transactions?account_id=` | Ownership verified | Pending | ANALYSIS |
| FR-TXN-009 | Category filters | Category dropdown | `transactions.category_id` | `TransactionFilter` | `GET /api/v1/transactions?category_id=` | Prepared params | Pending | ANALYSIS |
| FR-TXN-010 | Type filters | Income/Expense/Transfer | `transactions.type` | `TransactionFilter` | `GET /api/v1/transactions?type=` | Enum allowlist | Pending | ANALYSIS |
| FR-TXN-011 | Status filters | Draft/Posted/Reversed | `transactions.status` | `TransactionFilter` | `GET /api/v1/transactions?status=` | Enum allowlist | Pending | ANALYSIS |
| FR-TXN-012 | Amount filters | Min/Max inputs | `transactions.amount` | `TransactionFilter` | `GET /api/v1/transactions?min=&max=` | Numeric validation | Pending | ANALYSIS |
| FR-TXN-013 | Search | Search box | `transactions.description`, `reference_no` | `TransactionRepository` | `GET /api/v1/transactions?q=` | Parameterized `LIKE` | Pending | ANALYSIS |
| FR-TXN-014 | Pagination | Table pagination | `transactions` | `Paginator` | `GET /api/v1/transactions?page=` | Bounded limit/offset | Pending | ANALYSIS |
| FR-TXN-015 | Draft and posting status | Draft/Post actions | `transactions.status` | `TransactionService@postDraft` | `POST /api/v1/transactions/{id}/post` | Ownership + GL commit | Pending | ANALYSIS |
| FR-TXN-016 | Transaction references | Reference column | `transactions.reference_no` | `ReferenceGenerator` | API payload | Unique reference | Pending | ANALYSIS |
| FR-TXN-017 | Reversal handling | Reverse button + reason | `transaction_reversals` | `ReversalService` | `POST /api/v1/transactions/{id}/reverse` | Prevent double reversal | Pending | ANALYSIS |
| FR-TXN-018 | Duplicate submission protection | Idempotency key header/field | `idempotency_records` | `IdempotencyMiddleware` | All `POST` financial APIs | Unique key + payload hash | Pending | ANALYSIS |

## Module 06 — Income (`FR-INC`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-INC-001 | Income records | `/income` | `transactions` (`type='income'`) | `IncomeService` | `GET/POST /api/v1/income` | Owner policy + GL | Pending | ANALYSIS |
| FR-INC-002 | Salary income | Category option | `transaction_categories` | Seeder + `CategoryService` | `GET /api/v1/categories?type=income` | Standard seed | Pending | ANALYSIS |
| FR-INC-003 | Business income | Category option | `transaction_categories` | Seeder + `CategoryService` | `GET /api/v1/categories?type=income` | Standard seed | Pending | ANALYSIS |
| FR-INC-004 | Freelance income | Category option | `transaction_categories` | Seeder + `CategoryService` | `GET /api/v1/categories?type=income` | Standard seed | Pending | ANALYSIS |
| FR-INC-005 | Investment income | Category option | `transaction_categories` | Seeder + `CategoryService` | `GET /api/v1/categories?type=income` | Standard seed | Pending | ANALYSIS |
| FR-INC-006 | Gifts | Category option | `transaction_categories` | Seeder + `CategoryService` | `GET /api/v1/categories?type=income` | Standard seed | Pending | ANALYSIS |
| FR-INC-007 | Other income | Category option | `transaction_categories` | Seeder + `CategoryService` | `GET /api/v1/categories?type=income` | Standard seed | Pending | ANALYSIS |
| FR-INC-008 | Income categories | Category manager | `transaction_categories` | `CategoryService` | `POST /api/v1/categories` | Owner-scoped custom | Pending | ANALYSIS |
| FR-INC-009 | Income by period | Period summary widget | `transactions` | `IncomeReportService` | `GET /api/v1/income/summary` | Owner-scoped | Pending | ANALYSIS |
| FR-INC-010 | Income by account | Account breakdown | `transactions` | `IncomeReportService` | `GET /api/v1/income/summary?group=account` | Owner-scoped | Pending | ANALYSIS |
| FR-INC-011 | Income by category | Category chart | `transactions` | `IncomeReportService` | `GET /api/v1/income/summary?group=category` | Owner-scoped | Pending | ANALYSIS |
| FR-INC-012 | Income detail | `/income/{id}` | `transactions`, `journal_entries` | `IncomeController@show` | `GET /api/v1/income/{id}` | Ownership policy | Pending | ANALYSIS |
| FR-INC-013 | Income reports | Reports tab | `transactions`, `journal_entry_lines` | `ReportService@income` | `GET /api/v1/reports/income` | Reconciles with GL | Pending | ANALYSIS |

## Module 07 — Expenses (`FR-EXP`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-EXP-001 | Expense records | `/expenses` | `transactions` (`type='expense'`) | `ExpenseService` | `GET/POST /api/v1/expenses` | Owner policy + GL | Pending | ANALYSIS |
| FR-EXP-002 | Expense categories | Category list | `transaction_categories` | `CategoryService` | `GET /api/v1/categories?type=expense` | Seeded + custom | Pending | ANALYSIS |
| FR-EXP-003 | Food | Default category | `transaction_categories` | Migration seeder | `GET /api/v1/categories` | Standard seed | Pending | ANALYSIS |
| FR-EXP-004 | Transport | Default category | `transaction_categories` | Migration seeder | `GET /api/v1/categories` | Standard seed | Pending | ANALYSIS |
| FR-EXP-005 | Housing | Default category | `transaction_categories` | Migration seeder | `GET /api/v1/categories` | Standard seed | Pending | ANALYSIS |
| FR-EXP-006 | Education | Default category | `transaction_categories` | Migration seeder | `GET /api/v1/categories` | Standard seed | Pending | ANALYSIS |
| FR-EXP-007 | Healthcare | Default category | `transaction_categories` | Migration seeder | `GET /api/v1/categories` | Standard seed | Pending | ANALYSIS |
| FR-EXP-008 | Utilities | Default category | `transaction_categories` | Migration seeder | `GET /api/v1/categories` | Standard seed | Pending | ANALYSIS |
| FR-EXP-009 | Communication | Default category | `transaction_categories` | Migration seeder | `GET /api/v1/categories` | Standard seed | Pending | ANALYSIS |
| FR-EXP-010 | Entertainment | Default category | `transaction_categories` | Migration seeder | `GET /api/v1/categories` | Standard seed | Pending | ANALYSIS |
| FR-EXP-011 | Shopping | Default category | `transaction_categories` | Migration seeder | `GET /api/v1/categories` | Standard seed | Pending | ANALYSIS |
| FR-EXP-012 | Custom categories | Add category modal | `transaction_categories` | `CategoryService@create` | `POST /api/v1/categories` | Owner-scoped | Pending | ANALYSIS |
| FR-EXP-013 | Expense attachments | Receipt upload | `documents`, `transaction_attachments` | `DocumentService` | `POST /api/v1/expenses/{id}/attachments` | Private disk storage | Pending | ANALYSIS |
| FR-EXP-014 | Spending trends | Expense chart | `transactions` | `ExpenseReportService` | `GET /api/v1/expenses/trends` | Owner-scoped | Pending | ANALYSIS |
| FR-EXP-015 | Category comparisons | Period comparison | `transactions` | `ExpenseReportService` | `GET /api/v1/expenses/compare` | Owner-scoped | Pending | ANALYSIS |
| FR-EXP-016 | Expense reports | Reports tab | `transactions`, `journal_entry_lines` | `ReportService@expenses` | `GET /api/v1/reports/expenses` | Reconciles with GL | Pending | ANALYSIS |

## Module 08 — Transfers (`FR-TRF`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-TRF-001 | Same-currency transfer | `/transfers/create` | `transfers`, `journal_entries` | `TransferService@execute` | `POST /api/v1/transfers` | Source != dest, owner policy | Pending | ANALYSIS |
| FR-TRF-002 | Cross-currency transfer | `/transfers/create` | `transfers`, `exchange_rates` | `TransferService@execute` | `POST /api/v1/transfers` | Explicit FX rate | Pending | ANALYSIS |
| FR-TRF-003 | Source account selection | Source select | `financial_accounts` | `AccountPolicy` | `POST /api/v1/transfers` | Verify ownership | Pending | ANALYSIS |
| FR-TRF-004 | Destination account selection | Destination select | `financial_accounts` | `AccountPolicy` | `POST /api/v1/transfers` | Verify ownership | Pending | ANALYSIS |
| FR-TRF-005 | Exchange-rate recording | FX rate input & preview | `transfers.exchange_rate`, `exchange_rates` | `ExchangeRateService` | `POST /api/v1/transfers` | `DECIMAL(19,8)` > 0 | Pending | ANALYSIS |
| FR-TRF-006 | Fee handling | Optional fee field | `transfers.fee_amount` | `TransferService` | `POST /api/v1/transfers` | Separate expense GL line | Pending | ANALYSIS |
| FR-TRF-007 | Confirmation screen | Review step before submit | N/A | `TransferController` | Frontend + idempotency key | CSRF + idempotency | Pending | ANALYSIS |
| FR-TRF-008 | Transfer history | `/transfers` | `transfers` | `TransferController@index` | `GET /api/v1/transfers` | Owner-scoped | Pending | ANALYSIS |
| FR-TRF-009 | Transfer details | `/transfers/{id}` | `transfers`, `journal_entries` | `TransferController@show` | `GET /api/v1/transfers/{id}` | Owner policy | Pending | ANALYSIS |
| FR-TRF-010 | Duplicate prevention | Idempotency token | `idempotency_records` | `IdempotencyMiddleware` | `POST /api/v1/transfers` | Atomic lock | Pending | ANALYSIS |
| FR-TRF-011 | Balanced accounting treatment | GL lines on transfer | `journal_entries`, `journal_entry_lines` | `PostingService` | Internal | Excluded from Income/Expense | Pending | ANALYSIS |

## Module 09 — Budgets (`FR-BUD`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-BUD-001 | Create budget | `/budgets/create` | `budgets`, `budget_allocations` | `BudgetService@create` | `POST /api/v1/budgets` | Owner + plan limit | Pending | ANALYSIS |
| FR-BUD-002 | Edit budget | `/budgets/{id}/edit` | `budgets`, `budget_allocations` | `BudgetService@update` | `PUT /api/v1/budgets/{id}` | Owner policy | Pending | ANALYSIS |
| FR-BUD-003 | Monthly budgets | Period selector | `budgets.period_type` | `BudgetService` | `POST /api/v1/budgets` | Validated enum | Pending | ANALYSIS |
| FR-BUD-004 | Weekly budgets | Period selector | `budgets.period_type` | `BudgetService` | `POST /api/v1/budgets` | Validated enum | Pending | ANALYSIS |
| FR-BUD-005 | Custom periods | Start/End dates | `budgets.start_date`, `end_date` | `BudgetService` | `POST /api/v1/budgets` | `end_date > start_date` | Pending | ANALYSIS |
| FR-BUD-006 | Category allocations | Category allocation rows | `budget_categories`, `budget_allocations` | `BudgetService` | `/api/v1/budgets` | Positive decimal | Pending | ANALYSIS |
| FR-BUD-007 | Allocated amount | Budget summary card | `budget_allocations.amount` | `BudgetCalculationService` | `GET /api/v1/budgets/{id}` | `DECIMAL(19,4)` | Pending | ANALYSIS |
| FR-BUD-008 | Used amount | Progress bar & table | `transactions` (posted expenses) | `BudgetCalculationService` | `GET /api/v1/budgets/{id}` | Excludes transfers/reversed | Pending | ANALYSIS |
| FR-BUD-009 | Remaining amount | Remaining metric | Derived | `BudgetCalculationService` | `GET /api/v1/budgets/{id}` | `allocated - used` | Pending | ANALYSIS |
| FR-BUD-010 | Budget progress | Progress bar % | Derived | `BudgetCalculationService` | `GET /api/v1/budgets` | Accessible label | Pending | ANALYSIS |
| FR-BUD-011 | Alert thresholds | Threshold % input | `budgets.alert_threshold_pct` | `BudgetAlertService` | `POST/PUT /api/v1/budgets` | 1..100 range | Pending | ANALYSIS |
| FR-BUD-012 | Approaching-limit alerts | Notification & badge | `budget_alerts`, `notifications` | `BudgetAlertService` | Internal on expense post | Deduplicated per period | Pending | ANALYSIS |
| FR-BUD-013 | Over-budget alerts | Notification & warning | `budget_alerts`, `notifications` | `BudgetAlertService` | Internal on expense post | Deduplicated per period | Pending | ANALYSIS |
| FR-BUD-014 | Budget history | Past periods tab | `budgets` | `BudgetController@history` | `GET /api/v1/budgets/history` | Owner-scoped | Pending | ANALYSIS |
| FR-BUD-015 | Budget reports | Reports > Budgets | `budgets`, `transactions` | `ReportService@budgets` | `GET /api/v1/reports/budgets` | Owner-scoped | Pending | ANALYSIS |

## Module 10 — Savings Goals (`FR-SAV`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-SAV-001 | Create goal | `/savings/create` | `savings_goals` | `SavingsService@create` | `POST /api/v1/savings` | Owner policy | Pending | ANALYSIS |
| FR-SAV-002 | Edit goal | `/savings/{id}/edit` | `savings_goals` | `SavingsService@update` | `PUT /api/v1/savings/{id}` | Owner policy | Pending | ANALYSIS |
| FR-SAV-003 | Target amount | Form input | `savings_goals.target_amount` | `SavingsValidator` | `POST/PUT /api/v1/savings` | `DECIMAL(19,4)` > 0 | Pending | ANALYSIS |
| FR-SAV-004 | Target date | Date picker | `savings_goals.target_date` | `SavingsValidator` | `POST/PUT /api/v1/savings` | Valid date | Pending | ANALYSIS |
| FR-SAV-005 | Contributions | Contribute modal | `savings_contributions` | `SavingsService@contribute` | `POST /api/v1/savings/{id}/contribute` | Must not count as income | Pending | ANALYSIS |
| FR-SAV-006 | Contribution history | Goal detail table | `savings_contributions`, `savings_history` | `SavingsController@show` | `GET /api/v1/savings/{id}` | Owner policy | Pending | ANALYSIS |
| FR-SAV-007 | Saved amount | Goal progress card | `savings_goals.current_amount` | `SavingsService` | `GET /api/v1/savings/{id}` | Sum of posted contributions | Pending | ANALYSIS |
| FR-SAV-008 | Remaining amount | Goal detail card | Derived | `SavingsService` | `GET /api/v1/savings/{id}` | `max(0, target - saved)` | Pending | ANALYSIS |
| FR-SAV-009 | Completion percentage | Progress bar | Derived | `SavingsService` | `GET /api/v1/savings` | `saved / target * 100` | Pending | ANALYSIS |
| FR-SAV-010 | Goal completion | Completed status & alert | `savings_goals.status`, `notifications` | `SavingsService` | Internal | Milestone notification | Pending | ANALYSIS |
| FR-SAV-011 | Linked account support | Account link select | `savings_goals.linked_account_id` | `SavingsService` | `POST/PUT /api/v1/savings` | Account ownership check | Pending | ANALYSIS |

## Module 11 — Debt Management (`FR-DEB`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-DEB-001 | Create debt | `/debts/create` | `debts` | `DebtService@create` | `POST /api/v1/debts` | Owner policy + Liability GL | Pending | ANALYSIS |
| FR-DEB-002 | Edit debt | `/debts/{id}/edit` | `debts` | `DebtService@update` | `PUT /api/v1/debts/{id}` | Owner policy | Pending | ANALYSIS |
| FR-DEB-003 | Creditor details | Creditor name/info | `debts.creditor_name` | `DebtValidator` | `POST/PUT /api/v1/debts` | XSS escaped | Pending | ANALYSIS |
| FR-DEB-004 | Original balance | Debt card | `debts.original_amount` | `DebtService` | `GET /api/v1/debts/{id}` | `DECIMAL(19,4)` | Pending | ANALYSIS |
| FR-DEB-005 | Outstanding balance | Debt KPI & detail | `debts.outstanding_amount` | `DebtService` | `GET /api/v1/debts/{id}` | Reconciles with Liability GL | Pending | ANALYSIS |
| FR-DEB-006 | Interest rate | Form field | `debts.interest_rate` | `DebtValidator` | `POST/PUT /api/v1/debts` | `DECIMAL(7,4)` >= 0 | Pending | ANALYSIS |
| FR-DEB-007 | Interest calculation method | Simple/Reducing select | `debts.interest_method`, `debt_interest_records` | `DebtInterestCalculator` | `POST /api/v1/debts` | Documented formula | Pending | ANALYSIS |
| FR-DEB-008 | Start date | Date field | `debts.start_date` | `DebtValidator` | `POST/PUT /api/v1/debts` | Valid date | Pending | ANALYSIS |
| FR-DEB-009 | Due date | Date field | `debts.due_date` | `DebtValidator` | `POST/PUT /api/v1/debts` | `due_date >= start_date` | Pending | ANALYSIS |
| FR-DEB-010 | Payment frequency | Frequency select | `debts.payment_frequency` | `DebtValidator` | `POST/PUT /api/v1/debts` | Enum allowlist | Pending | ANALYSIS |
| FR-DEB-011 | Debt payments | Record payment modal | `debt_payments`, `transactions` | `DebtService@recordPayment` | `POST /api/v1/debts/{id}/payments` | Principal/Interest GL split | Pending | ANALYSIS |
| FR-DEB-012 | Payment history | Debt detail table | `debt_payments` | `DebtController@show` | `GET /api/v1/debts/{id}` | Owner policy | Pending | ANALYSIS |
| FR-DEB-013 | Repayment schedule | Amortization table | `debt_repayment_schedules` | `DebtScheduleService` | `GET /api/v1/debts/{id}/schedule` | Owner policy | Pending | ANALYSIS |
| FR-DEB-014 | Repayment scenarios | Scenario simulator | `analytics_results` | `AnalyticsService` (C++) | `POST /api/v1/debts/{id}/scenarios` | Read-only C++ compute | Pending | ANALYSIS |
| FR-DEB-015 | Estimated payoff information | Payoff summary | Derived / C++ | `DebtScheduleService` | `GET /api/v1/debts/{id}` | Clearly marked estimate | Pending | ANALYSIS |

## Module 12 — Bills and Reminders (`FR-BIL`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-BIL-001 | Create bill | `/bills/create` | `bills` | `BillService@create` | `POST /api/v1/bills` | Owner policy | Pending | ANALYSIS |
| FR-BIL-002 | Edit bill | `/bills/{id}/edit` | `bills` | `BillService@update` | `PUT /api/v1/bills/{id}` | Owner policy | Pending | ANALYSIS |
| FR-BIL-003 | Provider information | Provider field | `bills.provider_name` | `BillValidator` | `POST/PUT /api/v1/bills` | Escaped output | Pending | ANALYSIS |
| FR-BIL-004 | Amount and currency | Amount + currency | `bills.amount`, `currency_code` | `BillValidator` | `POST/PUT /api/v1/bills` | `DECIMAL(19,4)` | Pending | ANALYSIS |
| FR-BIL-005 | Due date | Date input | `bills.due_date` | `BillValidator` | `POST/PUT /api/v1/bills` | Valid date | Pending | ANALYSIS |
| FR-BIL-006 | Frequency | Once/Monthly/etc. | `bills.frequency` | `BillValidator` | `POST/PUT /api/v1/bills` | Enum allowlist | Pending | ANALYSIS |
| FR-BIL-007 | Payment account | Account select | `bills.default_account_id` | `BillService` | `POST/PUT /api/v1/bills` | Account ownership check | Pending | ANALYSIS |
| FR-BIL-008 | Reminder preference | Days before + channel | `reminders` | `ReminderService` | `/api/v1/bills/{id}/reminders` | Owner policy | Pending | ANALYSIS |
| FR-BIL-009 | Upcoming bills | Dashboard & `/bills` | `bills` | `BillController@index` | `GET /api/v1/bills?status=upcoming` | Owner-scoped | Pending | ANALYSIS |
| FR-BIL-010 | Due-soon status | Status badge | `bills.status` | `BillStatusService` | `GET /api/v1/bills` | Derived by due window | Pending | ANALYSIS |
| FR-BIL-011 | Paid status | Paid state | `bills.status` | `BillService@pay` | `POST /api/v1/bills/{id}/pay` | Requires linked GL txn | Pending | ANALYSIS |
| FR-BIL-012 | Overdue status | Overdue badge | `bills.status` | `BillStatusService` | `GET /api/v1/bills` | Cron / on-read check | Pending | ANALYSIS |
| FR-BIL-013 | Cancelled status | Cancel action | `bills.status` | `BillService@cancel` | `POST /api/v1/bills/{id}/cancel` | Owner policy | Pending | ANALYSIS |
| FR-BIL-014 | Payment history | Bill detail history | `bill_payments` | `BillController@show` | `GET /api/v1/bills/{id}` | Owner policy | Pending | ANALYSIS |
| FR-BIL-015 | Linked financial transaction | Transaction link | `bill_payments.transaction_id` | `BillService@pay` | `POST /api/v1/bills/{id}/pay` | Atomic DB transaction | Pending | ANALYSIS |

## Module 13 — Recurring Transactions (`FR-REC`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-REC-001 | Recurring income | `/recurring/create` | `recurring_transactions` | `RecurringService@create` | `POST /api/v1/recurring` | Owner policy | Pending | ANALYSIS |
| FR-REC-002 | Recurring expenses | `/recurring/create` | `recurring_transactions` | `RecurringService@create` | `POST /api/v1/recurring` | Owner policy | Pending | ANALYSIS |
| FR-REC-003 | Recurring transfers | `/recurring/create` | `recurring_transactions` | `RecurringService@create` | `POST /api/v1/recurring` | Both accounts owned | Pending | ANALYSIS |
| FR-REC-004 | Schedule definitions | Cron/frequency UI | `recurring_transactions` | `ScheduleCalculator` | `POST/PUT /api/v1/recurring` | Bounded schedule | Pending | ANALYSIS |
| FR-REC-005 | Next execution date | Table column | `recurring_transactions.next_run_at` | `ScheduleCalculator` | `GET /api/v1/recurring` | UTC normalized | Pending | ANALYSIS |
| FR-REC-006 | Pause | Pause button | `recurring_transactions.status` | `RecurringService@pause` | `POST /api/v1/recurring/{id}/pause` | Owner policy | Pending | ANALYSIS |
| FR-REC-007 | Resume | Resume button | `recurring_transactions.status` | `RecurringService@resume` | `POST /api/v1/recurring/{id}/resume` | Owner policy | Pending | ANALYSIS |
| FR-REC-008 | Execution history | Detail tab | `recurring_execution_logs` | `RecurringController@show` | `GET /api/v1/recurring/{id}/logs` | Owner policy | Pending | ANALYSIS |
| FR-REC-009 | Execution logs | Log list | `recurring_execution_logs` | `RecurringRunner` | CLI / Admin monitor | No secrets logged | Pending | ANALYSIS |
| FR-REC-010 | Failure handling | Failed badge + alert | `recurring_execution_logs`, `notifications` | `RecurringRunner` | Internal job | Safe rollback + retry cap | Pending | ANALYSIS |
| FR-REC-011 | Duplicate execution prevention | Execution lock | `recurring_execution_logs` (unique slot) | `RecurringRunner` | Internal job | Unique `(recurring_id, scheduled_for)` | Pending | ANALYSIS |
| FR-REC-012 | Accounting engine integration | Posted txn link | `transactions`, `journal_entries` | `PostingService` | Internal | Full double-entry post | Pending | ANALYSIS |

## Module 14 — Reports and Analytics (`FR-RPT`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-RPT-001 | Income report | `/reports/income` | `transactions`, `journal_entry_lines` | `ReportService@income` | `GET /api/v1/reports/income` | Owner-scoped | Pending | ANALYSIS |
| FR-RPT-002 | Expense report | `/reports/expenses` | `transactions`, `journal_entry_lines` | `ReportService@expenses` | `GET /api/v1/reports/expenses` | Owner-scoped | Pending | ANALYSIS |
| FR-RPT-003 | Cash-flow report | `/reports/cash-flow` | `transactions`, `journal_entry_lines` | `ReportService@cashFlow` | `GET /api/v1/reports/cash-flow` | Excludes transfers | Pending | ANALYSIS |
| FR-RPT-004 | Budget report | `/reports/budgets` | `budgets`, `transactions` | `ReportService@budgets` | `GET /api/v1/reports/budgets` | Owner-scoped | Pending | ANALYSIS |
| FR-RPT-005 | Savings report | `/reports/savings` | `savings_goals`, `savings_contributions` | `ReportService@savings` | `GET /api/v1/reports/savings` | Owner-scoped | Pending | ANALYSIS |
| FR-RPT-006 | Debt report | `/reports/debts` | `debts`, `debt_payments` | `ReportService@debts` | `GET /api/v1/reports/debts` | Owner-scoped | Pending | ANALYSIS |
| FR-RPT-007 | Account activity report | `/reports/accounts` | `financial_accounts`, `journal_entry_lines` | `ReportService@accounts` | `GET /api/v1/reports/accounts` | Owner-scoped | Pending | ANALYSIS |
| FR-RPT-008 | Family report | `/reports/family` | `family_groups`, `shared_*` | `ReportService@family` | `GET /api/v1/reports/family` | Family permission check | Pending | ANALYSIS |
| FR-RPT-009 | Date filtering | Date range control | Queries | `ReportFilter` | Query params | Validated dates | Pending | ANALYSIS |
| FR-RPT-010 | Currency filtering | Currency dropdown | `currencies` | `ReportFilter` | Query params | Explicit conversion rule | Pending | ANALYSIS |
| FR-RPT-011 | Account filtering | Account multi-select | `financial_accounts` | `ReportFilter` | Query params | Ownership verified | Pending | ANALYSIS |
| FR-RPT-012 | Category filtering | Category select | `transaction_categories` | `ReportFilter` | Query params | Prepared params | Pending | ANALYSIS |
| FR-RPT-013 | Chart.js visualizations | Report canvases | N/A | N/A (JS) | Report JSON | Theme-aware colors | Pending | ANALYSIS |
| FR-RPT-014 | Accessible chart summaries | SR summary tables | N/A | View helpers | Report JSON | `aria-label` + data table | Pending | ANALYSIS |
| FR-RPT-015 | PDF export | Export PDF button | `storage/exports` | `ExportService@pdf` | `GET /api/v1/reports/export?format=pdf` | Auth + owner check | Pending | ANALYSIS |
| FR-RPT-016 | CSV export | Export CSV button | `storage/exports` | `ExportService@csv` | `GET /api/v1/reports/export?format=csv` | Formula injection guard | Pending | ANALYSIS |
| FR-RPT-017 | Excel export | Export XLSX button | `storage/exports` | `ExportService@xlsx` | `GET /api/v1/reports/export?format=xlsx` | Auth + owner check | Pending | ANALYSIS |
| FR-RPT-018 | Export authorization | Export routes | `audit_logs` | `ExportPolicy` | Export endpoints | Logged + owner-scoped | Pending | ANALYSIS |
| FR-RPT-019 | Accounting reconciliation | Report footer check | `journal_entry_lines` | `ReportReconciler` | Report metadata | Verifies GL match | Pending | ANALYSIS |

## Module 15 — C++ Analytics Engine (`FR-AI`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-AI-001 | Financial summaries | `/ai-insights` | `analytics_results` | `AnalyticsOrchestrator` | `GET /api/v1/ai/insights` | Read-only snapshot | Pending | ANALYSIS |
| FR-AI-002 | Spending trends | Trend cards & chart | `analytics_results` | `AnalyticsOrchestrator` | `POST /api/v1/ai/analyze` | C++ moving avg / slope | Pending | ANALYSIS |
| FR-AI-003 | Budget analysis | Budget variance insights | `analytics_results` | `AnalyticsOrchestrator` | `GET /api/v1/ai/insights` | C++ utilization model | Pending | ANALYSIS |
| FR-AI-004 | Cash-flow analysis | Cash-flow projection | `analytics_results` | `AnalyticsOrchestrator` | `GET /api/v1/ai/insights` | Exponential smoothing | Pending | ANALYSIS |
| FR-AI-005 | Savings projections | Goal ETA estimates | `analytics_results` | `AnalyticsOrchestrator` | `GET /api/v1/ai/insights` | Stated assumptions | Pending | ANALYSIS |
| FR-AI-006 | Debt repayment scenarios | Avalanche vs Snowball | `analytics_results` | `AnalyticsOrchestrator` | `POST /api/v1/debts/{id}/scenarios` | Read-only simulation | Pending | ANALYSIS |
| FR-AI-007 | Anomaly signals | Review signal cards | `analytics_results` | `AnalyticsOrchestrator` | `GET /api/v1/ai/insights` | Z-score / IQR review flag | Pending | ANALYSIS |
| FR-AI-008 | Financial pattern analysis | Pattern cards | `analytics_results` | `AnalyticsOrchestrator` | `GET /api/v1/ai/insights` | Explainable basis | Pending | ANALYSIS |
| FR-AI-009 | Analytical recommendations | Actionable suggestions | `analytics_results` | `AnalyticsOrchestrator` | `GET /api/v1/ai/insights` | Never mutates ledger | Pending | ANALYSIS |
| FR-AI-010 | Analysis history | History drawer/list | `analytics_jobs`, `analytics_results` | `AnalyticsRepository` | `GET /api/v1/ai/history` | Owner-scoped | Pending | ANALYSIS |
| FR-AI-011 | Model version tracking | Version badge | `analytics_model_versions` | `AnalyticsOrchestrator` | Metadata field | Schema + C++ version check | Pending | ANALYSIS |
| FR-AI-012 | User feedback | Helpful / Not helpful | `analytics_feedback` | `AnalyticsFeedbackService` | `POST /api/v1/ai/feedback` | Owner policy | Pending | ANALYSIS |
| FR-AI-013 | Input validation | Error fallback | `analytics_jobs` | `AnalyticsInputValidator` | Internal | Size limit + schema check | Pending | ANALYSIS |
| FR-AI-014 | Output validation | Error fallback | `analytics_jobs` | `AnalyticsOutputValidator` | Internal | Strict JSON schema check | Pending | ANALYSIS |
| FR-AI-015 | Error and timeout handling | Retryable state | `analytics_jobs` | `CppProcessRunner` | Internal | `proc_open` no shell + timeout | Pending | ANALYSIS |

## Module 16 — Family Finance (`FR-FAM`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-FAM-001 | Family group creation | `/family/create` | `family_groups` | `FamilyService@create` | `POST /api/v1/family/groups` | Plan check + CSRF | Pending | ANALYSIS |
| FR-FAM-002 | Family owner | Group header | `family_groups.owner_user_id` | `FamilyPolicy` | All family routes | Owner role enforced | Pending | ANALYSIS |
| FR-FAM-003 | Family invitations | Invite member modal | `family_invitations` | `FamilyInviteService` | `POST /api/v1/family/invitations` | Signed expiring token | Pending | ANALYSIS |
| FR-FAM-004 | Member acceptance | Accept invite page | `family_invitations`, `family_members` | `FamilyInviteService@accept` | `POST /api/v1/family/invitations/{token}/accept` | Auth user email match | Pending | ANALYSIS |
| FR-FAM-005 | Membership status | Active/Pending/Revoked | `family_members.status` | `FamilyService` | `GET /api/v1/family/members` | Scoped | Pending | ANALYSIS |
| FR-FAM-006 | Family roles | Owner/Admin/Member/Viewer | `family_members.role` | `FamilyPolicy` | `PUT /api/v1/family/members/{id}` | Owner-only change | Pending | ANALYSIS |
| FR-FAM-007 | Family permissions | Permission matrix | `family_permissions` | `FamilyPolicy` | `PUT /api/v1/family/permissions` | Server-side policy | Pending | ANALYSIS |
| FR-FAM-008 | Shared budgets | Family budgets tab | `shared_budgets` | `SharedBudgetService` | `/api/v1/family/budgets` | Explicit share check | Pending | ANALYSIS |
| FR-FAM-009 | Shared savings goals | Family savings tab | `savings_goals` (`family_group_id`) | `SharedSavingsService` | `/api/v1/family/savings` | Explicit share check | Pending | ANALYSIS |
| FR-FAM-010 | Shared transactions | Family feed | `shared_transactions` | `SharedTransactionService` | `/api/v1/family/transactions` | Explicit share only | Pending | ANALYSIS |
| FR-FAM-011 | Authorized family summaries | `/family` dashboard | Derived | `FamilySummaryService` | `GET /api/v1/family/summary` | Never leaks private accounts | Pending | ANALYSIS |
| FR-FAM-012 | Member removal | Remove member action | `family_members` | `FamilyService@removeMember` | `DELETE /api/v1/family/members/{id}` | Owner-only + audit | Pending | ANALYSIS |
| FR-FAM-013 | Access revocation | Immediate revoke | `family_members`, `family_permissions` | `FamilyService@revoke` | `POST /api/v1/family/members/{id}/revoke` | Immediate policy enforcement | Pending | ANALYSIS |
| FR-FAM-014 | Family activity history | Activity log tab | `audit_logs` | `FamilyAuditService` | `GET /api/v1/family/activity` | Family-scoped | Pending | ANALYSIS |

## Module 17 — Notifications (`FR-NOT`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-NOT-001 | In-app notifications | Topbar bell + `/notifications` | `notifications` | `NotificationService` | `GET /api/v1/notifications` | Owner-scoped | Pending | ANALYSIS |
| FR-NOT-002 | Budget notifications | Alert item | `notifications`, `budget_alerts` | `BudgetAlertService` | Internal | Owner-scoped | Pending | ANALYSIS |
| FR-NOT-003 | Upcoming bill notifications | Reminder item | `notifications`, `reminders` | `ReminderService` | Internal | Owner-scoped | Pending | ANALYSIS |
| FR-NOT-004 | Overdue bill notifications | Urgent item | `notifications` | `BillStatusService` | Internal | Owner-scoped | Pending | ANALYSIS |
| FR-NOT-005 | Savings milestones | Milestone item | `notifications` | `SavingsService` | Internal | Owner-scoped | Pending | ANALYSIS |
| FR-NOT-006 | Security notifications | Security alert | `notifications` | `SecurityEventService` | Internal | Login/password/2FA events | Pending | ANALYSIS |
| FR-NOT-007 | Account activity notifications | Activity alert | `notifications` | `AccountService` | Internal | Owner-scoped | Pending | ANALYSIS |
| FR-NOT-008 | Subscription notifications | Billing alert | `notifications` | `SubscriptionService` | Internal | Owner-scoped | Pending | ANALYSIS |
| FR-NOT-009 | Read/unread states | Unread counter & state | `notifications.read_at` | `NotificationService` | `GET /api/v1/notifications` | Owner-scoped | Pending | ANALYSIS |
| FR-NOT-010 | Mark as read | Mark read / Mark all | `notifications.read_at` | `NotificationService@markRead` | `POST /api/v1/notifications/{id}/read` | Ownership check | Pending | ANALYSIS |
| FR-NOT-011 | Notification history | `/notifications` paginated | `notifications` | `NotificationController` | `GET /api/v1/notifications` | Pagination | Pending | ANALYSIS |
| FR-NOT-012 | Notification preferences | `/settings/notifications` | `notification_preferences` | `PreferenceService` | `PUT /api/v1/settings/notifications` | Owner policy | Pending | ANALYSIS |
| FR-NOT-013 | Translated notification templates | EN / RW messages | `notification_templates` | `Translator` | Internal | Escaped interpolation | Pending | ANALYSIS |

## Module 18 — Document Management (`FR-DOC`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-DOC-001 | Document upload | `/documents` uploader | `documents` | `DocumentService@upload` | `POST /api/v1/documents` | CSRF, MIME/magic-byte check | Pending | ANALYSIS |
| FR-DOC-002 | Document categories | Category select | `documents.category` | `DocumentValidator` | `POST /api/v1/documents` | Allowlisted categories | Pending | ANALYSIS |
| FR-DOC-003 | Receipt storage | Receipts filter | `documents` | `DocumentService` | `GET /api/v1/documents?category=receipt` | Private disk | Pending | ANALYSIS |
| FR-DOC-004 | Invoice storage | Invoices filter | `documents` | `DocumentService` | `GET /api/v1/documents?category=invoice` | Private disk | Pending | ANALYSIS |
| FR-DOC-005 | Transaction attachments | Txn detail attachments | `transaction_attachments` | `DocumentService` | `/api/v1/transactions/{id}/attachments` | Owner policy | Pending | ANALYSIS |
| FR-DOC-006 | Account-related documents | Account detail docs | `documents.account_id` | `DocumentService` | `/api/v1/accounts/{id}/documents` | Owner policy | Pending | ANALYSIS |
| FR-DOC-007 | File validation | Upload error feedback | N/A | `FileValidator` | `POST /api/v1/documents` | `finfo` MIME + extension allowlist | Pending | ANALYSIS |
| FR-DOC-008 | File size limits | Max MB notice | N/A | `FileValidator` | `POST /api/v1/documents` | Server-enforced byte limit | Pending | ANALYSIS |
| FR-DOC-009 | Private storage | Non-public directory | `documents.storage_key` | `PrivateStorage` | N/A | Stored in `storage/private/` | Pending | ANALYSIS |
| FR-DOC-010 | Secure downloads | Download button | `documents` | `DocumentController@download` | `GET /api/v1/documents/{id}/download` | `X-Content-Type-Options: nosniff` | Pending | ANALYSIS |
| FR-DOC-011 | Access control | Protected endpoints | `documents.user_id` | `DocumentPolicy` | All `/documents/*` | IDOR prevention | Pending | ANALYSIS |
| FR-DOC-012 | Access logs | Audit trail | `document_access_logs` | `DocumentAuditService` | Internal | Logs user, IP, timestamp | Pending | ANALYSIS |
| FR-DOC-013 | Document removal/replacement | Delete/Replace modal | `documents.deleted_at` | `DocumentService@delete` | `DELETE /api/v1/documents/{id}` | Retention policy check | Pending | ANALYSIS |

## Module 19 — User Settings (`FR-SET`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-SET-001 | Profile | `/settings/profile` | `users` | `ProfileController` | `GET /api/v1/settings/profile` | Owner-only | Pending | ANALYSIS |
| FR-SET-002 | Name | Full name input | `users.full_name` | `ProfileService` | `PUT /api/v1/settings/profile` | Validation + escaping | Pending | ANALYSIS |
| FR-SET-003 | Email | Email input | `users.email` | `ProfileService` | `PUT /api/v1/settings/profile` | Re-verification on change | Pending | ANALYSIS |
| FR-SET-004 | Profile image | Avatar uploader | `users.avatar_path` | `AvatarService` | `POST /api/v1/settings/avatar` | Image re-encode / private route | Pending | ANALYSIS |
| FR-SET-005 | Password | Change password form | `users.password_hash` | `PasswordService` | `PUT /api/v1/settings/password` | Current password check | Pending | ANALYSIS |
| FR-SET-006 | Language preference | EN / RW selector | `users.locale` | `PreferenceService` | `PUT /api/v1/settings/preferences` | Allowlist `en`, `rw` | Pending | ANALYSIS |
| FR-SET-007 | Theme preference | Light / Dark | `users.theme` | `PreferenceService` | `PUT /api/v1/settings/preferences` | Allowlist `light`, `dark`, `system` | Pending | ANALYSIS |
| FR-SET-008 | System theme | Auto OS match | `users.theme` (`system`) | `PreferenceService` | `PUT /api/v1/settings/preferences` | `prefers-color-scheme` sync | Pending | ANALYSIS |
| FR-SET-009 | Default currency | Currency select | `users.default_currency` | `PreferenceService` | `PUT /api/v1/settings/preferences` | Validated `currencies.code` | Pending | ANALYSIS |
| FR-SET-010 | Date format | Format select | `users.date_format` | `PreferenceService` | `PUT /api/v1/settings/preferences` | Allowlisted formats | Pending | ANALYSIS |
| FR-SET-011 | Number format | Format select | `users.number_format` | `PreferenceService` | `PUT /api/v1/settings/preferences` | Allowlisted formats | Pending | ANALYSIS |
| FR-SET-012 | Time zone | Timezone select | `users.timezone` | `PreferenceService` | `PUT /api/v1/settings/preferences` | `DateTimeZone::listIdentifiers` | Pending | ANALYSIS |
| FR-SET-013 | Security settings | `/settings/security` | `two_factor_auth`, `users` | `SecuritySettingsController` | `/api/v1/settings/security` | Auth + CSRF | Pending | ANALYSIS |
| FR-SET-014 | Active sessions | Session list + revoke | `user_sessions` | `SessionService` | `GET/DELETE /api/v1/sessions` | Owner-only | Pending | ANALYSIS |
| FR-SET-015 | Privacy settings | `/settings/privacy` | `users` | `PrivacyController` | `PUT /api/v1/settings/privacy` | Consent tracking | Pending | ANALYSIS |
| FR-SET-016 | Data export | Export my data button | `storage/exports` | `PersonalExportService` | `POST /api/v1/settings/export` | Password confirm + audit | Pending | ANALYSIS |
| FR-SET-017 | Account closure | Close account modal | `users.status` | `AccountClosureService` | `POST /api/v1/settings/close` | Password + confirmation | Pending | ANALYSIS |
| FR-SET-018 | Notification settings | `/settings/notifications` | `notification_preferences` | `NotificationPrefService` | `PUT /api/v1/settings/notifications` | Owner-only | Pending | ANALYSIS |
| FR-SET-019 | Subscription preferences | `/settings/billing` | `subscriptions` | `SubscriptionController` | `GET /api/v1/settings/subscription` | Owner-only | Pending | ANALYSIS |

## Module 20 — Administration (`FR-ADM`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-ADM-001 | Admin dashboard | `/admin` | Aggregate metrics | `AdminDashboardController` | `GET /api/v1/admin/overview` | `admin.access` permission | Pending | ANALYSIS |
| FR-ADM-002 | User management | `/admin/users` | `users` | `AdminUserService` | `/api/v1/admin/users` | No private ledger access | Pending | ANALYSIS |
| FR-ADM-003 | Role management | `/admin/roles` | `roles` | `RoleService` | `/api/v1/admin/roles` | Admin RBAC + audit | Pending | ANALYSIS |
| FR-ADM-004 | Permission management | `/admin/permissions` | `permissions` | `PermissionService` | `/api/v1/admin/permissions` | Superadmin policy | Pending | ANALYSIS |
| FR-ADM-005 | Subscription management | `/admin/subscriptions` | `subscriptions`, `subscription_plans` | `AdminBillingService` | `/api/v1/admin/subscriptions` | Admin RBAC | Pending | ANALYSIS |
| FR-ADM-006 | Payment event monitoring | `/admin/payments` | `payment_provider_events`, `payment_records` | `AdminPaymentController` | `/api/v1/admin/payment-events` | Masked sensitive fields | Pending | ANALYSIS |
| FR-ADM-007 | System settings | `/admin/settings` | `system_settings` | `SystemSettingsService` | `/api/v1/admin/settings` | Admin RBAC + audit | Pending | ANALYSIS |
| FR-ADM-008 | Audit logs | `/admin/audit-logs` | `audit_logs` | `AuditController` | `GET /api/v1/admin/audit-logs` | Read-only immutable | Pending | ANALYSIS |
| FR-ADM-009 | Admin activity logs | `/admin/activity` | `admin_activity_logs` | `AdminAuditService` | `GET /api/v1/admin/activity` | Auto-logged | Pending | ANALYSIS |
| FR-ADM-010 | Support tickets | `/admin/support` | `support_tickets` | `SupportService` | `/api/v1/admin/tickets` | Scoped support perm | Pending | ANALYSIS |
| FR-ADM-011 | Support messages | Ticket thread | `support_messages` | `SupportService` | `/api/v1/admin/tickets/{id}/messages` | XSS escaped | Pending | ANALYSIS |
| FR-ADM-012 | Analytics job monitoring | `/admin/analytics` | `analytics_jobs` | `AdminAnalyticsController` | `GET /api/v1/admin/analytics-jobs` | Aggregate status only | Pending | ANALYSIS |
| FR-ADM-013 | System health | `/admin/health` | `system_health_logs` | `HealthCheckService` | `GET /api/v1/admin/health` | Admin-only (never public) | Pending | ANALYSIS |
| FR-ADM-014 | Backup records | `/admin/backups` | `backup_logs` | `BackupRecordService` | `GET /api/v1/admin/backups` | Admin-only | Pending | ANALYSIS |
| FR-ADM-015 | Background job monitoring | `/admin/jobs` | `recurring_execution_logs`, `analytics_jobs` | `JobMonitorService` | `GET /api/v1/admin/jobs` | Admin-only | Pending | ANALYSIS |

## Module 21 — Commercial SaaS Management (`FR-SaaS`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-SaaS-001 | Subscription plans | Pricing & Billing | `subscription_plans` | `PlanService` | `GET /api/v1/plans` | Authoritative server limits | Pending | ANALYSIS |
| FR-SaaS-002 | Free plan | Plan card | `subscription_plans` | Seeder | `GET /api/v1/plans` | Default tier | Pending | ANALYSIS |
| FR-SaaS-003 | Personal Pro plan | Plan card | `subscription_plans` | Seeder | `GET /api/v1/plans` | Enforced limits | Pending | ANALYSIS |
| FR-SaaS-004 | Family plan | Plan card | `subscription_plans` | Seeder | `GET /api/v1/plans` | Enables Family module | Pending | ANALYSIS |
| FR-SaaS-005 | Business plan where approved | Extensible tier | `subscription_plans` | `PlanService` | `GET /api/v1/plans` | Feature-flagged | Pending | ANALYSIS |
| FR-SaaS-006 | Subscription creation | Subscribe flow | `subscriptions` | `SubscriptionService` | `POST /api/v1/subscriptions` | Server-side verification | Pending | ANALYSIS |
| FR-SaaS-007 | Subscription status | Billing badge | `subscriptions.status` | `SubscriptionService` | `GET /api/v1/subscriptions/current` | Trial/Active/PastDue/Cancelled | Pending | ANALYSIS |
| FR-SaaS-008 | Plan limits | Limit modal/guard | `subscription_plans.limits_json` | `PlanLimitPolicy` | Enforced across services | Server-side enforcement | Pending | ANALYSIS |
| FR-SaaS-009 | Subscription invoices | Billing history | `subscription_invoices` | `InvoiceService` | `GET /api/v1/billing/invoices` | Owner policy | Pending | ANALYSIS |
| FR-SaaS-010 | Payment records | Payment table | `payment_records` | `PaymentRecordService` | `GET /api/v1/billing/payments` | No raw card secrets | Pending | ANALYSIS |
| FR-SaaS-011 | Provider event handling | Webhook endpoint | `payment_provider_events` | `WebhookService` | `POST /api/v1/webhooks/payments` | Signature + idempotency | Pending | ANALYSIS |
| FR-SaaS-012 | Renewal | Auto/Manual renewal | `subscriptions` | `SubscriptionService@renew` | `POST /api/v1/subscriptions/renew` | Provider-verified | Pending | ANALYSIS |
| FR-SaaS-013 | Upgrade | Change plan UI | `subscriptions` | `SubscriptionService@upgrade` | `POST /api/v1/subscriptions/upgrade` | Proration/verified state | Pending | ANALYSIS |
| FR-SaaS-014 | Downgrade | Change plan UI | `subscriptions` | `SubscriptionService@downgrade` | `POST /api/v1/subscriptions/downgrade` | Scheduled end-of-period | Pending | ANALYSIS |
| FR-SaaS-015 | Cancellation | Cancel modal | `subscriptions` | `SubscriptionService@cancel` | `POST /api/v1/subscriptions/cancel` | Audit logged | Pending | ANALYSIS |
| FR-SaaS-016 | Subscription history | Billing timeline | `subscriptions`, `audit_logs` | `SubscriptionController` | `GET /api/v1/subscriptions/history` | Owner policy | Pending | ANALYSIS |
| FR-SaaS-017 | Payment audit records | Audit trail | `audit_logs`, `payment_provider_events` | `AuditService` | Admin audit view | Immutable log | Pending | ANALYSIS |

## Module 22 — Progressive Web App Installation (`FR-PWA`)

| Requirement ID | Requirement | UI | Database | PHP | API | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| FR-PWA-001 | Web app manifest | `<link rel="manifest">` | N/A | Served from `public/manifest.webmanifest` | N/A | Correct MIME `application/manifest+json` | Pending | ANALYSIS |
| FR-PWA-002 | Application icons | Favicon, Apple touch, home screen | N/A | `public/assets/icons/*` (192, 512, maskable) | N/A | AI-PFMS brand icons only | Pending | ANALYSIS |
| FR-PWA-003 | Install invitation | Branded modal/banner (EN/RW, Light/Dark) | N/A | `install-prompt` partial + `install.css` | N/A | Dismissible, non-intrusive | Pending | ANALYSIS |
| FR-PWA-004 | Installation button | Public navbar, Auth topbar, User Settings | N/A | Layout partials + `pwa-install.js` | N/A | Hidden when standalone | Pending | ANALYSIS |
| FR-PWA-005 | Installation status detection | Preferences status panel | N/A | `pwa-install.js` | N/A | Accurate state (never fake installed) | Pending | ANALYSIS |
| FR-PWA-006 | Manual installation guidance | Device-specific modal (iOS/Android/Desktop) | N/A | `pwa-install.js` | N/A | UA/feature detection | Pending | ANALYSIS |
| FR-PWA-007 | Service worker | Background SW registration | N/A | `public/service-worker.js` | N/A | Scope `/`, HTTPS in prod | Pending | ANALYSIS |
| FR-PWA-008 | Offline fallback | Branded offline page + Retry button | N/A | `public/offline.html` (or SW fallback) | N/A | Honest offline state | Pending | ANALYSIS |
| FR-PWA-009 | Privacy-safe caching | N/A | N/A | `public/service-worker.js` | Network-only `/api/*` | NEVER cache tokens, balances, txns, docs | Pending | ANALYSIS |
| FR-PWA-010 | Standalone application display | Native window chrome | N/A | `manifest.webmanifest` (`display: standalone`) | N/A | Same PHP auth/session cookies | Pending | ANALYSIS |
| FR-PWA-011 | PWA update management | Update toast/refresh | N/A | `service-worker.js` + `pwa-install.js` | N/A | Safe cache-version purge | Pending | ANALYSIS |
| FR-PWA-012 | Cross-device installation testing | QA matrix (Win/Mac/Android/iOS) | N/A | N/A | N/A | Real browser/device verification | Pending | ANALYSIS |
