# Smart Expense & Budget Tracker — Project Context

> **Last code-verified:** 2026-09-01
> **Purpose:** Current, code-backed handoff for a developer or AI assistant joining the project with no chat history. Read this file first, then the specifications in [`docs/`](./).

---

## 1. Project Snapshot

Smart Expense & Budget Tracker (SmartBudget) is a full-stack personal-finance application. A user can create an account, record expenses, create monthly category budgets, track spending, receive threshold notifications, recover a password, and edit profile details. Email OTP verification, password recovery, and verified email changes are fully functional locally; the public demo currently disables OTP-dependent behavior because free-hosting SMTP ports are restricted.

The application currently consists of:

- A complete React/Vite frontend with responsive light and dark themes.
- Four Spring Boot microservices, each owning its own MySQL schema.
- Kafka event flow from expense changes to budget calculation to notifications.
- JWT authentication shared by all backend services.
- Docker Compose for MySQL, Kafka, and all four backend services.
- GitHub Actions CI for all four backend services plus frontend lint/build checks.
- A public deployment: Vercel for the frontend, Railway for all four backend services, and Aiven for MySQL and Kafka.
- Legacy Kubernetes manifests for the backend infrastructure and services; these are not the live deployment path.

### Runtime architecture

```text
Browser (React/Vite)
  │
  ├── /api/auth, /api/users ───────────────▶ user-service :8081 ──▶ sebt_user_db
  ├── /api/expenses ───────────────────────▶ expense-service :8082 ──▶ sebt_expense_db
  ├── /api/budgets ────────────────────────▶ budget-service :8083 ──▶ sebt_budget_db
  └── /api/notifications ──────────────────▶ notification-service :8084 ──▶ sebt_notification_db

expense-service
  └── expense-events (Kafka; ExpenseAdded/Updated/Deleted)
        └── budget-service
              ├── updates currentSpent
              └── budget-exceeded (Kafka; BudgetExceeded)
                    └── notification-service
                          └── persists notification

budget-service
  └── GET expense-service /api/expenses/summary
        └── backfills currentSpent when a new budget is created
```

Normal expense-to-budget-to-notification propagation remains asynchronous through Kafka. The one synchronous service-to-service call is the authenticated budget-creation backfill from budget-service to expense-service. Locally, the frontend uses Vite development proxies; the Vercel build calls the four public Railway service origins configured through `VITE_*_SERVICE_URL` variables.

---

## 2. Technology Stack

| Layer | Current implementation |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Axios, Tailwind CSS 3, Framer Motion, Recharts, Lucide React |
| Backend | Java 17, Spring Boot 3.2.5, Spring Web, Spring Data JPA, Spring Validation, Spring Security |
| Authentication | Stateless JWT (`jjwt` 0.12.5), BCrypt password hashing |
| Email | Spring Boot Mail, Gmail SMTP-compatible configuration, STARTTLS |
| Data | MySQL 8; one schema per microservice |
| Messaging | Confluent Kafka image `confluentinc/cp-kafka:7.7.1`, KRaft mode |
| Testing | JUnit 5, Mockito, Spring test utilities; opt-in live SMTP/account-flow tests |
| Local infrastructure | Dockerfiles per backend service and root Docker Compose |
| Cloud deployment | Vercel frontend; four Railway backend services; Aiven MySQL and Kafka |
| Deployment assets | Per-service Dockerfiles/startup scripts, Vercel configuration, and legacy Kubernetes manifests |
| CI/CD | GitHub Actions workflow at `.github/workflows/ci.yml`; Vercel/Railway deployment is managed outside that workflow |

---

## 3. Current Status

### Product and service status

| Component | Status | What is present |
|---|---|---|
| Frontend | **Built, redesigned, and live** | Protected application shell, all product pages, auth/recovery/legal routes, both themes, responsive behavior; deployed on Vercel |
| user-service | **Built and live** | Configurable OTP signup, login/JWT, forgot-password flow, profile editing, email-change OTP; deployed on Railway |
| expense-service | **Built and live** | Authenticated expense CRUD, filters, summary endpoint, Kafka event publishing; deployed on Railway |
| budget-service | **Built and live** | Monthly category budgets, existing-expense backfill, additive create behavior, cross-category/month expense corrections, threshold-event producer; deployed on Railway |
| notification-service | **Built and live** | Budget event consumer, persisted notifications, list/read/delete APIs; deployed on Railway |
| Kafka reliability layer | **Built, consumer retry policy incomplete** | Transactional producer outboxes, idempotent consumers, poison-pill handling, DLT routing; consumer-side transient retries remain effectively zero |
| Docker Compose | **Built** | MySQL, Kafka, and four healthy backend service definitions; frontend is run separately |
| Kubernetes | **Manifests present, not current production-ready** | Backend/infra manifests exist; frontend and newer SMTP configuration are absent |
| Automated backend tests | **Present** | Unit/service tests in all services plus opt-in user-service live flows |
| Automated frontend tests | **Not present** | No application-owned `.test`/`.spec` suite found |
| Public cloud deployment | **Live** | Vercel frontend, four Railway services, and Aiven MySQL/Kafka |
| CI/CD | **Implemented** | GitHub Actions tests all four backend services and lints/builds the frontend on pushes to `main` and pull requests targeting `main`; deployment is managed by Vercel/Railway outside the workflow |

