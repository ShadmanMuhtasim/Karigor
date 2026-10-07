# ADR 0004: Versioned SQL owns Payment schema

- Status: IMPLEMENTED and tested locally. NOT VERIFIED IN PRODUCTION.
- Date: 2026-10-07 (Asia/Dhaka).
- Scope: Current Payments structure and Booking.PaymentStatus only. Payment concurrency/idempotency is PROPOSED for a later task.
- References: [ADR 0003](0003-f5-sql-authority-and-immutable-negotiation.md), [authority/audit/upgrade guide](../database/PAYMENT_SCHEMA_AUTHORITY.md).

## Context

Production 001 omits Payments/PaymentStatus. Development 004 and Program.cs both define them and add a missing ServiceCharge with default zero. Runtime EF knows the columns but not the SQL defaults explicitly; it describes TransactionId as an index rather than the existing SQL unique constraint and leaves required-FK cascade behavior implicit. Historical migrations/snapshot contain neither Payment nor PaymentStatus. These are different schema owners, even though the two SQL definitions largely agree.

F5 already adopted versioned SQL and froze the historical EF migration path. Adopting EF now would require broader reconciliation and risk inventing migration history. Startup changing financial storage also makes database evolution depend on application restarts and runtime DDL privileges.

## Decision

`database/production/006_payment_schema_authority.sql` is the only Payment definition/upgrade. Its default mode is persistent-data read-only preflight. Explicit apply mode locks affected existing tables, repeats validation and executes DDL/stamping atomically during an operator-controlled writer outage. The script targets the already-selected database and contains no USE/create/drop database directives.

Fresh databases run baseline 001, F5 005 and Payment 006, plus ordinary seed 002 as needed, before startup. Valid audited current schemas are adopted without updating financial rows. Supported compatibility includes missing columns on empty tables, missing expected indexes/FK, normalizing defaults and converting a matching EF unique index into the existing SQL unique constraint. Unsupported column/key/FK definitions or unknown schema versions are refused.

Do not fill missing ServiceCharge on populated Payments or missing PaymentStatus on populated Bookings with invented zero/Unpaid values. Report duplicate/ambiguous identities, settlement-looking inconsistencies, missing amounts/currency and malformed states. Refuse application when review is needed. Do not delete records, rewrite Paid/Completed, infer merchant identity or assign a settlement winner.

Map named PK/TransactionId unique constraint, defaults, precision and existing booking FK cascade explicitly in EF. Preserve current delete semantics; this task performs no deletions. Freeze historical migrations/snapshot, document their omissions, and never use them as an independent Payment owner. Startup's PaymentSchemaGate checks metadata/stamp only and never repairs payment data/schema. Unrelated legacy booking-verification DDL remains outside this task.

## Consequences

- F1 verifier, routes, fee/currency/status rules, receipt storage and frontend remain unchanged.
- New binaries require explicit schema provisioning; application startup no longer needs Payment DDL permission.
- Schema authority is canonical in code and tested SQL databases, enabling the next scoped F1 work. This does not establish concurrency/idempotency guarantees.
- Apparent duplicate ValId/BankTranId cannot be conclusively scoped without later merchant/environment metadata. They require review, not invented provenance or a new unique constraint.
- Existing ON DELETE CASCADE is explicit and preserved. Retention/delete-policy changes require their own business decision; an operator must not delete a booking expecting its payment history to survive that existing FK behavior.
- Forward versions add future concurrency/initiation/provider/settlement metadata through SQL plus matching mappings/tests. Version 1 refuses unknown future versions; no downgrade or automatic rollback is provided.
- No production access, financial migration or deployment was performed. Local legacy review remains separate.

## Alternatives

Keeping startup DDL would retain another schema owner. Generating a Payment EF migration from the stale snapshot would implicitly re-own broader tables/history. Copying Payment into baseline 001 would duplicate the upgrade's definition. Auto-correcting financial rows would manufacture facts. None is necessary to establish this narrow authority.
