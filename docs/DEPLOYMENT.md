# Aiven + Render + Vercel deployment guide

This guide deploys one Aiven MySQL service, one Aiven Kafka service, four Render web services, and the Vite frontend on Vercel. Keep every password, JWT secret, and certificate value in the platform dashboards. Do not add real values to `.env.example` or any tracked file.

## 1. Create the Aiven MySQL service

1. In Aiven, open or create a project named `smart-expense-budget-tracker`.
2. Open **Services**, select **Create service**, and choose **MySQL**.
3. Select the **Free** service tier.
4. Free tier does not allow a specific cloud provider or cloud region. If the console offers a region group, choose the Asia/APAC option nearest Singapore. Aiven selects the actual provider and region.
5. Keep the default MySQL version and other free-tier settings. Do not add a VPC, integration, static IP, or paid feature.
6. Name the service `sebt-mysql` and create it.
7. Wait for the status to become **Running**.
8. Open the service's **Overview** page, then **Connect** > **Databases**. Create these four databases exactly:
   - `sebt_user_db`
   - `sebt_expense_db`
   - `sebt_budget_db`
   - `sebt_notification_db`
9. On **Overview**, open **Connection information** or **Quick connect** and record:
   - Host: the `*.aivencloud.com` hostname
   - Port: the assigned MySQL port, which is normally not `3306`
   - Username: normally `avnadmin`
   - Password: the generated service-user password
   - Default database: normally `defaultdb`; the application instead uses the four databases created above
   - Service URI/JDBC URI: useful for troubleshooting, but not required by the application's split environment variables
10. Download the **CA certificate** (`ca.pem`) from the same connection panel. Keep its entire PEM content, including the BEGIN/END lines. Each backend container turns this environment value into a temporary Java truststore at startup.
11. Run at least one real query soon after creation. A new free service with no initial use can be powered off within the first few hours.

The production JDBC mode in this guide is `VERIFY_IDENTITY`: traffic is encrypted, the certificate chain is verified against Aiven's CA, and the certificate hostname is checked. Aiven's basic Java quick-connect example uses the weaker `REQUIRED` mode, which encrypts traffic but does not verify the server identity.

## 2. Create the Aiven Kafka service

1. In the same Aiven project, open **Services**, select **Create service**, and choose **Aiven for Apache Kafka**.
2. Select the **Free** tier. An organization can have only one free Kafka service.
3. Choose the Asia/APAC region group nearest Singapore. The free plan manages the cloud provider automatically and does not allow a specific region.
4. Name the service `sebt-kafka`; keep the default Kafka version and fixed free-tier settings; create it and wait for **Running**.
5. On the service **Overview** page, click **Quick connect**, select **Java**, and choose **SASL**. New services have SASL enabled by default; use `SCRAM-SHA-256`.
6. Use `avnadmin` for this prototype. It already has permissions. Record:
   - Bootstrap host and SASL port, formatted for the app as `HOST:PORT` with no `https://` prefix
   - SASL username, normally `avnadmin`
   - SASL password
   - Security protocol `SASL_SSL`
   - SASL mechanism `SCRAM-SHA-256`
7. Download the **CA certificate** and retain its complete PEM content. SASL needs the CA certificate, but it does not need the client `service.cert` or `service.key` files used by mTLS.
8. In **Topics**, create these four topics:
   - `expense-events`
   - `budget-exceeded`
   - `expense-events.DLT`
   - `budget-exceeded.DLT`

The free Kafka plan permits up to five topics with two partitions each, so the four application/DLT topics fit. Do not enable Kafka Connect or other paid integrations.

## 3. Push the deployment-prep code to GitHub

Review and push the repository changes before creating Render services. The deployment-related files are:

- MySQL, Kafka, Render port, pool-size, and CORS variables:
  - `backend/user-service/src/main/resources/application.yml`
  - `backend/expense-service/src/main/resources/application.yml`
  - `backend/budget-service/src/main/resources/application.yml`
  - `backend/notification-service/src/main/resources/application.yml`
