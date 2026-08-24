# KARIGOR

### A Service Marketplace Platform Connecting Customers with Verified Service Workers

KARIGOR is a full-stack service marketplace platform designed to connect customers who need local services with skilled service workers such as electricians, plumbers, carpenters, mechanics, AC technicians, painters, and other professionals.

The platform is designed around a complete service-request lifecycle:

**Service Discovery → Service Request → Worker Matching → Quotation → Negotiation → Booking → Service Completion → Review**

The project is being developed as an undergraduate software engineering project using a modern, modular full-stack architecture.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Core Problem](#core-problem)
- [Project Goals](#project-goals)
- [Key Features](#key-features)
- [User Roles](#user-roles)
- [Core Workflow](#core-workflow)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Database Architecture](#database-architecture)
- [Database-First Development](#database-first-development)
- [Core Database Entities](#core-database-entities)
- [Project Structure](#project-structure)
- [Development Roadmap](#development-roadmap)
- [Milestones](#milestones)
- [Security](#security)
- [External Services](#external-services)
- [Development Environment](#development-environment)
- [Getting Started](#getting-started)
- [Database Setup](#database-setup)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Environment Variables and Secrets](#environment-variables-and-secrets)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Deployment Plan](#deployment-plan)
- [Project Status](#project-status)
- [Team](#team)
- [Academic Project](#academic-project)
- [License](#license)

---

# Project Overview

KARIGOR is a service marketplace intended to make it easier for customers to find and hire skilled service workers.

Traditional service hiring often depends on personal contacts, local advertisements, or informal recommendations. This makes it difficult for customers to:

- Find suitable workers
- Compare available workers
- Evaluate worker credibility
- Describe service requirements
- Receive and compare quotations
- Negotiate prices
- Track bookings
- Communicate with workers
- Leave feedback after completing a service

KARIGOR aims to provide these capabilities through a centralized web platform.

The system supports two primary service-side users:

- **Customers** — users who request services
- **Workers** — professionals who provide services

An **Administrator** role provides platform-level management and oversight.

---

# Core Problem

The platform addresses several problems in traditional local service hiring:

1. Difficulty finding reliable service providers.
2. Lack of centralized worker information.
3. Limited ability to compare workers.
4. Informal quotation and negotiation processes.
5. Lack of structured booking management.
6. Lack of transparent reviews and ratings.
7. Difficulty communicating with workers.
8. Limited location-aware service discovery.
9. Lack of centralized administrative oversight.

KARIGOR brings these processes together into a single platform.

---

# Project Goals

The primary goals of KARIGOR are:

- Provide customers with a centralized service marketplace.
- Allow workers to create professional service profiles.
- Allow workers to list their skills and service categories.
- Allow customers to submit service requests.
- Allow workers to submit quotations.
- Support quotation negotiation and counter-offers.
- Support booking management.
- Provide location-based worker discovery.
- Provide real-time communication.
- Provide notifications for important events.
- Provide reviews and ratings.
- Provide administrative moderation and verification.
- Maintain strong database integrity through a Database-First architecture.
- Build a maintainable and extensible full-stack application.

---

# Key Features

## Customer Features

Planned customer capabilities include:

- Customer registration and login
- Customer profile management
- Service category browsing
- Worker discovery
- Worker profile viewing
- Location-aware worker search
- Service request creation
- Uploading service-related images
- Receiving worker quotations
- Comparing quotations
- Negotiating quotations
- Accepting quotations
- Booking services
- Viewing booking history
- Messaging workers
- Receiving notifications
- Reviewing completed services
- Rating workers

---

## Worker Features

Planned worker capabilities include:

- Worker registration and login
- Worker profile management
- Skill/category selection
- Service area configuration
- Hourly/service pricing
- Availability management
- Document submission
- Verification status
- Receiving service requests
- Submitting quotations
- Negotiating quotations
- Managing bookings
- Messaging customers
- Receiving notifications
- Viewing ratings and reviews
- Responding to customer reviews

---

## Administrator Features

Planned administrator capabilities include:

- Administrator authentication
- User management
- Worker verification
- Worker document review
- Service category management
- User moderation
- Review moderation
- Platform monitoring
- Administrative dashboards
- System-level oversight

---

# Core Workflow

The primary business workflow is designed around the following lifecycle:

```text
                    ┌───────────────────┐
                    │     Customer      │
                    └─────────┬─────────┘
                              │
                              ▼
                    Browse Service Category
                              │
                              ▼
                    Create Service Request
                              │
                              ▼
                    ┌───────────────────┐
                    │ Worker Discovery  │
                    │ / Matching        │
                    └─────────┬─────────┘
                              │
                              ▼
                    Workers Submit Quotes
                              │
                              ▼
                    ┌───────────────────┐
                    │   Negotiation     │
                    │ / Counter Offers  │
                    └─────────┬─────────┘
                              │
                              ▼
                       Quote Accepted
                              │
                              ▼
                           Booking
                              │
                              ▼
                       Service Complete
                              │
                              ▼
                      Review & Rating




---
# Karigor — First-Time Setup Guide

This guide walks you through setting up the Karigor project from a fresh clone, including database creation, backend build, JWT secrets, and frontend start.

---

## 📋 Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **.NET SDK** | 10.0 or later | `dotnet --version` to check |
| **SQL Server** | Express or Developer | Local instance (e.g., `.\SQLEXPRESS`) |
| **Node.js** | 18.x or later | `node --version` to check |
| **Git** | Any | For cloning the repository |

---

## 1. Clone the Repository

```bash
git clone https://github.com/ShadmanMuhtasim/Karigor.git
cd Karigor
```

---

## 2. Restore and Build the Backend

```bash
dotnet restore Karigor.slnx
dotnet build Karigor.slnx
```

**Expected output:**
```
Build succeeded with 1 warning(s)
    0 Error(s)
```

> ℹ️ The warning (CS1030) about the connection string in the scaffolded context is **harmless** — the actual connection string is taken from `appsettings.Development.json`.

---

## 3. Set Up the Database

### 3.1 Create the database and all tables

```bash
sqlcmd -S .\SQLEXPRESS -E -i database\001_initial_schema.sql
```

**Expected output (abbreviated):**
```
Database KarigorDev created.
Changed database context to 'KarigorDev'.
Created AspNetRoles
Created AspNetUsers
...
Schema script complete.
```

You may see warnings like:
```
Warning! The maximum key length for a clustered index is 900 bytes. The index 'PK_AspNetUserLogins' has maximum length of 1800 bytes...
```
These are **normal** for ASP.NET Core Identity tables and do not affect Karigor functionality.

### 3.2 Seed the service categories

```bash
sqlcmd -S .\SQLEXPRESS -E -d KarigorDev -i database\002_seed_categories.sql
```

**Expected output:**
```
Changed database context to 'KarigorDev'.

(10 rows affected)
ServiceCategories seeded.
```

### 3.3 Verify the database exists

```bash
sqlcmd -S .\SQLEXPRESS -E -Q "SELECT name FROM sys.databases WHERE name='KarigorDev'"
```

**Expected output:**
```
name
----------------------------------------------------------------
KarigorDev
(1 rows affected)
```

### 3.4 Verify all tables were created (20 total)

```bash
sqlcmd -S .\SQLEXPRESS -E -d KarigorDev -Q "SELECT name FROM sys.tables ORDER BY name"
```

**Expected output:** a list containing `AspNetUsers`, `CustomerProfiles`, `WorkerProfiles`, `ServiceCategories`, etc.

### 3.5 Verify seed data

```bash
sqlcmd -S .\SQLEXPRESS -E -d KarigorDev -Q "SELECT * FROM ServiceCategories"
```

**Expected output:** 10 rows (Electrician, Plumber, Carpenter, etc.)

---

## 4. Configure JWT Secrets (User Secrets)

> ⚠️ **Critical:** The JWT signing key **must not** be stored in source control. It is stored locally using `dotnet user-secrets`.

```bash
cd backend/Karigor.Api
dotnet user-secrets init          # (if not already initialized)
dotnet user-secrets set "Jwt:Key" "YourSuperSecretKeyForJWT1234567890!"
dotnet user-secrets set "Jwt:Issuer" "https://localhost:5253"
dotnet user-secrets set "Jwt:Audience" "https://localhost:5173"
cd ../..
```

> 🔑 The `Jwt:Key` must be **at least 32 characters** long. Replace the example with your own random string.

To verify the secrets were saved:
```bash
cd backend/Karigor.Api
dotnet user-secrets list
```

**Expected output:** shows the three keys you set.

---

## 5. Verify `appsettings.Development.json`

Ensure `backend/Karigor.Api/appsettings.Development.json` contains the correct connection string:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "ConnectionStrings": {
    "DefaultConnection": "Server=.\\SQLEXPRESS;Database=KarigorDev;Trusted_Connection=True;TrustServerCertificate=True;"
  }
}
```

> If your SQL Server instance is named differently (e.g., `localhost`), adjust the `Server` value accordingly.

---

## 6. Run the Backend

```bash
dotnet run --project backend/Karigor.Api
```

**Expected output (successful startup):**
```
[06:14:46 INF] Starting Karigor.Api
...
[06:14:49 INF] Now listening on: http://localhost:5253
[06:14:49 INF] Application started. Press Ctrl+C to shut down.
```

Open a browser and go to `http://localhost:5253/swagger` to see the Swagger UI.

Test the categories endpoint:
- In Swagger, click `GET /api/categories`
- Click "Try it out" → "Execute"
- You should receive a JSON array of 10 categories.

---

## 7. Set Up the Frontend

Open a **new terminal** (keep the backend running).

```bash
cd karigor-client
npm install
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open `http://localhost:5173` in your browser.

---

## 8. Quick Functional Test

1. **Register as a Customer** – Fill in the form, submit. You should be redirected to the Customer Dashboard.
2. **Register as a Worker** – Fill in the form (select at least one skill), submit. You should be redirected to the Worker Dashboard.
3. **Login** – Use the credentials you just created.
4. **Worker Dashboard** – Explore the tabs (Overview, Profile, Skills, Availability, Documents). Try updating your profile, adding skills, and setting availability.

---

💡 The Typical Workflow
Terminal 1 — Backend (always running)
bash
# Keep this running
dotnet run --project backend/Karigor.Api
Terminal 2 — Frontend
bash
# Keep this running too
cd karigor-client
npm run dev