### Implemented end-to-end behavior

- With OTP verification enabled, signup creates the account only after a valid emailed OTP; with the flag disabled in the live demo, signup creates the account directly.
- Existing users continue to log in with email/password and receive a JWT.
- Expenses and budgets support create, read, edit, and delete operations.
- A newly created budget synchronously backfills `currentSpent` from existing expenses in the same category/month.
- Expense category or month edits reverse spending from the old budget bucket and apply it to the new bucket.
- Expense events update budget spending and a first crossing of the configured threshold publishes a notification event.
- Notifications refresh without a page reload through 30-second polling plus focus/visibility refresh.
- With OTP enabled, password recovery verifies an emailed OTP before allowing a new password to be submitted; the live demo disables recovery.
- Profile name and phone save directly; with OTP enabled, email changes only after verification at the new address. Live-demo email changes are disabled.

This repository is feature-complete for the current product scope and publicly deployed. It is a live demo rather than a production-hardened system because of the open reliability, security, observability, and free-tier constraints in §12.

---

## 4. Repository Layout

```text
smart-expense-budget-tracker/
├── .github/workflows/ci.yml
├── backend/
│   ├── user-service/
│   ├── expense-service/
│   ├── budget-service/
│   └── notification-service/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── vercel.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── infra/
│   ├── k8s/
│   └── mysql/init/
├── docs/
├── docker-compose.yml
└── .env.example
```

Generated `target/`, `dist/`, and dependency directories are not source-of-truth implementation files.

---

## 5. Frontend

### Routing and application state

`frontend/src/App.jsx` lazy-loads these routes:

| Route | Access | Page |
|---|---|---|
| `/login` | Public | Login |
| `/signup` | Public | Two-step signup and OTP verification |
| `/forgot-password` | Public | Password recovery |
| `/terms` | Public | Terms of Service |
| `/privacy` | Public | Privacy Policy |
| `/dashboard` | JWT required | Dashboard |
| `/expenses` | JWT required | Expenses |
| `/budgets` | JWT required | Budgets |
| `/notifications` | JWT required | Notifications |

`ThemeProvider`, `AuthProvider`, and `FeatureFlagsProvider` wrap the router. `NotificationProvider` lives inside the application tree and reads authenticated state before fetching.

Important shared behavior:

- JWT/user data are managed by `AuthContext` and attached to API requests.
- `FeatureFlagsContext` reads `/api/public/config`; if the request fails it retains OTP verification as the safer default.
- A `401` response clears the local session and returns the user to login.
- Theme selection is class-based, saved as `smartbudget_theme` in local storage, and available from the profile menu.
- The old inert global search/Command-K control was removed. Search is local to Expenses and Budgets and filters already-loaded data client-side.
- `TiltCard` is used for restrained 3D depth and disables pointer-driven motion when hover is unavailable or reduced motion is requested.

### Design system: Graphite Ledger interaction language, current material palettes

The redesigned layout/component language is called **Graphite Ledger**: compact financial hierarchy, scarce cobalt emphasis, semantic tokens, controlled elevation, and ledger-oriented lists/cards.

The original Graphite dark material values (`#17181C` canvas, `#1E2025` surface, `#262930` elevated) were later superseded. The values actually applied in `frontend/src/index.css` are the final **Ivory Ledger / Mulberry Ink** material system below. Do not reintroduce the older Graphite surface colors as current tokens.

#### Light — Ivory Ledger

| Token | Hex |
|---|---|
| Canvas | `#E8E2D8` |
| Surface/card | `#F7F3EC` |
| Elevated/modal | `#FFFDFC` |
| Inset/muted surface | `#DED7CC` |
| Hover | `#EEE8DF` |
| Subtle border | `#C8BFB3` |
| Strong border | `#6F685F` |
| Primary text | `#191C20` |
| Secondary text | `#4E5866` |
| Muted text | `#62646B` |

#### Dark — Mulberry Ink

| Token | Hex |
|---|---|
| Canvas | `#1A161C` |
| Surface/card | `#231E26` |
| Elevated/modal | `#2D2631` |
| Inset/muted surface | `#181419` |
| Hover | `#342C39` |
| Subtle border | `#3E3543` |
| Strong border | `#786D7D` |
| Primary text | `#F4F1EB` |
| Secondary text | `#AEB2BC` |
| Muted text | `#7F8794` |

#### Accent, semantics, and elevation