- Spring Security CORS configuration:
  - each service's `src/main/java/com/smartexpense/<service>/security/SecurityConfig.java`
- Render-compatible containers and PEM-to-Java-truststore startup:
  - each service's `Dockerfile`
  - each service's `docker-entrypoint.sh`
- Frontend backend-origin configuration:
  - `frontend/src/config/api.js`
  - all four files under `frontend/src/services/`
  - `frontend/.env.example`
  - `frontend/vercel.json`

The existing Vite dev proxy is intentionally retained. Blank `VITE_*_SERVICE_URL` values produce `/api/...` URLs locally, so `npm run dev` still proxies to ports 8081–8084. Vercel injects full Render origins at build time.

## 4. Prepare shared Render values

Before adding environment variables, prepare these values without saving them in the repository:

1. One cryptographically random JWT secret of at least 64 characters. Use the exact same value in all four services.
2. The MySQL host, port, username, password, and full MySQL `ca.pem` content from Aiven.
3. The Kafka `HOST:PORT`, username, password, and full Kafka CA PEM content from Aiven.
4. The live-demo OTP setting: `OTP_VERIFICATION_ENABLED=false`. This disables email-dependent verification only in Render; local Docker Compose defaults it to `true` and retains the complete email/OTP implementation.
5. Use `https://placeholder.invalid` as the temporary CORS origin. Replace it in all four Render services after Vercel assigns the production origin.

Do not set `PORT`; Render supplies it automatically and each service now reads it.

## 5. Create the Render user service

1. In Render, select **New** > **Web Service**, choose the GitHub repository, and connect it.
2. Enter:
   - Name: `sebt-user-service`
   - Region: **Singapore**
   - Branch: the production branch, normally `main`
   - Root Directory: `backend/user-service`
   - Runtime/Language: **Docker**
   - Dockerfile Path: `./Dockerfile`
   - Docker Build Context: `.`
   - Instance type: **Free**
   - Health Check Path: `/actuator/health`
   - Auto-deploy: enabled
3. Add these environment variables:
   - `DB_HOST` = Aiven MySQL host
   - `DB_PORT` = Aiven MySQL port
   - `DB_NAME` = `sebt_user_db`
   - `DB_USERNAME` = Aiven MySQL username, normally `avnadmin`
   - `DB_PASSWORD` = Aiven MySQL password
   - `DB_SSL_MODE` = `VERIFY_IDENTITY`
   - `DB_ALLOW_PUBLIC_KEY_RETRIEVAL` = `false`
   - `DB_CA_CERTIFICATE` = complete Aiven MySQL `ca.pem` content
   - `DB_MAX_POOL_SIZE` = `5`
   - `DB_MIN_IDLE` = `0`
   - `JWT_SECRET` = the shared random JWT secret
   - `JWT_EXPIRATION_MS` = `86400000`
   - `OTP_VERIFICATION_ENABLED` = `false`
   - `OTP_EXPIRY_MINUTES` = `10`
   - `OTP_RESEND_COOLDOWN_SECONDS` = `60`
   - `OTP_MAX_ATTEMPTS` = `5`
   - `CORS_ALLOWED_ORIGINS` = `https://placeholder.invalid`
   - `JAVA_TOOL_OPTIONS` = `-XX:MaxRAMPercentage=75.0`
4. Create the service, keep Aiven MySQL powered on, and wait for a successful health check.
5. Copy the exact HTTPS `onrender.com` URL assigned by Render.

## 6. Create the Render expense service

Use the same Render creation fields, with:

- Name: `sebt-expense-service`
- Root Directory: `backend/expense-service`
- Region: Singapore
- Runtime: Docker
- Dockerfile Path: `./Dockerfile`
- Docker Build Context: `.`
- Instance type: Free
- Health Check Path: `/actuator/health`

Set:

