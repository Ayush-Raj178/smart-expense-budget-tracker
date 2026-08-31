-- Creates one database per microservice (database-per-service pattern).
-- Runs once on first MySQL container startup when the data volume is empty.

CREATE DATABASE IF NOT EXISTS sebt_user_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS sebt_expense_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS sebt_budget_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS sebt_notification_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
