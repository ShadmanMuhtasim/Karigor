# F5 immutable negotiation and agreement integrity

Implemented locally on 2026-10-07 (Asia/Dhaka). Schema/application/frontend cutover has not been deployed. [ADR](../../adr/0003-f5-sql-authority-and-immutable-negotiation.md), [schema/preflight](../../database/F5_SCHEMA_AUTHORITY_AND_MIGRATION.md), [study log](../SECURITY_WORKDONE.md).

## Problem and result

Before: worker submits 1000 → customer counters 800 → worker initial POST overwrites that pending row to 5000 → parent-depth parity still labels it Customer → worker accepts 5000. Role and participant checks saw an authorized worker, but the customer's submitted terms were no longer preserved.

After: the initial POST returns 409 for an existing thread and cannot change price/message. The 800 child retains server-derived customer authorship. A worker can accept that exact current 800 offer with its displayed version, or counter it by creating a fresh immutable child. Old/self/unrelated responses cannot establish agreement.

## Exact application/API changes

- `MarketplaceService`: initial creation submits a new immutable root once; explicit author/time for roots and counters; positive, two-decimal-place prices; display depth remains cycle-bounded history only. Role display derives from the stored author; unknown legacy provenance remains Unknown.
- Accept/counter: require `expectedVersion` matching the returned base64 `version`. Verify exact request customer/offer worker, opposite stored author, Pending status, Open request, absence of a child/booking, and current rowversion inside the transaction.
- A shared execution-strategy wrapper clears tracked entities before **every** attempt, starts a new SQL transaction and re-reads state. A rowversion-checked request write orders F5 writers for the same request. Competing changes produce conflict rather than merging stale intent.
- Counter saves the parent's Countered transition before inserting the child, preserving the filtered Pending key. Both saves commit together.
- Accept closes the request to InProgress, accepts the selected immutable offer, rejects every competing Pending head, and inserts one Scheduled booking at exactly the selected offer's stored price. All writes commit/roll back together. Existing create-booking behavior retrieves that already-created booking.
- `QuotationsController` translates business/EF concurrency and SQL unique-key conflicts to HTTP 409 with `code: negotiation_conflict`. Missing/wrong versions also return 409; unauthorized/self actors remain 403. An actual unknown database failure still fails the operation and rolls back.
- DTOs expose author ID, nullable submission time and version; worker summaries expose latest stored author and version. New writes never use chain parity for authorization.

Example:

```json
POST /api/quotations/123/accept
{ "expectedVersion": "AAAAAAAAAAE=" }
```

Counter additionally sends proposedPrice/message. Author/time are derived by the server, so supplied author fields have no effect. This changes the old request protocol intentionally; backend/frontend must be released together.

## SQL and UI enforcement

The single SQL upgrade installs quotation/request rowversion, proposer FK, three unique indexes, status check, immutable-term/parent/provenance trigger and installation stamp. EF models match it; Quotation disables optimized SQL OUTPUT for trigger compatibility. Startup verifies rather than installs F5 structures. See the database note for exact names and legacy refusal.

`marketplaceApi.ts` sends offer versions. `RequestDetailPage` captures the version when a counter form opens and sends the clicked offer's version on acceptance. A 409 shows a visible message, clears stale counter drafts, and refreshes quotations, request state, summaries and bookings. Users review the refreshed offer before another action. Explicit author ID/role controls action availability; unknown legacy authors expose no acceptance/counter action and history labels remain unknown.

`WorkerBookingsTab` initial-submit conflicts also show the message and refresh authoritative summaries/open jobs/bookings. Its existing negotiation links continue opening RequestDetailPage for accept/counter actions. No client-side button is relied on for security.

## Regression evidence

Phase 0's named exploit regression became green. Its only request changes supply the required returned version; safe assertions and the full exploit sequence remain intact. The known-defect manifest is now empty. Two existing F3 event-delivery tests also supply versions; their recipient/privacy assertions are unchanged.

New backend cases cover explicit author forgery, worker/customer counters and exact-price acceptance; self/unrelated customer/worker denial; old IDs, wrong/missing versions; SQL immutability (including case and trailing-space mutation), duplicate heads/children/bookings; two counters, counter-versus-accept, same-offer and competing-worker acceptances; actual SQL constraint-failure rollback including competitor rejection; execution-strategy retry after authoritative state changes; fractional-cent rejection; nine dirty legacy structures, clean inactive migration/reapplication, absent schema and disabled/mismatched guards.

Race tests use separate DbContexts and a SaveChanges barrier: both finish their authoritative reads before either request CAS. Final SQL state must have one winner, no fork, correct request status, one/no booking and consistent head/accepted status. They do not use sleeps or EF InMemory. The rollback test adds a request-specific check constraint only in a generated database and observes SQL error 547 after request/quotation saves.

Six browser tests mount the real request page/dashboard/API client/auth providers. Local HTTP fixtures supply 409 and refreshed state; customer/worker acceptance retries must send the new ID/version, counter conflicts must discard the stale form, initial dashboard conflict must refresh the summary, and unknown provenance has no response action. SQL enforcement is tested separately on the actual SQL Server.

Commands (run from repository root; Chrome selected through `KARIGOR_TEST_BROWSER_CHANNEL=chrome`):

```text
dotnet build Karigor.slnx --configuration Release --no-restore
python scripts/run-security-tests.py --no-build --strict
python -m unittest discover -s scripts/tests -v
npm --prefix karigor-client run typecheck:security
npm --prefix karigor-client run test:security
npm --prefix karigor-client run build
npm --prefix karigor-client run lint
git diff --check
```

Raw reports/logs are ignored under TestResults and karigor-client/test-results/security-browser. Final executed counts are recorded in the appended study log. SQL/browser checks are local; hosted CI/IIS/other browsers are not claimed verified.

## Remaining limits

Local application legacy preflight reports two unknown active offers and deliberately refuses migration; production data is unknown. Closed historical provenance/time remain NULL. Data confirmation, backup, outage and cutover are future authorized operator work.

Notifications occur after commit and can fail; their delivery is not a durable part of agreement creation. A commit acknowledgement lost in transit can leave a committed booking while retry returns conflict; authoritative refresh recovers the state. No request idempotency key/exactly-once response promise was introduced.

Other service-request/booking operations can surface concurrency exceptions if they race an F5 request update; those broader workflows remain outside F5. Scheduling conflicts across separate requests, payment/settlement concurrency and refresh sessions remain separate. The old SQL/EF/startup payment drift was documented, not modernized.

Primary implementation references: [EF concurrency](https://learn.microsoft.com/en-us/ef/core/saving/concurrency), [EF transactions](https://learn.microsoft.com/en-us/ef/core/saving/transactions), [SQL Server trigger/OUTPUT mapping](https://learn.microsoft.com/en-us/ef/core/providers/sql-server/misc). These support the mechanisms; the repository tests establish the local behavior described here.
