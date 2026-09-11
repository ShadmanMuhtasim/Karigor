# Production Database Scripts

This directory contains the production-safe database provisioning scripts for **KARIGOR** on MonsterASP.NET (or any hosted MSSQL environment).

---

## Key Differences from Local Development Scripts (`database/`)

| Aspect | Development Scripts (`database/`) | Production Scripts (`database/production/`) |
|---|---|---|
| **Database Creation** | Contains `CREATE DATABASE [KarigorDev]` | **Excluded**. The database is provisioned through MonsterASP Control Panel. |
| **Database Context** | Contains `USE [KarigorDev];` | **Excluded**. Scripts run within whatever database context the host assigns. |
| **Completeness** | Fragmented across `001_initial_schema.sql` and `003_add_booking_verification.sql`; missing `SosAlerts` | **Consolidated**. Contains full schema up to the latest features (`Bookings` verification columns, `SosAlerts`, and all indexes). |
| **Idempotency** | Partial | **100% Idempotent**. Safe to run multiple times without data loss or duplicate errors. |
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

4. **Runtime First-Startup (Automatic)**:
   - On the first startup of the ASP.NET Core API, the application will automatically create the initial administrator user (`admin@karigor.com` / `Admin123!`) using standard ASP.NET Core Identity password hashing (`UserManager.CreateAsync`).

---

## Verification Queries

After executing both scripts, verify that all 17 tables are present:

```sql
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
```

Expected tables (17 total):
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
