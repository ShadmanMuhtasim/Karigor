# ADR 0005: Durable payment intent and one selected booking settlement

- Status: IMPLEMENTED; verified with disposable local SQL and fake provider HTTP. Production/provider operations are unverified.
- Date: 2026-10-07 (Asia/Dhaka).
- Scope: F1 concurrency, initiation retries, settlement allocation and minimal durable notifications.
- References: [approved plan](../security/PHASE1_SECURITY_REMEDIATION_PLAN.md), [ADR 0004](0004-payment-schema-authority.md), [implementation](../security/implementation/F1_PAYMENT_CONCURRENCY_AND_IDEMPOTENCY.md).

## Context

Independent SSLCommerz verification already binds the stored transaction, exact amount, BDT currency and receipt. Verification alone does not prevent two requests reading Initiated and both allocating/notifying, or a retry creating another payable provider session after a lost response. A second real settlement must remain visible even when the booking is already paid.

ADR 0001 is empty in this checkout. The approved plan supplies the selected-settlement preference; this ADR records the concrete decision without inventing missing ADR contents.

## Decision

Extend SQL-owned Payment version 1 with `007_payment_concurrency.sql`, version 2. Match current EF mappings; keep historical migrations frozen. Startup verifies metadata and never applies these scripts. Default preflight reads only. Refuse legacy attempts or non-Unpaid booking payment states rather than inventing merchant provenance or selecting historical receipts.

One booking has one durable initiation intent for this Phase 1 scope. Its SHA-256 fingerprint includes booking, customer, worker, stored price, fee components, BDT, merchant and environment. A filtered unique BookingId index enforces that cardinality. A reserved attempt uses a random 29-character transaction ID, then Payment rowversion elects one dispatcher by committing Dispatching before HTTP. Ready stores the session key/URL; retries return that same URL. Dispatching/Unknown retries return HTTP 202 with the existing transaction and unresolved guidance. Changed terms/configuration return HTTP 409. No provider POST is retried following uncertainty. Reserved is reclaimable because no dispatch claim has committed yet.

Provider verification remains outside SQL transactions. In a short transaction, reload Payment and Booking, rebind the proof to current terms, compare-and-swap Booking using rowversion, record the verified receipt, select its PaymentId only if no selection exists, update Paid and insert a recipient notification. Commit before user/booking realtime pushes. Conflict retries reload SQL state and reuse the already verified proof; they never perform another provider call inside the transaction. Exhausted expected conflicts become a stable conflict/retry response.

Booking.SelectedPaymentId is nullable and immutable once allocated. The composite NO ACTION FK `(SelectedPaymentId, Booking.Id) -> (Payment.Id, Payment.BookingId)` prohibits selecting a different booking's attempt and avoids a cascade cycle. Payment retains its original BookingId cascade FK, but new guards refuse deletion of completed financial facts or removal of a selected allocation. Completed receipt facts/terms cannot be changed or downgraded.

An authenticated successful Payment is a provider fact. Selection on Booking is Karigor's business allocation. A second verified Payment becomes Completed with RequiresReview=true and a durable customer PaymentReview notification; it does not replace the selection or emit another PaymentReceived effect. PaymentReceived notification deduplication follows from the same transaction and Booking CAS, without a separate outbox or notification-key subsystem.

Verified identity is `(VerifiedMerchantId, VerifiedEnvironment, VerifiedTransactionId)`, filtered unique when present. The provider documents `tran_id` as a unique transaction identifier, and the retained verifier binds it exactly to the attempt. ValId/BankTranId remain provider receipt evidence; no undocumented assumption that either independently identifies one settlement is added. This deliberately refines the plan's generic "provider validation identity" to the verified merchant transaction identity. See [official SSLCommerz documentation](https://developer.sslcommerz.com/doc/v4/).

## Consequences and tradeoffs

- No promise of exactly-once network delivery or cross-system atomic commit. Database business effects converge; uncertainty is retained.
- A crash immediately after Dispatching but before the HTTP call can block an intent that never reached the provider. Safety takes precedence over silently creating another session. No automatic age-based takeover.
- Persisted transaction, merchant/environment, dispatch time and session key when known support later documented provider lookup by transaction/session. A reconciliation worker, operator adoption of legacy facts and reviewed new-intent/expired-session policy remain deferred.
- Session keys and raw initialization responses are omitted from DTOs/logs. The authorized customer receives the gateway redirect URL when Ready. No gateway credentials are stored on Payment.
- Durable notification records survive delivery failure. Realtime is best effort; a crash after commit may omit a push. Reliable asynchronous delivery would need a separate approved design.
- F6 sessions, F5 negotiations, SignalR authorization, private documents, wallet, ledger, payout, Redis and brokers are unchanged.

## Alternatives

Application-only Completed checks race. A unique Completed-per-booking index loses the ability to retain another real settlement. A separate allocation table adds an unnecessary object for one scalar selection. Process/distributed locks do not replace SQL invariants. Holding SQL open over provider HTTP neither solves network uncertainty nor provides a distributed commit. A wallet/ledger/outbox/background reconciliation service exceeds this scope.