- `DB_HOST` = Aiven MySQL host
- `DB_PORT` = Aiven MySQL port
- `DB_NAME` = `sebt_expense_db`
- `DB_USERNAME` = Aiven MySQL username
- `DB_PASSWORD` = Aiven MySQL password
- `DB_SSL_MODE` = `VERIFY_IDENTITY`
- `DB_ALLOW_PUBLIC_KEY_RETRIEVAL` = `false`
- `DB_CA_CERTIFICATE` = complete Aiven MySQL CA PEM
- `DB_MAX_POOL_SIZE` = `5`
- `DB_MIN_IDLE` = `0`
- `JWT_SECRET` = the same shared JWT secret
- `KAFKA_BOOTSTRAP_SERVERS` = Aiven Kafka `HOST:PORT`
- `KAFKA_SECURITY_PROTOCOL` = `SASL_SSL`
- `KAFKA_SASL_MECHANISM` = `SCRAM-SHA-256`
- `KAFKA_USERNAME` = Aiven Kafka SASL username
- `KAFKA_PASSWORD` = Aiven Kafka SASL password
- `KAFKA_CA_CERTIFICATE` = complete Aiven Kafka CA PEM
- `KAFKA_SSL_TRUSTSTORE_TYPE` = `PEM`
- `KAFKA_SSL_ENDPOINT_IDENTIFICATION_ALGORITHM` = `https`
- `KAFKA_EXPENSE_TOPIC` = `expense-events`
- `ADMIN_REPUBLISH_EVENTS_ENABLED` = `false`
- `CORS_ALLOWED_ORIGINS` = `https://placeholder.invalid`
- `JAVA_TOOL_OPTIONS` = `-XX:MaxRAMPercentage=75.0`

Create the service and copy its assigned HTTPS URL. This URL is needed by the budget service and Vercel.

## 7. Create the Render budget service

Use:

- Name: `sebt-budget-service`
- Root Directory: `backend/budget-service`
- Region: Singapore
- Runtime: Docker
- Dockerfile Path: `./Dockerfile`
- Docker Build Context: `.`
- Instance type: Free
- Health Check Path: `/actuator/health`

Set:

- `DB_HOST` = Aiven MySQL host
- `DB_PORT` = Aiven MySQL port
- `DB_NAME` = `sebt_budget_db`
- `DB_USERNAME` = Aiven MySQL username
- `DB_PASSWORD` = Aiven MySQL password
- `DB_SSL_MODE` = `VERIFY_IDENTITY`
- `DB_ALLOW_PUBLIC_KEY_RETRIEVAL` = `false`
- `DB_CA_CERTIFICATE` = complete Aiven MySQL CA PEM
- `DB_MAX_POOL_SIZE` = `5`
- `DB_MIN_IDLE` = `0`
- `JWT_SECRET` = the same shared JWT secret
- `KAFKA_BOOTSTRAP_SERVERS` = Aiven Kafka `HOST:PORT`
- `KAFKA_SECURITY_PROTOCOL` = `SASL_SSL`
- `KAFKA_SASL_MECHANISM` = `SCRAM-SHA-256`
- `KAFKA_USERNAME` = Aiven Kafka SASL username
- `KAFKA_PASSWORD` = Aiven Kafka SASL password
- `KAFKA_CA_CERTIFICATE` = complete Aiven Kafka CA PEM
- `KAFKA_SSL_TRUSTSTORE_TYPE` = `PEM`
- `KAFKA_SSL_ENDPOINT_IDENTIFICATION_ALGORITHM` = `https`
- `KAFKA_EXPENSE_TOPIC` = `expense-events`
- `KAFKA_BUDGET_EXCEEDED_TOPIC` = `budget-exceeded`
- `KAFKA_CONSUMER_GROUP` = `budget-service-group`
- `BUDGET_ALERT_THRESHOLD` = `80`
- `EXPENSE_SERVICE_URL` = exact HTTPS URL of `sebt-expense-service`, with no trailing slash
- `EXPENSE_SERVICE_CONNECT_TIMEOUT_MS` = `500`
- `EXPENSE_SERVICE_READ_TIMEOUT_MS` = `1000`
- `CORS_ALLOWED_ORIGINS` = `https://placeholder.invalid`
- `JAVA_TOOL_OPTIONS` = `-XX:MaxRAMPercentage=75.0`