- Solid primary cobalt: `#2457D6`; dark-theme text/link accent: `#79A8FF`.
- Cobalt is intentionally scarce: primary actions, active navigation, links, focus rings, and primary chart series—not general card tinting.
- Light semantic colors: success `#15803D`, warning `#A15C00`, error `#C9364F`, info `#0269A1`.
- Dark semantic colors: success `#4EC99A`, warning `#E1B85B`, error `#E36A7A`, info `#63C7D6`.
- Resting cards use a hairline border and minimal warm shadow. Dropdowns and modals use the stronger two-layer elevation. There is no global grain and no accent-tinted surface system.
- Tailwind utilities map to CSS variables rather than fixed page-specific background colors.

### Page implementations

#### Dashboard

- Responsive asymmetric grid with Active Budgets, Total Spent This Month, Expense Breakdown, Spending Trend, Budget Overview, and Recent Expenses.
- Summary cards use curated Lucide icons and restrained tilt treatment.
- Recharts supplies the spending trend and category breakdown, including tooltips/toggles and distinct primary/comparison/category series.
- Existing View Details navigation and CSV export behavior are retained.

#### Expenses — “Transaction Ledger”

- Expenses are grouped client-side by Today, Yesterday, or date, with group totals.
- Dense row anatomy separates category icon, description/category hierarchy, date, amount, and actions.
- Row actions become more prominent on hover/focus and remain available for touch/mobile use.
- Search is case-insensitive across description and category and composes with category/date filters.
- Add/Edit supports a preset category plus optional custom category. Custom categories use the shared `Other`/ellipsis icon fallback from `src/utils/categoryIcons.js`.
- Loading, empty, error, add/edit, and delete-confirmation states are implemented.

#### Budgets — “Budget Plan Ledger”

- Month navigator, aggregate monthly summary band, and category search.
- Individual budgets are cards in a responsive grid with reduced-motion-aware `TiltCard` depth.
- Each card shows spent, remaining, limit, percentage, and a precise progress marker for high utilization.
- Progress states are cobalt below 70%, amber at 70–79%, and rose at 80% and above. The aggregate band is intentionally calmer than category-level alerts.
- `POST /api/budgets` backfills existing matching expenses on first creation. For an existing `(userId, category, month)`, it is additive: the submitted amount increments `monthlyLimit`; `currentSpent` is unchanged.
- Preset and optional custom category behavior matches Expenses.

#### Authentication — “Quiet Financial Entry”

- Login, Signup, Forgot Password, and Reset Password reuse `AuthShell`.
- Desktop uses a 38/62 asymmetric split with an editorial rail, brand statement, and layered monthly-plan ledger preview; forms are approximately 400–420 px wide.
- Mobile removes the editorial rail and uses a compact full-width form.
- Password fields provide show/hide controls.
- OAuth is not implemented; disabled provider buttons were replaced by a quiet “Additional sign-in methods coming soon” disclosure.
- Terms and Privacy routes contain genuine project-specific placeholder policies rather than lorem ipsum.

#### Notifications — “Attention Ledger”

- Page content is max-width constrained and grouped into Today and Earlier.
- Rows use category-aware icons, message hierarchy, timestamp, severity color, unread cobalt dot, mark-read behavior, and hover/focus delete affordance.
- The empty state uses a broader intentional panel and explanatory budget-alert copy.
- The header bell dropdown is a roughly 380 px triage surface with All/Unread filters, the latest five rows, mark-all-read, and a View all notifications footer; delete is intentionally page-only.
- Authenticated polling occurs every 30 seconds, with refresh on focus/visibility. Unauthenticated auth routes do not request notifications.

#### Profile menu

- Initials avatar and identity header with name, email, and “Personal workspace.”
- Edit Profile, Notifications, inline theme toggle, Support preview, and isolated Sign out.
- Edit Profile is wired for name/phone updates and the email-change OTP flow.
- Support remains a UI preview; there is no support/helpdesk backend.

### Frontend-specific conventions

- Keep category-icon selection centralized in `frontend/src/utils/categoryIcons.js`.
- Lucide icons should retain `flex-shrink-0` and explicit color props where the surrounding layout relies on them.
- Preserve semantic CSS variables when restyling; avoid hardcoded light/dark page colors.
- The frontend currently has no application-owned automated test suite; browser/manual regression testing is still required.

---

## 6. Authentication, OTP, and Profile Behavior

### JWT and authorization

- Login uses email/password and BCrypt comparison.
- Successful login, verified signup, and verified email change return a JWT.
- JWTs contain the user identity used by downstream services; all services must share the same `JWT_SECRET`.
- Default token lifetime is 24 hours (`JWT_EXPIRATION_MS=86400000`).
- Services are stateless and protect business APIs with the JWT filter; actuator health is public.
- Existing JWTs are not currently revoked when a password or email changes. See Known Issues.

### OTP challenge storage and controls

The user-service stores challenges in `email_otp_challenges` with:

