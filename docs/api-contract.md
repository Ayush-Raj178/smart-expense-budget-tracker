# Smart Expense & Budget Tracker — API Contract

Response fields are indicative; keep field names consistent once implemented.
All endpoints marked 🔒 require header: `Authorization: Bearer <token>`

---
# 1. user-service (base: /api)

## 1.1 Start signup and send verification code
POST `/api/auth/signup`
Request:
```json
{ "name": "Ayu", "email": "ayu@example.com", "password": "secret123" }
```
The email must be syntactically valid, have at least one usable MX record, and
not already be registered. Domains with no MX records or an RFC null-MX record
are rejected before an OTP is generated or sent. The account is not created at
this stage. A six-digit code is stored only as a BCrypt hash and
expires after 10 minutes. Success (202):
```json
{
  "message": "Verification code sent",
  "email": "ayu@example.com",
  "expiresInSeconds": 600,
  "resendAvailableInSeconds": 60
}
```
Error (409):
```json
{ "message": "Email already exists" }
```
Error — domain does not accept mail (400):
```json
{ "message": "This email domain doesn't appear to accept mail. Please check the address." }
```
DNS lookup or synchronous SMTP delivery failures return 503. A successful SMTP
handoff cannot prove that a specific mailbox exists; mailbox-level rejection may
arrive later as an asynchronous bounce.

## 1.2 Verify signup code
POST `/api/auth/signup/verify`
Request:
```json
{ "email": "ayu@example.com", "otp": "123456" }
```
Only a valid, unexpired code creates the user. Success (201):
```json
{
  "message": "Account verified and created",
  "token": "jwt-token",
  "user": { "id": 1, "name": "Ayu", "email": "ayu@example.com", "phoneNumber": null }
}
```

## 1.3 Resend signup code
POST `/api/auth/signup/resend`
Request:
```json
{ "email": "ayu@example.com" }
```
Resends only for an active signup challenge and replaces the previous code. A
60-second cooldown applies. Rate-limit responses use status 429 and include a
`Retry-After` header.

## 1.4 Request password reset
POST `/api/auth/forgot-password`
Request:
```json
{ "email": "ayu@example.com" }
```
The service validates the domain's MX records for every request. It creates a
hashed, 10-minute `PASSWORD_RESET` challenge and sends an email only when the
address belongs to a registered account. Unknown addresses, domains that do not
accept mail, active 60-second cooldowns, and synchronous mail-delivery failures
all return the same enumeration-safe response (202):
```json
{
  "message": "If this email is registered, a code has been sent",
  "email": "ayu@example.com",
  "expiresInSeconds": 600,
  "resendAvailableInSeconds": 60
}
```
The response must not disclose whether the account or challenge exists.

## 1.5 Verify password-reset code
POST `/api/auth/forgot-password/verify`
Request:
```json
{ "email": "ayu@example.com", "otp": "123456" }
```
A valid, unexpired code returns 200 without changing the password or consuming
the challenge:
```json
{ "message": "Verification code confirmed" }
```
Invalid codes consume an attempt from the same five-attempt limit. This endpoint
only supports the two-step user experience; the final reset request always
revalidates the code, so client-side verified state is not trusted.

## 1.6 Reset password
POST `/api/auth/reset-password`
Request:
```json
{ "email": "ayu@example.com", "otp": "123456", "newPassword": "new-secret123" }
```
The password must contain at least eight characters, matching signup. A valid,
unexpired code updates the BCrypt password hash and deletes the challenge in the
same transaction. The code cannot be reused. Success (200):
```json
{ "message": "Password reset successfully. You can now sign in." }
```
Existing stateless JWTs are not revoked by this operation and remain valid until
their normal expiry. Immediate all-device sign-out would require a persisted token
version or revocation check on authenticated requests.

## 1.7 Login
POST `/api/auth/login`
Request:
```json
{ "email": "ayu@example.com", "password": "secret123" }
```
Success (200):
```json
{ "message": "Login successful", "token": "jwt-token", "user": { "id": 1, "name": "Ayu", "email": "ayu@example.com", "phoneNumber": null } }
```
Error (401):
```json
{ "message": "Invalid credentials" }
```

Existing verified accounts continue to use this endpoint without an OTP step.

## 1.8 Current user profile 🔒
GET `/api/users/me`
Success (200):
```json
{ "id": 1, "name": "Ayu", "email": "ayu@example.com", "phoneNumber": "+91 9876543210" }
```

## 1.9 Update name and phone 🔒
PUT `/api/users/me`
Request:
```json
{ "name": "Ayush Raj", "phoneNumber": "+91 9876543210" }
```
Name and phone are updated directly; this endpoint cannot change email.
`phoneNumber` is nullable. Phone ownership is **not verified yet** because the
application has no SMS provider; production phone verification requires a
service such as Twilio and remains an explicit security gap.