Render Free web services cannot receive private-network traffic, so `EXPENSE_SERVICE_URL` must be the public HTTPS Render URL.

## 8. Create the Render notification service

Use:

- Name: `sebt-notification-service`
- Root Directory: `backend/notification-service`
- Region: Singapore
- Runtime: Docker
- Dockerfile Path: `./Dockerfile`
- Docker Build Context: `.`
- Instance type: Free
- Health Check Path: `/actuator/health`

Set:

- `DB_HOST` = Aiven MySQL host
- `DB_PORT` = Aiven MySQL port
- `DB_NAME` = `sebt_notification_db`
- `DB_USERNAME` = Aiven MySQL username
- `DB_PASSWORD` = Aiven MySQL password
- `DB_SSL_MODE` = `VERIFY_IDENTITY`
- `DB_ALLOW_PUBLIC_KEY_RETRIEVAL` = `false`
- `DB_CA_CERTIFICATE` = complete Aiven MySQL CA PEM
- `DB_MAX_POOL_SIZE` = `5`
- `DB_MIN_IDLE` = `0`
- `JWT_SECRET` = the same shared JWT secret
- `KAFKA_BOOTSTRAP_SERVERS` = Aiven Kafka `HOST:PORT`
- `KAFKA_SECURITY_PROTOCOL` = `SASL_SSL`
- `KAFKA_SASL_MECHANISM` = `SCRAM-SHA-256`
- `KAFKA_USERNAME` = Aiven Kafka SASL username
- `KAFKA_PASSWORD` = Aiven Kafka SASL password
- `KAFKA_CA_CERTIFICATE` = complete Aiven Kafka CA PEM
- `KAFKA_SSL_TRUSTSTORE_TYPE` = `PEM`
- `KAFKA_SSL_ENDPOINT_IDENTIFICATION_ALGORITHM` = `https`
- `KAFKA_BUDGET_EXCEEDED_TOPIC` = `budget-exceeded`
- `KAFKA_CONSUMER_GROUP` = `notification-service-group`
- `BUDGET_ALERT_THRESHOLD` = `80`
- `CORS_ALLOWED_ORIGINS` = `https://placeholder.invalid`
- `JAVA_TOOL_OPTIONS` = `-XX:MaxRAMPercentage=75.0`

Create the service and copy its exact HTTPS URL.

## 9. Configure and deploy Vercel

1. Open the detected GitHub repository in Vercel and configure the project:
   - Framework Preset: **Vite**
   - Root Directory: `frontend`
   - Install Command: `npm install` or the Vercel-detected default
   - Build Command: `npm run build`
   - Output Directory: `dist`
2. Add these Vercel environment variables for Production. Also add them for Preview if preview deployments should call the production Render backends:
   - `VITE_USER_SERVICE_URL` = exact HTTPS Render user-service origin
   - `VITE_EXPENSE_SERVICE_URL` = exact HTTPS Render expense-service origin
   - `VITE_BUDGET_SERVICE_URL` = exact HTTPS Render budget-service origin
   - `VITE_NOTIFICATION_SERVICE_URL` = exact HTTPS Render notification-service origin
3. Each value is an origin only, with no `/api` suffix and preferably no trailing slash. Example shape: `https://sebt-user-service.onrender.com`.
4. Deploy. `frontend/vercel.json` rewrites browser routes to `index.html`, so refreshing a React route does not return a 404.
5. Copy the exact stable production origin Vercel assigns, such as `https://PROJECT.vercel.app`. Do not use a deployment-specific preview URL for production CORS.
6. In all four Render services, replace `CORS_ALLOWED_ORIGINS=https://placeholder.invalid` with the exact Vercel production origin, with no trailing slash. Saving an environment change triggers a redeploy.
7. If more than one exact origin is needed, use a comma-separated value, for example `https://production.example,https://specific-preview.vercel.app`. The code deliberately does not permit a broad `*.vercel.app` wildcard.

