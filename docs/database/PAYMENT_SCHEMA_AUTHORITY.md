# Payment schema authority

Date: 2026-10-07 (Asia/Dhaka). **IMPLEMENTED:** SQL ownership, exact runtime mappings, preflight, controlled upgrade and startup verification. **PROPOSED:** payment concurrency/idempotency and its metadata. **NOT VERIFIED IN PRODUCTION:** schema/data quality, upgrade, deployment and provider operations. No production database was inspected or modified.

## Audit comparison

Stage 1 inspected Payment/Booking models, DbContext, all EF migrations/snapshot, development 004, production 001/002/005, Program.cs payment DDL and setup/deployment documentation. ADR 0001 is empty; ADR 0003 and the approved plan supply the SQL-first direction. The following table records the definitions **before this task** and the actual chosen current definition. Production baseline 001 contains none of these Payment definitions.

| Schema object | SQL definition before | EF model/mapping before | EF migration/snapshot | Startup DDL before | Actual intended definition | Drift/conflict |
|---|---|---|---|---|---|---|
| Payments table / Id | Dev 004: int IDENTITY, PK_Payments | Payment table, int generated key | Payment absent | Duplicate CREATE if absent | dbo.Payments, int IDENTITY(1,1), PK_Payments | Production baseline absent; duplicate owner |
| Booking.PaymentStatus | Dev 004: nvarchar(50), NOT NULL, default Unpaid | Required string max 50; C# initializer Unpaid; no SQL default mapping | Property absent | ADD if absent | nvarchar(50) NOT NULL, named SQL default Unpaid | EF default implicit; runtime DDL owned missing column |
| BookingId / FK | int NOT NULL; named FK to Bookings.Id, ON DELETE CASCADE | Required relation; cascade by EF convention | Payment FK absent | Same named cascade FK | Preserve int and FK_Payments_Bookings_BookingId / CASCADE explicitly | Delete policy implicit in mapping |
| TransactionId | nvarchar(100) NOT NULL; UQ_Payments_TransactionId UNIQUE | Same type; Index attribute marked unique under that name | Absent | Same UNIQUE constraint | Same unique SQL constraint, mapped as EF alternate key | Uniqueness worked, but index vs constraint metadata differed |
| ValId / BankTranId / CardType | Nullable nvarchar(100) each | Same nullable lengths | Absent | Same fields | Preserve nullable receipt fields, no new uniqueness | Provider identity/environment/session not stored; later scope |
| Currency | nvarchar(10) NOT NULL DEFAULT BDT | Same length/required, C# BDT initializer; no SQL default | Absent | Same definition | Preserve BDT default and length; explicit EF SQL default | SQL default missing from EF mapping |
| TotalAmount / PlatformFee / WorkerAmount | decimal(18,2) NOT NULL | decimal(18,2) attributes | Absent | Same types | Preserve exact precision; explicitly map (18,2) | No numeric type conflict; absent production/snapshot owner |
| ServiceCharge | decimal(18,2) NOT NULL DEFAULT 0.00; ADD if absent | decimal(18,2), C# default zero; no SQL default | Absent | Duplicate ADD, including zero fill on historical rows | Same precision, default zero for new/empty-table storage only | Old missing-column path could fabricate a historical fee |
| Status | nvarchar(50) NOT NULL DEFAULT Initiated | Required max 50, C# initializer; no SQL default | Absent | Same definition | Preserve Initiated/Completed/Failed/Cancelled vocabulary and Initiated default | No DB status check; mapping default implicit |
| CreatedAt | datetime2 NOT NULL DEFAULT SYSUTCDATETIME | DateTime.UtcNow initializer; no SQL default mapping | Absent | Same definition | datetime2(7), server UTC default and existing C# assignment | Missing SQL default in EF |
| PaidAt / GatewayResponse | Nullable datetime2 / nvarchar(max) | Same nullable fields | Absent | Same fields | Preserve existing receipt/time payload exactly | No data reconstruction justified |
| Supporting indexes | IX_Payments_BookingId and IX_Payments_Status, nonunique | Same Index attributes | Absent | Same CREATE indexes | Same enabled, nonfiltered indexes | Production baseline absent; creation-only startup does not reconcile other drift |

The two existing SQL definitions mostly agreed. The main conflict was **ownership and completeness**, plus inaccurate/default-implicit EF metadata—not evidence that decimal precision already differed in valid current storage. Repository/deployment docs previously suggested baseline provisioning followed by startup filling gaps. No Migrate/EnsureCreated call implements the historical snapshot.