## 1.10 Start email change 🔒
POST `/api/users/me/email/request`
Request:
```json
{ "newEmail": "new-address@example.com" }
```
The address must not belong to another user and its domain must have a usable MX
record. A six-digit code is sent to the new address and the current email remains
unchanged. The same 60-second resend
cooldown applies to repeated calls.

## 1.11 Verify email change 🔒
POST `/api/users/me/email/verify`
Request:
```json
{ "newEmail": "new-address@example.com", "otp": "123456" }
```
Success returns the updated user and a replacement JWT whose email claim matches
the new address. The user id/JWT subject does not change.

---
# 2. expense-service (base: /api) — all endpoints 🔒

## 2.1 Add expense 🔒
POST `/api/expenses`
Request (note: NO userId field — backend derives it from the JWT):
```json
{ "amount": 1200, "category": "Food", "description": "Dinner", "date": "2026-07-05" }
```
Success (201):
```json
{ "message": "Expense added successfully", "expenseId": 101 }
```
This creates a transactional outbox entry for a Kafka `ExpenseAdded` event internally
(expenseId, userId, amount, category, date). The event is normally published to topic
`expense-events` by the outbox poller within one two-second poll cycle.

Updating an expense triggers an `ExpenseUpdated` event on the same topic with both
the original and replacement budget dimensions:
`{ expenseId, userId, oldAmount, oldCategory, oldDate, newAmount, newCategory, newDate }`.
The `oldDate` and `newDate` fields are ISO dates; budget-service derives each
`yyyy-MM` month from them independently.

Expense create, update, delete, and the development republish helper do not call Kafka
inline. Their `outbox_events` insert is committed in the same local MySQL transaction
as the expense operation. This intentionally adds a small delivery delay; the API and
downstream budget projection already use eventual consistency.

## 2.2 Get expenses for logged-in user 🔒
GET `/api/expenses`
(userId comes from the token, not a query param)
Success (200):
```json
[ { "id": 101, "userId": 1, "amount": 1200, "category": "Food", "description": "Dinner", "date": "2026-07-05" } ]
```

## 2.3 Get expense summary for budget backfill (internal) 🔒
GET `/api/expenses/summary?category=Food&month=2026-07`

This internal service-to-service endpoint uses the caller's forwarded JWT and
therefore sums expenses only for the authenticated user. It matches the category
case-insensitively and includes expense dates within the requested calendar month.
Success (200):
```json
{ "totalAmount": 3200 }
```

Budget-service calls this endpoint only when it creates a new category/month
budget; normal budget reads and repeat POSTs do not call it.

---
# 3. budget-service (base: /api) — all endpoints 🔒

Budgets are **per category per month** — one record per `(userId, category, month)`.
The `currentSpent` field is updated internally when expenses are added (via Kafka).

## 3.1 Create or increase budget 🔒
POST `/api/budgets`
Creates a new category budget. If one already exists for the same
`(userId, category, month)`, the submitted `monthlyLimit` is **added** to the
existing limit instead of replacing it. For example, submitting `500` for an
existing `500` limit produces a new limit of `1000`.

For a new budget, budget-service synchronously queries expense-service and
initializes `currentSpent` to the sum of existing expenses for the authenticated
user, category, and month. A repeat POST keeps that backfilled/event-maintained
`currentSpent` unchanged while adding only to `monthlyLimit`, so historical
expenses are not counted twice.

The expense summary lookup has short connect/read timeouts and is retried once.
If expense-service is still unavailable, budget creation succeeds with
`currentSpent = 0` and budget-service logs a warning. This is a known availability
fallback: historical spending remains understated unless the budget is deleted
and recreated after recovery or a future reconciliation mechanism corrects it.
Later expense events update only their own amounts; they do not recover the missed
historical backfill.

Request (no userId in body):
```json
{ "category": "Food", "monthlyLimit": 5000, "month": "2026-07" }
```
`category` may be one of the frontend presets or a custom, non-blank name up to
100 characters. Custom categories use the frontend's centralized `Other` icon
and neutral badge fallback; the API stores the submitted category name.
Success — new budget (200):
```json
{
  "message": "Budget created",
  "budgetId": 1,
  "created": true,
  "budget": { "id": 1, "userId": 1, "category": "Food", "monthlyLimit": 5000, "currentSpent": 3200, "month": "2026-07" }
}
```
Success — existing category + month (200):
```json
{
  "message": "Budget limit increased to ₹10000",
  "budgetId": 1,
  "created": false,
  "budget": { "id": 1, "userId": 1, "category": "Food", "monthlyLimit": 10000, "currentSpent": 3200, "month": "2026-07" }
}
```