- Normalized email and purpose (`SIGNUP`, `EMAIL_CHANGE`, or `PASSWORD_RESET`).
- BCrypt-hashed six-digit OTP; plaintext OTP is not stored.
- Ten-minute expiry by default.
- Sixty-second resend cooldown by default.
- Five-attempt limit by default.
- Pending signup data where needed, including an already-BCrypt-hashed password.

Email format validation requires a syntactically valid address with a dotted domain. Before signup or email-change delivery, the domain is checked through JNDI DNS for a non-null MX record. DNS lookup uses a short timeout/retry configuration. MX validation proves that the domain accepts mail; it cannot prove that a particular mailbox exists.

Spring Mail reads SMTP settings from environment-backed properties and enables authenticated STARTTLS. Synchronous send failures are converted to application errors for signup/email-change so the frontend stays on the entry step. Password-recovery delivery deliberately preserves anti-enumeration behavior.

### OTP deployment feature flag

`OTP_VERIFICATION_ENABLED` defaults to `true` in application configuration and Docker Compose, so the full signup, password-reset, and verified email-change flows remain functional locally. The user-service exposes the effective value through `GET /api/public/config`, and the frontend adapts its forms to that response.

The Railway deployment sets the flag to `false` because the free hosting path does not permit the required SMTP ports. In that demo mode:

- `POST /api/auth/signup` creates the user directly and returns the JWT/user response without an OTP step.
- Password reset is shown as unavailable.
- Profile name and phone remain editable, but email changes are disabled.

This is a deployment limitation, not removal of the underlying OTP implementation.

### Signup flow

The sequence below is the full flow used when `OTP_VERIFICATION_ENABLED=true`:

1. `POST /api/auth/signup` validates name/email/password, checks uniqueness and MX, creates a hashed challenge, and sends the OTP. It returns `202`; no user exists yet.
2. `POST /api/auth/signup/verify` validates expiry, attempts, and OTP; creates the user only after success; removes the challenge; and returns `201` with JWT/user data.
3. `POST /api/auth/signup/resend` enforces the cooldown and sends a replacement code.

The current minimum password length is **8 characters**.

### Forgot-password flow

The current implementation is an explicit three-screen sequence, not the earlier single combined form:

1. `POST /api/auth/forgot-password` always returns the same generic `202` message whether the email is registered or not. MX and user existence determine whether a code is actually sent.
2. `POST /api/auth/forgot-password/verify` validates the OTP without changing the password or consuming the challenge, allowing the UI to reveal password fields only after verification.
3. `POST /api/auth/reset-password` revalidates the OTP, BCrypt-hashes and `saveAndFlush`es the new password, then deletes the challenge so it cannot be reused.

SMTP/DNS failures during the forgot request are not exposed in a way that reveals account existence. This is intentional anti-enumeration behavior.

### Profile editing

- `GET /api/users/me` returns the authenticated profile.
- `PUT /api/users/me` updates name and nullable phone number directly.
- `POST /api/users/me/email/request` validates uniqueness/MX and emails a challenge to the new address.
- `POST /api/users/me/email/verify` changes the email only after OTP verification and returns a replacement JWT.
- Phone number is format-validated but not ownership-verified; SMS OTP is explicitly out of scope.

### Secrets and mail configuration

Real SMTP credentials must remain only in a gitignored local `.env` or secret manager. Source configuration and `.env.example` contain placeholders. Do not put real credentials in this document, `application.yml`, or committed Compose overrides.

Important environment variables:

```text
JWT_SECRET
JWT_EXPIRATION_MS
SMTP_HOST
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
MAIL_FROM
OTP_EXPIRY_MINUTES
OTP_RESEND_COOLDOWN_SECONDS
OTP_MAX_ATTEMPTS
OTP_VERIFICATION_ENABLED
```

---

## 7. Backend Services and API Surface

All business endpoints derive `userId` from the authenticated JWT; clients do not submit a user ID.

### user-service — port 8081, `sebt_user_db`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Start signup OTP |
| POST | `/api/auth/signup/verify` | Verify OTP and create account |
| POST | `/api/auth/signup/resend` | Resend signup OTP |
| POST | `/api/auth/login` | Authenticate and issue JWT |
| POST | `/api/auth/forgot-password` | Start anti-enumerating reset flow |
| POST | `/api/auth/forgot-password/verify` | Pre-validate reset OTP |
| POST | `/api/auth/reset-password` | Validate OTP and persist new password |
| GET | `/api/public/config` | Return public deployment feature flags |
| GET | `/api/users/me` | Get profile |
| PUT | `/api/users/me` | Update name/phone |
| POST | `/api/users/me/email/request` | Send OTP to new email |
| POST | `/api/users/me/email/verify` | Verify and apply new email |

### expense-service — port 8082, `sebt_expense_db`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/expenses` | Create and publish `ExpenseAdded` |
| GET | `/api/expenses` | List; optional category/startDate/endDate filters |
| GET | `/api/expenses/summary` | Sum owned expenses for a category and `YYYY-MM` month (budget backfill) |
| GET | `/api/expenses/{id}` | Get owned expense |
| PUT | `/api/expenses/{id}` | Update and publish `ExpenseUpdated` |
| DELETE | `/api/expenses/{id}` | Delete and publish `ExpenseDeleted` |
| POST | `/api/admin/republish-expense-event/{expenseId}` | Dev/test idempotency helper when enabled |