Read-only metadata on local `.\SQLEXPRESS/KarigorDev` found no Payments table or PaymentStatus column. That local database is not an example of the fully started audited schema. Generated upgrade fixtures reproduce the former startup definition exactly, so both fresh and actual audited-current upgrade paths are tested without assuming the local database's state.

## Sole owner and exact changes

**006_payment_schema_authority.sql owns current Payment DDL.** Baseline 001 remains a baseline; it does not gain a second Payment definition. Development 004 is retired and raises a clear error pointing to 006 without changing database context or schema. Program's CREATE Payments / ADD PaymentStatus / ADD ServiceCharge branches are removed. Startup calls read-only PaymentSchemaGate before ordinary role/category seeding.

The canonical table has **15 columns**: Id, BookingId, TransactionId, ValId, BankTranId, CardType, Currency, TotalAmount, PlatformFee, ServiceCharge, WorkerAmount, Status, CreatedAt, PaidAt, GatewayResponse. Types/nullability are in the table above. No Payment/Booking rowversion, initiation key, provider session/environment, allocation state or other feature metadata was added.

Canonical default names are DF_Bookings_PaymentStatus, DF_Payments_Currency, DF_Payments_ServiceCharge, DF_Payments_Status and DF_Payments_CreatedAt. The upgrade normalizes default definitions/names without updating stored rows. It preserves PK_Payments, UQ_Payments_TransactionId, both supporting indexes and the existing cascade booking FK, adding/retrusting missing valid guards under locks. A matching unique index can be converted into the SQL unique constraint atomically; conflicting named indexes, extra unique keys/FKs, unsupported columns or unknown version stamps are reported/refused.

Successful application sets extended property `KarigorPaymentSchemaVersion=1` on dbo.Payments. The gate verifies the marker, all column types/lengths/precision/scale/nullability/identity, exact defaults, key/index columns and uniqueness, and a trusted/enabled correctly targeted cascade FK. The gate reads metadata; it does not run financial repair or the data preflight during ordinary startup.

EF now maps defaults, named alternate key, precision and FK/delete behavior explicitly. Payment's redundant unique-index attribute is removed. Its C# initializers remain. Historical migrations/snapshot deliberately stay frozen and omit Payment/PaymentStatus; manufacturing a migration entry would misrepresent how databases were created. [Migration README](../../backend/Karigor.Infrastructure/Migrations/README.md) prohibits independent Payment migrations. Unrelated booking-verification startup DDL remains outside this task.

## Preflight checks and interpretation

Run 006 normally on an explicitly selected database. Its report contains Severity, Issue, EntityId and no receipt/credential payload. **Info** identifies a missing object that can be added safely when no historical values would need to be assumed. **Review** identifies financial history requiring human confirmation. **Blocker** identifies unsupported schema or prerequisites. Both Review and Blocker refuse apply with SQL error 51060; the transaction rolls back.

Data checks cover:

- Duplicate TransactionId under existing SQL uniqueness semantics; NULL/blank/control/leading/trailing-whitespace transaction identifiers. No guessed TXN naming convention is imposed on historical records.
- Apparent duplicate nonblank ValId and BankTranId, using exact binary identity plus byte length. Without merchant/environment metadata, these are review signals, not proof of one shared provider settlement.
- Multiple Completed attempts per booking; Paid booking without a Completed attempt; Completed attempt whose booking is not Paid.
- Missing/nonpositive total amount, missing/negative fee/net amounts, inconsistent component sum, or mismatch to the stored booking price. No historical fee percentages are recomputed.
- Missing/unsupported currency (current F1 is BDT only), orphan payments, suspicious payment/booking-payment statuses, incomplete completion receipt/time and missing creation time.
- Existing rows without ServiceCharge or PaymentStatus: refuse assigning zero/Unpaid. Unknown timestamps/authors/provider identity are never filled.

Column types/default/index/FK metadata are also inspected. Unsupported numeric scale is refused rather than rounded/truncated. Unrecognized future version stamps are refused rather than downgraded. There is no unique ValId/BankTranId or unique Completed-per-booking constraint yet: a real extra settlement must eventually be preserved/reviewed, not made impossible to record by this task.

## Fresh database flow

1. Operator selects/provisions the target database; run host-neutral production 001 baseline and ordinary 002 seed as needed.
2. Default preflight then explicit application of F5 005 and Payment 006. Fresh Bookings/Payments are empty, so missing financial columns contain no history to invent.
3. Start compatible binaries. F5/Payment gates must pass before serving requests.