## 3.2 List budgets for logged-in user 🔒
GET `/api/budgets?month=2026-07`
(userId comes from the token; `month` query param is optional — omit to list all months)
Success (200):
```json
[
  {
    "id": 1,
    "userId": 1,
    "category": "Food",
    "monthlyLimit": 5000,
    "currentSpent": 3200,
    "month": "2026-07"
  },
  {
    "id": 2,
    "userId": 1,
    "category": "Travel",
    "monthlyLimit": 3000,
    "currentSpent": 1500,
    "month": "2026-07"
  }
]
```

## 3.3 Get budget by id 🔒
GET `/api/budgets/{id}`
(userId comes from the token; returns 404 if budget does not belong to user)
Success (200):
```json
{ "id": 1, "userId": 1, "category": "Food", "monthlyLimit": 5000, "currentSpent": 3200, "month": "2026-07" }
```

## 3.4 Update budget limit 🔒
PUT `/api/budgets/{id}`
Unlike POST, this explicit edit operation replaces the limit with the exact
submitted `monthlyLimit` value.
Request:
```json
{ "monthlyLimit": 6000 }
```
Success (200):
```json
{ "id": 1, "userId": 1, "category": "Food", "monthlyLimit": 6000, "currentSpent": 3200, "month": "2026-07" }
```

### Kafka (internal)
- Consumes `ExpenseAdded` events from topic `expense-events`
- Consumes `ExpenseUpdated` events and either applies the amount difference to one
  unchanged budget or moves spending between the old and new category/month budgets
  in one transaction. A missing budget on either side is skipped independently.
- Finds matching budget by `userId + category + month` (month derived from expense date)
- Increments `currentSpent` by the expense amount
- When `currentSpent` crosses the alert threshold (default 80% of `monthlyLimit`),
  writes a `BudgetExceeded` outbox event in the same transaction as the budget update.
  The outbox poller publishes it to topic `budget-exceeded`:
  `{ userId, category, monthlyLimit, currentSpent, month }`
- Alert is published **once** when the threshold is first crossed, not on every
  subsequent expense

### Transactional outbox (internal)

expense-service and budget-service each own an `outbox_events` table in their own
schema. Rows contain `id`, `aggregate_id`, `event_type`, JSON `payload`, `created_at`,
nullable `published_at`, and `status` (`PENDING`, `PUBLISHED`, or `FAILED`), plus retry
metadata (`attempt_count`, `next_attempt_at`, and `last_error`).

Each poller claims ready `PENDING` rows, sends the typed event with the user ID as the
Kafka key, waits for the broker acknowledgment, and only then marks the row
`PUBLISHED`. A failed send stays `PENDING` with exponential backoff. After five failed
attempts it is marked `FAILED` and logged at error level for operational alerting.
Delivery is at-least-once across a crash after broker acknowledgment; consumers use
the event UUID for deduplication.

---
# 4. notification-service (base: /api) — all endpoints 🔒

## 4.1 Get notifications 🔒
GET `/api/notifications`
(userId comes from token)
Success (200):
```json
[
  {
    "id": 1,
    "userId": 1,
    "category": "Food",
    "message": "You have crossed 80% of your Food budget for July 2026. Current spending: ₹4000 of ₹5000.",
    "month": "2026-07",
    "isRead": false,
    "createdAt": "2026-07-05T10:30:00"
  }
]
```

## 4.2 Mark notification as read 🔒
PUT `/api/notifications/{id}/read`
(userId comes from token; returns 404 if notification does not belong to user)
Success (200):
```json
{ "message": "Notification marked as read" }
```

## 4.3 Delete notification 🔒
DELETE `/api/notifications/{id}`
(userId comes from token; returns 404 if notification does not belong to user)
Success (200):
```json
{ "message": "Notification deleted successfully" }
```

### Kafka (internal)
- Consumes `BudgetExceeded` events from topic `budget-exceeded`
- Creates a notification record with per-category message format:
  "You have crossed 80% of your {category} budget for {month}. Current spending: ₹{currentSpent} of ₹{monthlyLimit}."
- Fields: `userId`, `category`, `message`, `month`, `isRead` (default false), `createdAt`

---
# 5. Frontend integration rules
- Keep all API calls in a service layer (`/frontend/src/services`), one file per
  backend service
- Never hardcode backend base URLs inside components — use a config/env file
- After login, store the JWT (e.g. in memory / context) and attach it as
  `Authorization: Bearer <token>` on every 🔒 request
- Show loading and error states for every request
- Backend response shapes should stay consistent (`message` field present on
  writes, arrays on list reads) — if a backend agent changes a shape, update
  this file too

# 6. Standard error shape (all services)
```json
{ "message": "Human readable message" }
```
