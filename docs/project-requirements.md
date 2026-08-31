Smart Expense & Budget Tracker — Project Requirements

1. Project Overview

Smart Expense & Budget Tracker is a full-stack personal finance application for
tracking expenses, managing budgets, and receiving spending notifications. The
system consists of a React frontend and Spring Boot microservices backend,
communicating via REST and Kafka events.

2. Tech Stack

Frontend


React, React Router
Chart library for dashboard analytics (e.g. Recharts)
Axios for API calls


Backend


Java Spring Boot microservices: user-service, expense-service, budget-service,
notification-service
Database: MySQL — one database per service (database-per-service pattern)
Kafka for event-driven notifications
Docker (per-service Dockerfile + docker-compose for local dev)
Kubernetes (manifests in /infra for deployment)
JUnit + Mockito for testing
CI/CD (GitHub Actions, added once services are stable)


3. Main Features

3.1 Authentication and User Management

Signup, login, secure authentication (JWT), fetch current user profile

3.2 Expense Management

Add expense, view expense list, filter by category/date (later), edit/delete (later)

3.3 Budget Management

Create/update a monthly budget **per category** (e.g. Food, Travel), view all
category budgets for a month, compare `currentSpent` vs `monthlyLimit` per category

3.4 Dashboard

Total expenses, budget usage summary, category-wise distribution, monthly
trends, notifications/alerts

3.5 Notifications

Alert when budget threshold crossed (via Kafka event from budget-service),
visible in UI

4. Service Boundaries & Databases

| Service | Responsibility | Database |
|---------|---------------|----------|
| user-service | signup, login, JWT issuance, profile | sebt_user_db (MySQL) |
| expense-service | add/get/update/delete expenses | sebt_expense_db (MySQL) |
| budget-service | per-category monthly budgets, spending tracking, threshold alerts | sebt_budget_db (MySQL) |
| notification-service | consume Kafka events, store & expose notifications | sebt_notification_db (MySQL) |

5. Event Flow (Kafka)


expense-service publishes ExpenseAdded event after an expense is saved
(topic: expense-events)
budget-service consumes ExpenseAdded, finds the matching per-category budget
(by userId + category + month), increments currentSpent
If threshold crossed (default 80%), budget-service publishes BudgetExceeded event
(topic: budget-exceeded)
notification-service consumes BudgetExceeded, creates a notification record


Each service still exposes its own REST APIs per api-contract.md — Kafka is
additional, not a replacement for the documented REST endpoints.

6. Security Rules (important)


All endpoints except signup/login require Authorization: Bearer <token>
userId must NEVER be trusted from the request body — always derive it from
the validated JWT on the backend
Passwords hashed with BCrypt in user-service, never returned in any response


7. Frontend Screens

Login, Signup, Dashboard, Add Expense form/modal, Budget summary section,
Notifications panel

8. Core Frontend Requirements

Clean modular React code, reusable components, separate service/API layer,
loading/error states, form validation, responsive dashboard, charts

9. Core Backend Requirements

Controller-service-repository structure, input validation, standard API
response shape, proper exception handling, env vars for config, unit tests for
business logic (JUnit + Mockito)

10. Infrastructure Expectations


Each service has its own Dockerfile
infra/docker-compose.yml spins up all 4 services + Kafka + Zookeeper + MySQL
(one MySQL container with 4 databases is fine for local dev)
infra/k8s/ contains basic deployment.yaml + service.yaml per service, for
minikube deployment
CI/CD (GitHub Actions) added after core services + Docker setup are working


11. Build Order (build one thing at a time — do not ask an agent to build

everything in a single task)


user-service (REST + MySQL + JWT)
expense-service (REST + MySQL, publishes ExpenseAdded to Kafka)
budget-service (REST + MySQL, consumes ExpenseAdded, publishes BudgetExceeded)
notification-service (REST + MySQL, consumes BudgetExceeded)
Dockerize each service + docker-compose for local dev
Frontend: Login, Signup, Add Expense, Dashboard, Notifications
Kubernetes manifests in /infra/k8s
CI/CD pipeline


12. Non-Goals for Initial Version

Advanced analytics, complex role management, full production hardening,
advanced reporting