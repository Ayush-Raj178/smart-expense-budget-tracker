[![CI](https://github.com/Ayush-Raj178/smart-expense-budget-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Ayush-Raj178/smart-expense-budget-tracker/actions/workflows/ci.yml)

# Smart Expense Budget Tracker

A full-stack expense and budget tracking application with a React frontend, four Spring Boot microservices, Kafka-based events, MySQL persistence, and OTP authentication.

## Project structure

- `frontend/` — React and Vite user interface
- `backend/` — user, expense, budget, and notification services
- `infra/` — Kubernetes and MySQL infrastructure definitions
- `docs/` — API contracts, requirements, and project context

Continuous integration runs the complete unit-test suite for every backend service, plus frontend lint and production-build verification, on every push and pull request to `main`.
