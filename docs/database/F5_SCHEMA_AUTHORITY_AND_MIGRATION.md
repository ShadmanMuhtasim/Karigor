# F5 schema authority and migration

Date: 2026-10-07 (Asia/Dhaka). Scope: Quotation, the ServiceRequest concurrency token, and booking-per-request uniqueness. Nothing was applied to production or the existing local application database.

## Stage 0 findings

| Existing path | What owns/changes these structures today |
|---|---|
| `database/001_initial_schema.sql` | Development SQL bootstrap, including database creation/context; old Quotation, ServiceRequest and Booking definitions |
| `database/003_add_booking_verification.sql`, `004_add_payments.sql` | Additional development SQL, explicitly targeting KarigorDev |
| `database/production/001_schema.sql` | Host-selected database bootstrap: domain/Identity, self-parent/request/worker/customer FKs and booking verification; omits current payment additions |
| `database/production/002_seed.sql` | Seed data, not F5 schema authority |
| `KarigorDbContext` / model attributes | Runtime EF mappings; initially no author, creation time, quotation/request rowversion or F5 uniqueness |
| EF initial/AddSosAlert migrations and snapshot | Historical definitions; no automatic Migrate/EnsureCreated calls, no F5 upgrade, older than payment mappings |
| `Program.cs` startup SQL | Fills booking verification, PaymentStatus and Payments/ServiceCharge gaps; does not create base negotiation tables |
| Deployment documentation | Operators provision SQL in the assigned database, then start the application |

The observable repository path is manual SQL provisioning plus additive startup SQL. A read-only check of local `.\SQLEXPRESS/KarigorDev` found no `__EFMigrationsHistory` table and no F5 schema. Hosted production provisioning/runtime state was not accessed. ADR 0001 is empty; the approved plan's SQL-first preference and [ADR 0003](../adr/0003-f5-sql-authority-and-immutable-negotiation.md) establish the narrow decision.

## One F5 owner

Use **only** `database/production/005_f5_negotiation_integrity.sql` for both a new baseline database and an existing database. Fresh provisioning runs production 001, seeds 002 as needed, then F5 005 before the new API starts. A development database uses its existing base provisioning, then the same host-neutral F5 005. Do not copy F5 columns into the old bootstrap scripts, add an independent F5 EF migration, or add startup F5 DDL.

The EF snapshot is deliberately preserved as historical, not advanced to a fictional complete model. The migration-directory README prohibits using it as an F5 upgrade. Current mappings agree with the F5 columns, FK, filtered indexes, status check and trigger. A read-only startup gate rejects absent/incomplete F5 installation, disabled guards, or mismatched index keys/filters.

## Exact changes

| Object | Addition |
|---|---|
| Quotation | Nullable `ProposedByUserId nvarchar(450)`; nullable `CreatedAt datetime2`; non-null SQL `RowVersion rowversion` |
| Quotation proposer FK/index | `FK_F5_Quotation_Proposer` → AspNetUsers.Id, NO ACTION; `IX_Quotations_ProposedByUserId` |
| ServiceRequest | Non-null SQL `RowVersion rowversion` |
| Pending head | `UX_F5_Quotations_Pending`: unique `(ServiceRequestId,WorkerId)` filtered to Pending |
| Linear child | `UX_F5_Quotations_Child`: unique ParentQuotationId where non-null |
| Booking | `UX_F5_Bookings_Request`: unique ServiceRequestId |
| Status check | `CK_F5_Quotation_Status`: Pending, Countered, Accepted, Rejected |
| Quotation trigger | `TR_F5_Quotation_Immutable`: forbids term/provenance/parent/request/worker changes; restricts status transitions; validates new participant-authored submissions and same-request/same-worker opposite-author child links |
| Version stamp | Extended property `KarigorF5Version=1` on dbo.Quotations, added only in the successful transaction |

Existing parent/request/worker/customer FKs remain. New children reference an earlier parent ID, preventing newly inserted cycles; parent links cannot later be edited. Binary comparisons plus data lengths protect message casing/trailing spaces. Historical timestamps/authors remain NULL, with no default/backfill that invents them. SQL rowversion is a concurrency token, not a historical creation time.

## Preflight and controlled future application

Connect explicitly to the intended database. Executing the file normally is **read-only for persistent data** and reports Issue/EntityId. It checks duplicate bookings, multiple pending heads/roots, forks, cycles, missing/cross-request/cross-worker parents, unknown statuses, pending parents with children, countered rows without children, pending offers on closed/booked requests, missing request/worker links, and unresolved active provenance.

After an operator has reviewed the report and stopped every writer, opt in on the same connection:

```sql
EXEC sys.sp_set_session_context @key=N'KarigorF5Apply', @value=1;
-- Execute the entire 005_f5_negotiation_integrity.sql file on this connection.
EXEC sys.sp_set_session_context @key=N'KarigorF5Apply', @value=NULL;
```

Application mode locks the three affected tables, repeats preflight under those locks, and performs all DDL/guards/stamping in one XACT_ABORT transaction. Any issue raises 51005 and rolls back. Partial manually-added F5 columns without the installed stamp raise 51006 rather than being silently adopted. Clean repeat application is tested. The script has no USE, database creation or database deletion directives. It is designed for SQL Server, not EF InMemory/SQLite.

Resolve ambiguous negotiations by a separately reviewed operator/business confirmation process. A conservative option is to retain the old thread as closed history and have participants submit fresh known intent on a replacement request. Do not infer true authors from parity, rewrite old terms to look agreed, manufacture timestamps, delete duplicate bookings automatically, or run old mutable application binaries after the cutover. This implementation performs none of those data repairs.

Plan backup and writer outage before a future authorized migration. Deploy the compatible schema, backend and frontend together; verify gate and smoke tests before serving writes. Existing startup payment/verification DDL still needs its established permissions. Rolling back binaries to the mutable implementation is incompatible with the new immutable trigger; do not remove guards to make that rollback appear successful.

## Actual local legacy findings

Default read-only preflight on existing local KarigorDev returned **two** `active-legacy-unknown-provenance` rows (Quotation IDs 2 and 4), and no other reported structural issue. Both lack authoritative historical authorship; a clean chain would not recover the truth of the old overwrite behavior. The existing application database was not upgraded, backfilled, archived or otherwise changed. The new startup gate will refuse it until an operator resolves those offers and explicitly applies F5. Raw local diagnostics are in ignored `TestResults/f5-local-preflight.log` and `f5-local-metadata.log`.

Nine dirty legacy fixtures separately exercise the required failures; a clean inactive fixture preserves its booking, NULL author and NULL time. These generated fixtures prove the preflight's behavior, not production data quality. All automatically applied upgrades target guarded random loopback test databases, which are dropped afterward.

## Payment readiness

F5's relevant columns/guards are canonical through this SQL path. **The overall payment schema is not yet canonical.** Payment/PaymentStatus remain missing from the old production baseline/EF snapshot and are filled by startup DDL. Payment concurrency needs its own narrow authority/reconciliation, booking/payment versions, settlement allocation uniqueness and coordinated tests. This F5 task adds no payment version, settlement pointer, outbox or scheduling guarantee across separate requests.