Development may use its existing base SQL/verification setup, then the **same** host-neutral 005/006 path. A test fixture always uses the production baseline plus explicit upgrades in a generated loopback database. It no longer relies on startup to invent payment storage.

## Existing database upgrade flow

Take a backup and stop every writer through the existing operator deployment process. Review default preflight. For supported valid data, opt in on that **same connection**:

```sql
EXEC sys.sp_set_session_context @key=N'KarigorPaymentSchemaApply', @value=1;
-- Execute the entire database/production/006_payment_schema_authority.sql file here.
EXEC sys.sp_set_session_context @key=N'KarigorPaymentSchemaApply', @value=NULL;
```

Apply mode locks existing Bookings/Payments, rechecks data/shape, installs all needed DDL/defaults/guards/stamp in one XACT_ABORT transaction and commits. The script has no USE/create/drop database, persistent UPDATE or DELETE. Valid repeated application is tested and preserves every financial field. Only empty Payments can receive missing ServiceCharge; only empty Bookings can receive missing PaymentStatus.

Resolve review findings through separately authorized evidence/business confirmation. Do not delete duplicate attempts, choose a winning settlement, manufacture receipt/merchant/time, or mark an ambiguous booking Paid/Unpaid to make preflight green. No such data repair is part of this implementation.

Forward changes belong in a new reviewed SQL version with matching EF mappings and tests. A failed transaction rolls back its DDL. After a successful production migration, rollback is not an automatic inverse: deleting payment structures/history is unsafe, and old binaries can reintroduce startup ownership. Keep compatible binaries/schema or use a reviewed corrective forward version. No rollback script or production application was executed.

## Actual local/test evidence

Read-only local development preflight found **no Payments table**, **no Booking.PaymentStatus**, and **nine existing bookings (IDs 1–9) with unknown payment-status history**. No local attempt/receipt/amount data exists in a Payments table to audit, so duplicate/currency/provider findings are **not evaluable there**, not declared clean. The upgrade would refuse inventing Unpaid for these bookings. Local development was not modified. Previous F5 active-legacy findings are separate.

Disposable SQL tests cover fresh mapping/defaults/keys/FK; valid audited startup, EF-index, missing-index/FK and wrong-default upgrades; dirty financial history; missing-column compatibility/refusal; and absent/drifted startup. Valid upgrades compare complete before/after JSON snapshots of every Payment and Booking field. An actual Production-mode TestServer proves startup refuses an absent Payment schema without creating either object. The full pre-existing F1/F2/F3/F5/F7 backend suite remains required; F4's established real-browser evidence is unchanged by this backend-only task.

Final validation: Release build passed with zero warnings/errors; **186 backend tests passed**, including **35 PaymentSchema** and **47 F1** cases; **36 browser tests passed**, including existing F4 cases. Zero failures/expected failures/skips. Valid fresh creation, four audited upgrade variants and financial-history refusal cases are green. `git diff --check` and documentation link/fence checks passed. Full backend TRX is ignored `TestResults/security/15083a5481824e4b8c3f613d9b5b13ae/security.trx`; detailed logs are `TestResults/payment-schema-*.log`. Final executed counts/log paths are also recorded in the appended [study entry](../security/SECURITY_WORKDONE.md). Commands:

```text
dotnet build Karigor.slnx --configuration Release --no-restore
python scripts/run-security-tests.py --no-build --strict --filter "Finding=PaymentSchema"
python scripts/run-security-tests.py --no-build --strict
git diff --check
```

Only loopback generated databases are automatically applied/dropped. Local metadata/preflight logs are ignored `TestResults/payment-schema-audit-local.txt` and `payment-schema-local-preflight.txt`. No production financial data, merchant gateway or production schema was accessed.

## Readiness and limitations

**YES: schema authority is sufficiently canonical to begin the next F1 concurrency/idempotency implementation in this repository and disposable databases.** There is one tested forward path, explicit mappings and a runtime verifier; financial ambiguity is surfaced rather than silently repaired. Next metadata must extend this SQL path, not restart independent EF/startup ownership.

This is not a concurrency fix or approval to deploy. No rowversion/idempotency/session/allocation/outbox/deduplication/worker was added. Current Cascade deletion semantics remain, legacy review and deployment outage/permissions are operator work, broader historical EF/schema drift is not modernized, and production is unverified. Existing unknown local bookings prevent automatic application until their history is explicitly reviewed.