### budget-service — port 8083, `sebt_budget_db`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/budgets` | Create or add submitted limit to same category/month |
| GET | `/api/budgets` | List; optional `month=YYYY-MM` |
| GET | `/api/budgets/{id}` | Get owned budget |
| PUT | `/api/budgets/{id}` | Replace editable budget values |
| DELETE | `/api/budgets/{id}` | Delete owned budget |

The database constraint/repository identity is one budget per `(userId, category, month)`. On first creation, budget-service calls the authenticated expense summary endpoint and initializes `currentSpent` from matching existing expenses. Repeating POST for that identity increments `monthlyLimit` and preserves `currentSpent`.

### notification-service — port 8084, `sebt_notification_db`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/notifications` | List newest-first for current user |
| PUT | `/api/notifications/{id}/read` | Mark owned notification read |
| DELETE | `/api/notifications/{id}` | Delete owned notification |

The frontend implements “mark all read” by composing the available per-item operation; there is no bulk backend endpoint.

---

## 8. Kafka Topics, Events, and Reliability

### Topics and consumers

| Topic | Producer | Consumer/group | Event types |
|---|---|---|---|
| `expense-events` | expense-service | budget-service / `budget-service-group` | `ExpenseAdded`, `ExpenseUpdated`, `ExpenseDeleted` |
| `budget-exceeded` | budget-service | notification-service / `notification-service-group` | `BudgetExceeded` |
| `expense-events.DLT` | budget error recoverer | No application consumer | Failed expense records |
| `budget-exceeded.DLT` | notification error recoverer | No application consumer | Failed budget records |

Event keys are the user ID. Business events include a UUID `eventId` used for deduplication.

### Expense-to-notification flow

1. An expense REST mutation commits the expense change and a `PENDING` outbox row in one expense-service database transaction.
2. The expense outbox poller claims the row, publishes it to Kafka, waits for broker acknowledgment, and marks it `PUBLISHED`.
3. budget-service consumes the expense event.
4. `ProcessedEventService` checks `processed_events.event_id` inside the same database transaction as the budget mutation.
5. If unseen, budget logic changes `currentSpent`; the processed-event row is inserted before transaction commit.
6. If usage crossed from below the configured threshold (default 80%) to at/above it, the budget mutation and a `BudgetExceeded` outbox row commit together. The budget poller publishes it asynchronously.
7. notification-service applies the same transactional processed-event pattern, then stores the notification.
8. The frontend discovers it through polling/focus refresh and updates the page/dropdown/unread count.

### Idempotency

budget-service and notification-service each own a `processed_events` table:

- `event_id` is the primary key.
- The duplicate check, business mutation, and dedup insert execute in one local DB transaction.
- A duplicate event does not reapply business logic.
- Missing `eventId` is rejected/skipped rather than processed without protection.
- Cleanup runs daily at 02:00 and removes rows older than the configured retention period (default seven days).

This protects each consumer’s local database operation. The producer-side transactional
outboxes described below close the previous database/Kafka dual-write gap.

### Transactional producer outboxes

expense-service and budget-service each own an `outbox_events` table. Expense
create/update/delete and threshold-crossing budget updates write their business data
and outbox row in the same local transaction. The development expense republish helper
also queues through the outbox instead of calling Kafka inline.

The table stores `id`, `aggregate_id`, `event_type`, JSON `payload`, `created_at`,
nullable `published_at`, `status`, `attempt_count`, `next_attempt_at`, and `last_error`.
Status is one of `PENDING`, `PUBLISHED`, or `FAILED`.

Each service polls every two seconds by default in batches of 50. A ready row is
claimed with a short lease so concurrent replicas do not normally send it together.
The publisher waits up to ten seconds for Kafka's broker acknowledgment before marking
the row `PUBLISHED`. Failures stay `PENDING` and retry with exponential backoff from
one second up to one minute; the fifth failure marks the row `FAILED` and emits an
error log for alerting. These values are configurable through `OUTBOX_*` environment
variables.

This changes inline publication to a small, intentional asynchronous delay, which is
compatible with the existing Kafka-based eventual-consistency model. Delivery is
at-least-once: a crash after Kafka acknowledges but before `published_at` commits can
produce a duplicate, and the existing consumer `eventId` deduplication handles it.

### Poison-pill handling

Both consumers configure:

- `ErrorHandlingDeserializer` delegating to String/JSON deserializers.
- `DeadLetterPublishingRecoverer` routing failures to `<original-topic>.DLT`.
- Record acknowledgment mode.
- Deserialization exceptions as non-retryable.

