# Production Database Scripts

**F5 cutover requirement (2026-10-07):** Before starting the F5 API, run the default read-only preflight in `005_f5_negotiation_integrity.sql`, resolve reported legacy issues, then explicitly apply that same script during a writer outage. It is the only F5 schema owner; ordinary startup only verifies it. Fresh databases also require 005 after the baseline. See [the schema and migration note](../../docs/database/F5_SCHEMA_AUTHORITY_AND_MIGRATION.md). Existing mutable binaries are incompatible with the new guards.

**Payment prerequisite (2026-10-07):** Also preflight and explicitly apply `006_payment_schema_authority.sql` on the same intended database connection before starting the API. This is the sole Payment schema owner; startup no longer creates Payments/PaymentStatus/ServiceCharge. Old `database/004_add_payments.sql` is retired. Missing financial fields on populated tables require review rather than automatic zero/Unpaid backfills. See [Payment authority and upgrade](../../docs/database/PAYMENT_SCHEMA_AUTHORITY.md).

This directory contains the production-safe database provisioning scripts for **KARIGOR** on MonsterASP.NET (or any hosted MSSQL environment).

---

## Key Differences from Local Development Scripts (`database/`)

| Aspect | Development Scripts (`database/`) | Production Scripts (`database/production/`) |
|---|---|---|
| **Database Creation** | Contains `CREATE DATABASE [KarigorDev]` | **Excluded**. The database is provisioned through MonsterASP Control Panel. |
| **Database Context** | Contains `USE [KarigorDev];` | **Excluded**. Scripts run within whatever database context the host assigns. |
| **Completeness** | Base schema plus older verification script; then the same host-neutral 005/006 upgrades | 001 baseline (including verification/SosAlerts), followed by explicit 005 negotiation and 006 payment upgrades |
| **Repeatability** | Follow the documented versioned path | 001/002 are repeatable; 005/006 recheck preflight and refuse unresolved data/unsupported schema rather than claiming unconditional success |
| **Data Safety** | Re-creation assumptions | **Non-destructive**. Never drops tables or clears user data. |

---

## Execution Order

When setting up a new production database on MonsterASP:

1. **Create the Database in MonsterASP**:
   - Go to MonsterASP Control Panel -> Databases -> MS SQL.
   - Create a new MSSQL database (e.g., `karigor_db`). Note the Host, Database Name, User, and Password.

2. **Execute Script 1: Schema**:
   - File: `database/production/001_schema.sql`
   - Run via SQL Server Management Studio (SSMS), Azure Data Studio, or MonsterASP web-based DB management tool connected to the newly created database.
   - **What it does**: Creates all Identity tables, Domain tables (`CustomerProfiles`, `WorkerProfiles`, `WorkerDocuments`, `WorkerSkills`, `WorkerAvailability`, `ServiceRequests`, `Quotations`, `Bookings`, `Reviews`, `Messages`, `Notifications`, `SosAlerts`), foreign keys, and indexes.

3. **Execute Script 2: Seed Data**:
   - File: `database/production/002_seed.sql`
   - Run in the same database context.
   - **What it does**: Seeds the core Identity roles (`Customer`, `Worker`, `Admin`) and standard `ServiceCategories` (10 categories with CDN icons).

4. **Apply Versioned Prerequisites**:
   - Run `005_f5_negotiation_integrity.sql` and `006_payment_schema_authority.sql` in default read-only mode.
   - Review reported issues; follow their linked guides to opt in and execute each entire script on the same connection during a writer outage.
   - Fresh databases need both upgrades too. Seed data does not apply schema upgrades.

5. **Explicit Initial Administrator Bootstrap**:
   - Ordinary API startup seeds roles but never creates/promotes an administrator.
   - From a trusted interactive terminal with the published API and intended database configuration, run `dotnet Karigor.Api.dll bootstrap-admin`.
   - Enter the operator-selected email and password at the prompts; password input is hidden and must not be placed in process arguments, scripts or documentation.
   - The command atomically creates a new Identity account and Admin assignment, then exits without serving HTTP. Existing accounts are never promoted, and bootstrap refuses creation if an administrator already exists.
   - Existing administrator credentials are preserved. See [the F2 setup guide](../../docs/security/implementation/F2_SECURE_ADMIN_BOOTSTRAP.md) for error handling and legacy-account review.

---

## Verification Queries

After executing the baseline and both versioned upgrades, verify that all 22 tables are present:

```sql
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
```

Expected tables (22 total):
1. `AspNetRoleClaims`
2. `AspNetRoles`
3. `AspNetUserClaims`
4. `AspNetUserLogins`
5. `AspNetUserRoles`
6. `AspNetUsers`
7. `AspNetUserTokens`
8. `Bookings`
9. `CustomerProfiles`
10. `Messages`
11. `Notifications`
12. `Quotations`
13. `RefreshTokens`
14. `Reviews`
15. `ServiceCategories`
16. `ServiceRequests`
17. `SosAlerts`
18. `WorkerAvailability`
19. `WorkerDocuments`
20. `WorkerProfiles`
21. `WorkerSkills`
22. `Payments`