Vite environment values are compiled into the static browser bundle. Any later URL change requires a new Vercel deployment. These four URL values are public configuration, not secrets.

## 10. Smoke-test in dependency order

1. Confirm both Aiven services say **Running**.
2. Open each Render `/actuator/health` endpoint. A cold Free service can take about a minute to wake.
3. Open the Vercel app and sign up with a valid name, email, and password. In the live deployment, it creates the account and signs in directly with no OTP screen or email. Password reset and profile email changes display a clear demo-unavailable message.
4. Log in, create a budget, and create an expense.
5. Confirm `expense-events` has produced/consumed activity in Aiven.
6. Create an expense that crosses the configured budget threshold, then open Notifications. Because Render Free services sleep independently, opening the budget and notifications views might be needed to wake their consumers and process queued Kafka records.
7. In the browser developer tools, verify requests go directly to the four HTTPS Render origins and have no CORS errors.

## 11. Daily keep-alive checklist

Perform this with a margin before 24 hours has elapsed; for example, once every 20–23 hours:

1. In Aiven, power on MySQL or Kafka if either is already off.
2. Open the deployed app, log in, and load Expenses or Dashboard. This causes real MySQL queries; merely viewing the Aiven dashboard is not database activity.
3. Create a small temporary expense, wait until it appears, and then delete it if desired. The create/delete writes MySQL rows and produces real Kafka records. Producing a record is enough Kafka activity; the budget consumer will also consume it when awake.
4. Check Aiven Kafka metrics or topic activity to confirm a record was produced or consumed.

Kafka's documented trigger is exact: no data produced or consumed for 24 hours powers off the free service. Broker connections, metadata requests, or an empty consumer poll should not be treated as a substitute for a real message.

MySQL is different: Aiven documents shutdown after "no continuative activity" and does not publish an exact inactivity duration. Therefore no public source can guarantee that one query exactly once per 24 hours is sufficient. A daily real application query is the minimum practical action, but watch the pre-shutdown notification and power the service back on if needed.

## Free-tier operational limits to expect

- Aiven Free services are for learning, prototypes, and small workloads and have no SLA.
- Kafka Free permits five topics and powers off after 24 hours without produce/consume activity.
- MySQL Free has 1 GB storage, 1 GB RAM, and 76 maximum connections. Each app pool is capped at five, for at most 20 pooled connections across the four single-instance services.
- Render Free web services sleep after 15 minutes without inbound traffic and can take about a minute to wake.
- Render currently grants 750 Free instance hours per workspace per month. Four services cannot all remain continuously awake for a full month within that shared allowance.
- Render Free web services cannot make outbound connections on SMTP ports 25, 465, or 587. Set `OTP_VERIFICATION_ENABLED=false` for `sebt-user-service`; the live demo then creates accounts directly and disables password reset and email changes with clear messages. Docker Compose defaults this setting to `true`, so its full SMTP/OTP flow remains implemented and testable locally.
- Sleeping Render services do not consume Kafka until they wake. Kafka retains the records, and the consumers resume from their committed offsets.

## Primary documentation

- Aiven MySQL free tier: https://aiven.io/docs/products/mysql/concepts/mysql-free-tier
- Aiven MySQL Java connection: https://aiven.io/docs/products/mysql/howto/connect-with-java
- Aiven Kafka free-tier creation and 24-hour rule: https://aiven.io/docs/products/kafka/free-tier/create-free-tier-kafka-service
- Aiven Kafka Java/SASL connection: https://aiven.io/docs/products/kafka/howto/connect-with-java
- Render Docker web services: https://render.com/docs/web-services
- Render monorepos: https://render.com/docs/monorepo-support
- Render Free limits: https://render.com/docs/free
- Vercel builds: https://vercel.com/docs/builds
- Vercel rewrites: https://vercel.com/docs/routing/rewrites
- Vercel Hobby plan and limits: https://vercel.com/docs/plans/hobby