The current `DefaultErrorHandler` uses `FixedBackOff(0, 0)`, so even retryable/transient handler failures receive zero retry attempts before DLT routing. This is an open reliability issue, not a completed retry strategy.

---

## 9. Databases

Locally, one MySQL 8 container hosts four schemas created by `infra/mysql/init`. The live deployment uses Aiven MySQL with the same service-owned schema boundaries:

| Service | Schema | Principal tables |
|---|---|---|
| user-service | `sebt_user_db` | `users`, `email_otp_challenges` |
| expense-service | `sebt_expense_db` | `expenses`, `outbox_events` |
| budget-service | `sebt_budget_db` | `budgets`, `processed_events`, `outbox_events` |
| notification-service | `sebt_notification_db` | `notifications`, `processed_events` |

JPA is currently configured to update schemas at startup. Services do not access one another’s schemas in application code. Docker Compose nevertheless gives every service the same MySQL root credentials; least-privilege service users and managed migrations are still needed. Live database credentials remain platform secrets and are not stored in the repository.

---

## 10. Local Development and Deployment

### Public cloud deployment (live)

- Source: public GitHub repository at [Ayush-Raj178/smart-expense-budget-tracker](https://github.com/Ayush-Raj178/smart-expense-budget-tracker).
- Frontend: Vercel at [smart-expense-budget-tracker-lake.vercel.app](https://smart-expense-budget-tracker-lake.vercel.app).
- Backend: all four Spring Boot services run on Railway.
- Data and messaging: Aiven hosts MySQL and Kafka on its free tier.

Railway is the actual backend host. Render was evaluated first but was not used because it required card verification even for the free tier. The tracked `docs/DEPLOYMENT.md` and `frontend/.env.example` still describe that abandoned Render plan and must not be treated as the current production runbook until they are rewritten for Railway.

GitHub Actions runs repository checks; deployment is managed outside that workflow by Vercel and Railway. Vercel receives the four public Railway origins through `VITE_USER_SERVICE_URL`, `VITE_EXPENSE_SERVICE_URL`, `VITE_BUDGET_SERVICE_URL`, and `VITE_NOTIFICATION_SERVICE_URL`; the Railway services allow the Vercel origin through CORS configuration.

### Production-specific configuration

- Railway user-service sets `OTP_VERIFICATION_ENABLED=false`; local Docker Compose defaults it to `true`.
- Docker Compose keeps budget-service's expense-client timeouts at `EXPENSE_SERVICE_CONNECT_TIMEOUT_MS=500` and `EXPENSE_SERVICE_READ_TIMEOUT_MS=1000`, appropriate for the local Docker network.
- Railway uses `EXPENSE_SERVICE_CONNECT_TIMEOUT_MS=3000` and `EXPENSE_SERVICE_READ_TIMEOUT_MS=5000` because its budget-to-expense backfill call crosses public service origins.

The original 500 ms/1000 ms values were tuned for the local network. Public-internet latency between Railway services exceeded them, so the backfill request exhausted its two attempts and followed the client's fallback path, creating the budget with `currentSpent=0`. Increasing the production values to 3000 ms/5000 ms resolved the observed deployment failure. Keep local and cloud latency profiles separate when tuning cross-service clients.

### Docker Compose

Compose starts:

- MySQL 8: host `3307`, container `3306`.
- Kafka: `kafka:9092` inside the network and `localhost:29092` from the host.
- user-service `8081`, expense-service `8082`, budget-service `8083`, notification-service `8084`.
- Named volumes `sebt_mysql_data` and `sebt_kafka_data` on network `sebt-network`.

The frontend is **not** a Compose service. Run it separately from `frontend/`; Vite proxies API paths to ports 8081–8084.

Typical local start:

```powershell
docker compose up -d --build
docker compose ps
Set-Location frontend
npm run dev
```

### Recurring Docker gotcha: stale service images

Source-code changes do not alter an already-running container. `docker compose up -d` can leave a previously built image running, which has repeatedly made fixed code appear broken.

Before debugging the source after a backend change:

1. Run `docker compose ps` and inspect the target container’s creation/start time.
2. Check its logs to identify the version actually running.
3. Rebuild the affected service without cache.
4. Force-recreate that service and confirm its new start time/health.

Example:

```powershell
docker compose build --no-cache user-service
docker compose up -d --force-recreate user-service
docker compose ps
docker compose logs --since 5m user-service
```

Do not conclude that a new code path is unwired until the live container version has been verified.

### Kubernetes status

`infra/k8s/` contains namespace, MySQL, Kafka, four backend deployments/services, ingress, and secrets manifests. The service manifests generally configure two replicas; MySQL and Kafka remain single-instance.

These manifests are not parity-complete with current local behavior:

- No frontend deployment/service is present.
- The user-service deployment does not currently expose the newer SMTP/OTP environment configuration.
- Secrets are development-oriented and need external secret management/rotation.
- Single-instance MySQL/Kafka and local-style persistence are not a production HA design.
- No CI/CD pipeline applies or validates the manifests.

Treat Kubernetes as an existing deployment starting point, not a verified current production release.

---

## 11. Tests and Verification

### Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and pull requests targeting `main`:

- A four-entry backend matrix runs `mvn test` independently for user-service, expense-service, budget-service, and notification-service on Java 17.
- The frontend job installs dependencies with Node.js 22, then runs `npm run lint` and `npm run build`.
- `MAIL_SMOKE_TEST` and `LIVE_ACCOUNT_FLOW_TEST` are explicitly set to `false`. Their JUnit environment-variable conditions therefore skip those live-only tests in CI while retaining them for opt-in local/integration verification.

The workflow is a build/test quality gate; production deployment is managed by Vercel and Railway rather than deploy steps inside the workflow.

Local verification on 2026-09-01 matched those gates: user-service ran 31 tests with the two live-only tests skipped, expense-service passed 15 tests, budget-service passed 22 tests, notification-service passed 9 tests, and frontend lint/build completed successfully (with existing non-blocking lint warnings).

### Test coverage present in source

- user-service: `UserServiceTest`, `AccountVerificationServiceTest`, `EmailDomainValidationServiceTest`.
- expense-service: `ExpenseServiceTest`, expense event serialization tests, `ExpenseOutboxServiceTest`, `ExpenseOutboxPublisherTest`.
- budget-service: `BudgetServiceTest`, `ProcessedEventServiceTest`, `BudgetOutboxServiceTest`, `BudgetOutboxPublisherTest`.
- notification-service: `NotificationServiceTest`, `ProcessedEventServiceTest`.
- `MailSmokeTest` runs only when `MAIL_SMOKE_TEST=true`; it sends via SMTP and checks the Gmail inbox through IMAP.
- `LiveAccountFlowTest` runs only when `LIVE_ACCOUNT_FLOW_TEST=true`; it exercises signup, cooldown, login, profile update, email change, password reset, database hash verification, direct login, OTP reuse rejection, and anti-enumeration against running infrastructure.

Opt-in mail/live tests require real local secrets and must never print or commit them. The regular test suite does not prove live Gmail delivery.

`BudgetServiceTest` includes backfill behavior and same-bucket, cross-category, cross-month, and combined category/month expense-update cases. The expense-service producer captures old/new amount, category, and date in `ExpenseUpdatedEvent`, which is the contract those corrections require.

There are no project-owned frontend unit/component/end-to-end tests. Visual and interaction regressions are currently verified manually in the browser.

### Verification note for the transactional outbox update

The complete expense-service and budget-service Maven suites pass locally. Focused
tests cover business-operation outbox creation, successful broker acknowledgment and
the `PUBLISHED` transition, and failed publication remaining eligible for retry.

---

## 12. Known Issues and Risks

### Open issues, in priority order

| Priority | Issue | Verified current behavior / impact | Required direction |
|---|---|---|---|
| P1 | Budget backfill still fails open to zero | `ExpenseSummaryClient` retries once, then logs a warning and returns zero if expense-service remains unavailable or too slow. Production timeout tuning fixed the observed Railway latency failure, but a longer outage can still create an understated budget. | Make failure explicit or persist/retry reconciliation state instead of treating transport failure as a valid zero total. |
| P1 | Kafka retry is effectively zero | `FixedBackOff(0, 0)` immediately routes handler failures to DLT, including transient database/service failures. | Add bounded exponential/fixed retries for retryable exceptions; keep poison pills non-retryable. |
| P1 | No DLT operations path | Records reach `.DLT`, but there is no alerting, dashboard, replay tool, or application consumer. | Add monitoring and an authenticated replay/runbook process. |
| P1 | Auth endpoints lack general abuse controls | OTP challenges have cooldown and attempt limits, but login and public auth initiation have no IP/account-wide rate limiter. | Add gateway/service rate limiting, progressive login throttling, audit metrics, and safe client feedback. |
| P1 | Password reset does not revoke existing JWTs | Stateless tokens issued before a password reset remain valid until expiry; email change likewise has no global revocation/version check. | Add token version/session revocation and increment it on sensitive account changes. |
| P1 | Local services use one MySQL root user | Compose defaults every service to root on the same MySQL instance. A compromised service can access every schema. | Create one least-privilege DB user per schema; move secrets out of Compose defaults. |
| P2 | Dev republish endpoint is enabled in Compose | `ADMIN_REPUBLISH_EVENTS_ENABLED=true` exposes an authenticated event-republish helper to any signed-in user; there is no admin role. | Default it off and restrict it to a dedicated development profile/admin authorization. |
| P2 | Legacy deployment assets are stale | Kubernetes lacks the frontend and current OTP configuration, while `docs/DEPLOYMENT.md` and `frontend/.env.example` still target the abandoned Render plan. The live path is Vercel + Railway + Aiven. | Rewrite the deployment runbook for Railway and either update or clearly archive the Kubernetes path. |
| P2 | MX validation cannot prove mailbox existence | A real mail domain can accept an address syntactically even when that mailbox does not exist; asynchronous bounces cannot be guaranteed in the request cycle. | Keep error wording honest; consider a reputable verification API only if product requirements justify the privacy/cost tradeoff. |
| P2 | Phone ownership is unverified | Phone updates are direct and no SMS challenge exists. | Add SMS verification if phone is ever used for recovery, trust, or alerts. |
| P2 | No frontend automated regression suite | Complex theme, form, modal, filter, polling, and responsive behavior relies on manual QA. | Add component tests and browser E2E coverage for core flows/themes. |

### Resolved issues that should not be reintroduced

| Issue | Current resolution |
|---|---|
| Database writes and Kafka publishes were not atomic | expense-service and budget-service now commit business changes with `PENDING` outbox rows, then scheduled relays wait for Kafka acknowledgment and apply bounded retry/failure state. |
| Duplicate Kafka delivery re-applied business logic | Transactional `processed_events` dedup is implemented in budget and notification consumers. |
| Malformed Kafka record could crash/stall consumer | `ErrorHandlingDeserializer` plus `DeadLetterPublishingRecoverer` routes failed records to DLT topics. |
| Budget alert repeatedly published while already over threshold | Alert publishes only on a transition from below to at/above the threshold. |
| Notifications appeared only after manual reload | Authenticated 30-second polling plus focus/visibility refresh updates page, dropdown, and unread count. |
| Notification fetch ran on Login/Signup and caused 401s | `NotificationContext` waits for auth loading and fetches only when a valid authenticated token exists. |
| Duplicate category/month POST replaced the old limit | Current business rule is additive; POST increases `monthlyLimit` and does not alter `currentSpent`. |
| Password-reset success did not reliably prove login | Reset uses the same BCrypt encoder, `saveAndFlush`, revalidation, and one-time challenge deletion; the opt-in live test checks stored hash change and direct login. |
| Expense category/month edits corrupted budget totals | `ExpenseUpdated` now includes old/new amount, category, and date. budget-service reverses the old bucket and applies the new bucket, with same-bucket, cross-category, cross-month, and combined tests. |
| New budgets ignored existing expenses | First creation calls expense-service's authenticated summary endpoint and initializes `currentSpent` from the existing category/month total. |
| Repository had no automated CI | GitHub Actions now tests all four backend services and lints/builds the frontend on pushes/PRs for `main`, while correctly skipping opt-in live mail/account tests. |
| No public cloud deployment | The public GitHub repository now feeds a live Vercel frontend, four Railway backends, and Aiven MySQL/Kafka. |

### Deployment-specific findings and constraints

- **SMTP on free hosting:** Railway production uses `OTP_VERIFICATION_ENABLED=false`, so the public demo supports direct signup but not password reset or email changes. Local Docker Compose defaults to the complete OTP flow with the flag set to `true`.
- **Cross-service latency:** public-internet calls between Railway services need a different timeout budget than Docker-network calls. The observed working split is 3000 ms connect/5000 ms read in production versus 500 ms/1000 ms locally.
- **Backfill observability:** the timeout change fixed the observed zero-backfill symptom, but the client still only logs its final failure before returning zero. There is no metric or user-visible indication that reconciliation was skipped.
- **Platform documentation drift:** Render is not part of the live architecture. Any remaining Render references are historical setup material until rewritten for Railway.

---

## 13. Error Handling and Logging

- Controllers use validation annotations and service-specific global exception handlers to return structured HTTP errors.
- JWT filters reject invalid/expired tokens; frontend Axios handling clears unauthorized sessions.
- OTP errors distinguish invalid, expired, exhausted, cooldown, DNS-unavailable, and delivery failures where disclosure is safe.
- Forgot-password deliberately normalizes outward responses to prevent user enumeration.
- Kafka recoverers log source topic/partition/offset and DLT routing.
- Processed-event cleanup and duplicate suppression are logged.
- No centralized log aggregation, tracing, correlation-ID standard, metrics dashboard, or DLT alerting is configured.

Avoid logging JWTs, passwords, OTPs, SMTP credentials, or full password hashes. Live tests redact tokens and use hash fingerprints for evidence.

---

## 14. Source-of-Truth and Maintenance Rules

Use this precedence when documentation and behavior disagree:

1. Current source code and runtime configuration.
2. [`docs/api-contract.md`](./api-contract.md) for intended external API/event contracts.
3. [`docs/project-requirements.md`](./project-requirements.md) for product scope.
4. [`docs/ui-guidelines.md`](./ui-guidelines.md) for design guidance.
5. Historical plans/chat notes.

When behavior changes:

- Update the relevant contract/spec and this file in the same change.
- Record whether a known issue is open or resolved; do not delete important history silently.
- Keep old palette values explicitly labeled historical rather than presenting multiple token sets as active.
- Never include real credentials.
- Rebuild/recreate the changed Docker service and verify container start time before recording runtime results.
