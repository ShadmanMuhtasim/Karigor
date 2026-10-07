# ADR 0003: SQL authority and immutable F5 negotiations

- Status: Accepted for the local F5 implementation; no deployment or production migration performed.
- Date: 2026-10-07 (Asia/Dhaka).
- Scope: Quotation integrity and one booking per request. Payment concurrency remains separate.

## Context

An initial quotation POST could overwrite a customer counter. Parent depth still labelled it customer-authored, letting the worker accept an unauthorized price. Role checks authorized a participant without protecting the participant's submitted intent.

The referenced ADR 0001 is empty in this checkout. The approved Phase 1 plan explicitly prefers SQL-first upgrades. Baseline SQL, historical EF migrations and startup DDL currently overlap. The EF snapshot omits newer payment structure; startup does not run EF migrations. Adopting EF migrations from that snapshot would require unrelated reconciliation.

## Decision

Use `database/production/005_f5_negotiation_integrity.sql` as the sole F5 schema definition and upgrade. Its default mode reports legacy problems without changing persistent data. Explicit session-context opt-in applies the same script atomically during a writer outage. Current EF mappings describe the resulting schema; historical migrations/snapshot remain frozen. Startup verifies the F5 marker, columns, constraints, index keys/filters and enabled trigger without creating F5 objects. Existing unrelated payment/verification DDL remains outside this decision.

Retain the linear parent chain. New offers carry authenticated `ProposedByUserId`, UTC creation time and SQL rowversion. Submitted terms and structural/provenance fields are immutable, including through a SQL trigger. No parity-based authorization remains. Initial POST never updates an existing thread.

Require the displayed offer version for accepting/countering. Inside each execution-strategy transaction, clear tracked state, reload participants/request/offer, validate the opposite participant and current head, then perform a rowversion-checked request write before offer writes. Countering saves Pending → Countered before inserting its child. Acceptance commits request closure, exact-price booking, accepted offer and competing-head rejection together. Unique indexes protect one pending head per pair, one child per parent, and one booking per request. Conflicts return 409 and the UI refreshes authoritative state.

Do not reconstruct historical authors or timestamps. Even clean legacy parity cannot prove who submitted an offer under the old mutable implementation. Report and refuse all unresolved active unknown-provenance offers; preserve inactive unknown fields as NULL. Do not silently select duplicate bookings or discard forked chains.

## Alternatives and consequences

- Adding a root-only condition to the old overwrite query would contain one exploit but retain mutable terms and stale acceptance.
- Serializable transactions alone do not prove authorship. The request CAS, explicit version checks, SQL transaction and uniqueness cover the current scope without a thread table or distributed lock.
- A new generic state machine or migration framework would expand scope without improving this narrow boundary.
- Backend/frontend/schema cutover must be coordinated. Old mutable writers must be stopped. Old callers without versions now receive 409.
- SQL triggers require disabling EF's optimized OUTPUT clause for Quotation only.
- Post-commit notifications are still best effort. Uncertain commits may return conflict on retry; refresh discovers any committed booking. No exactly-once response or durable event delivery is claimed.
- F5 schema is sufficiently specified locally. Payment schema authority, settlement identity, payment/booking versions and financial concurrency still need a separate decision.

See [implementation](../security/implementation/F5_NEGOTIATION_INTEGRITY.md) and [migration/preflight](../database/F5_SCHEMA_AUTHORITY_AND_MIGRATION.md).
