# F1 Payment Trust and Provider Verification

Date: 2026-10-07 (Asia/Dhaka).
Scope: immediate F1 containment from the [approved plan](../PHASE1_SECURITY_REMEDIATION_PLAN.md), using the [Order 0 harness](../../testing/PHASE1_SECURITY_TEST_HARNESS.md).
Status: locally verified containment. This is not completion of the later payment concurrency/idempotency phase or verification of production financial history.

The final strict F1 run executed **47 cases: 47 passed, zero failed/skipped**. The five payment-return browser cases passed. The full backend gate executed 57 cases: 51 passed and six unrelated known assertions failed. Those remaining exceptions are explicit, not skipped.

## 1. Problem and original failure

The callback is an HTTP request from outside Karigor. Its sender can claim VALID, supply a booking in ValueA, or edit a browser URL. None of those actions proves that money moved.

Previously, success/IPN optionally called the provider but accepted caller VALID even after an exception. Amount checking allowed a difference below one taka and accepted missing/malformed amounts. Provider transaction/currency were not bound to the selected payment. An unknown transaction could select a booking's newest attempt through ValueA. Receipt fields came from the caller. Fail/cancel paths could directly mark records Failed/Cancelled.

Example: an Initiated BDT 1,000 attempt receives VALID without ValId. The old code sets Payment.Completed and Booking.Paid without making a verification request. The unchanged Phase 0 assertion reproduced this locally before remediation.

The return page separately treated status=success as verified payment, displayed caller amount/transaction, and claimed an artisan payout. A payment receipt is not evidence that Karigor executed a payout.

## 2. Requirements and invariants

**A new Completed payment and Paid booking require an independently verified provider result bound to the exact stored attempt.**

Additional rules:
- Only the exact stored TransactionId selects the attempt. ValueA never selects or substitutes.
- A successful HTTP response and recognized VALID/VALIDATED result are necessary, not sufficient.
- Provider TranId, BDT Currency and exact decimal Amount must match the attempt.
- Receipt fields come from that bound provider response.
- Missing/malformed/mismatched/unavailable proof changes no financial state.
- A timeout is an unknown external outcome, not success or proof of failed payment.
- Late hints cannot downgrade an existing completion.
- Browser confirmation comes from the authenticated, authorized backend summary.

These rules apply to every ingress path. They do not assert one settlement allocation or one notification under concurrent requests.

## 3. Previous architecture

Customer initiates an owned completed booking
-> save Initiated attempt
-> create gateway session
-> receive anonymous callback
-> optional provider check
-> accept caller fallback or booking fallback
-> save Completed/Paid and caller receipt
-> notify/broadcast
-> browser trusts URL success.

Sandbox credential errors could also silently switch both initiation and verification to the shared test store. That made configured merchant identity unreliable.

## 4. Implemented architecture

The existing monolith, provider client, SQL model and public route names remain.

1. Success, fail, cancel and IPN all call PaymentService.ProcessVerifiedCallbackAsync.
2. Require TranId and query Payments by that identifier.
3. After SQL lookup, compare identifiers using StringComparison.Ordinal. SQL collation can otherwise ignore case/trailing spaces.
4. If an exact payment is already Completed, return its existing record without changing it. This protects sequential late callbacks, not business concurrency.
5. Otherwise require ValId and call the configured provider validation endpoint using configured credentials.
6. Require successful HTTP and parseable non-null JSON. Provider errors produce an unresolved-verification exception.
7. Validate status and exact attempt binding before any write.
8. Persist provider-derived ValId, BankTranId, CardType and serialized validation DTO; record the local verification time in PaidAt.
9. Set Payment.Completed and Booking.Paid in one EF SaveChangesAsync. EF's SQL transaction covers these writes; no provider call runs inside it.
10. Keep the existing post-commit notification/broadcast behavior. Correct its unsupported payout wording; delivery policy remains F3 work.
11. Browser callbacks return a truthful redirect page. The SPA then independently reads /api/payments/booking/{id} with the user's Bearer token.
12. The page ignores URL status, amount, transaction and receipt fields. It confirms only a returned Completed record with PaidAt, shows backend values, and offers a status-read retry.

The browser fixture mounts the actual page, router, query client, auth context and API client. It mocks local HTTP rather than payment decision code. Auth-triggered SignalR negotiation is deliberately answered with local 404; associated console messages are fixture noise, not a live hub test.

### Verification contract

| Input/result | Rule |
|---|---|
| Callback TranId | Required exact stored identifier; no ValueA/booking fallback |
| Callback ValId | Provider lookup hint; must be nonempty and match the returned validation ID |
| Callback status, amount, currency, bank/card and ValueA | Never establish success or overwrite authoritative receipt fields |
| Provider HTTP | Require 2xx; non-success response never becomes a receipt |
| Provider status | Exactly VALID or VALIDATED |
| Provider TranId | Ordinal match to stored TransactionId |
| Currency | Stored attempt must be BDT; provider Currency must exactly match |
| Amount | Positive invariant decimal, digits with optional one/two fractional digits, at most 32 characters, exactly equal to TotalAmount |
| Receipt shape | Nonempty ValId, at most 100 characters; bank/card fields must fit existing 100-character columns if present |

Amounts such as 999.99 and 1000.01 cannot settle a 1000.00 attempt. Grouping, exponent notation and excess fractional precision are rejected rather than rounded. This also prevents decimal parsing from rounding an extremely precise near-match into equality.

Karigor currently initiates BDT only. This does not add foreign-exchange support; the provider's original-currency fields would require a deliberate contract change before supporting other currencies.

The provider's public [integration/validation documentation](https://developer.sslcommerz.com/doc/v4/) was consulted for recognized statuses, amount formatting and verification flow. Only public documentation was accessed; no gateway transaction endpoint was contacted.

### HTTP and stored-state policy

| Condition | Browser return | IPN | Financial state |
|---|---|---|---|
| Bound success | Confirmed redirect; SPA re-fetches | 200 | Completed/Paid committed together |
| Missing transaction | Not confirmed; dashboard lookup available | 400 | Unchanged |
| Unknown/non-exact transaction | Not confirmed; no callback booking fallback | 404 | Unchanged |
| Missing ValId or unbound/invalid provider receipt | Pending/not confirmed; exact stored booking hint when available | 422, status unresolved | Unchanged |
| Provider network/timeout/non-2xx/malformed/null response | Pending/not confirmed | 503, status unresolved, Retry-After: 30 | Unchanged |
| Database processing failure | Not confirmed | 503, status unresolved | No success response; tested constraint failure rolls back both updates |
| Existing exact Completed payment | Return existing completion | 200 | No downgrade or receipt overwrite |

UNKNOWN/UNRESOLVED is a decision outcome, not a new database enum. New attempts remain Initiated until verified. Existing historical statuses are preserved. Failure/cancellation hints are not finalized into Failed/Cancelled in this task, even when an unverified provider reply says FAILED.

Retry-After is advisory. Actual SSLCommerz redelivery rules, merchant configuration and recovery behavior were not tested. An IPN 503 is not a reconciliation mechanism.

Authenticated summary reads retain participant ownership checks, explicitly return 403 for a nonparticipant and 404 for a missing record, and set Cache-Control: no-store. The React query key includes user ID and booking ID. Signed-out users are asked to sign in; an error cannot fall back to URL success.

## 5. Before versus after

| Before | After |
|---|---|
| Caller VALID could survive failed/no validation | Only a bound authoritative receipt can create completion |
| Unknown transaction + ValueA picked a payment | Exact transaction only, including case/space guard |
| Missing or slightly wrong amount could pass | Required exact decimal equality |
| Callback supplied receipt facts | Bound provider supplies receipt facts |
| Timeout could become Completed or Failed | State unchanged; unresolved outcome |
| Fail/cancel directly finalized records | Same independent verifier; hints alone do not finalize |
| URL success made the page claim verification | Authenticated backend status controls confirmation |
| UI/notification claimed a payout | Payment confirmation explicitly does not prove payout |

## 6. Why this design was chosen

A trust boundary is where untrusted input reaches a decision with authority. This design closes that boundary before changing database architecture.

| Alternative | Considered because | Rejected/deferred because |
|---|---|---|
| Delete only caller VALID fallback | Small diff | Does not repair transaction/currency/amount binding, fail/cancel or UI trust |
| Require customer JWT on provider callbacks | Existing authentication | Provider notifications do not have customer sessions; does not verify financial truth |
| Trust a callback signature/IP allowlist alone | Could authenticate message origin | Binding still required; actual provider contract/configuration not established |
| Finalize Failed after a timeout | Simple terminal workflow | Unknown provider outcome is not proof of no charge |
| New Unresolved enum/table | More explicit persistence | Existing Initiated plus unresolved response suffices for containment; no schema prerequisite |
| Silent sandbox test-store fallback | Convenient demonstrations | Changes merchant identity; configured credential failure must remain failure |
| Full allocation/rowversion/idempotency/reconciliation/outbox | Needed for later consistency guarantees | Explicitly outside current scope; cannot delay immediate trust fix |
| Provider call inside DB transaction | Seems atomic | SQL cannot atomically commit with a remote gateway; holds locks during network latency |

The implementation follows the approved immediate F1 plan. ADR 0001 is zero bytes in this checkout and was left untouched. No unrelated proposed decision was marked Accepted/Implemented.

## 7. Concepts and failure handling

**Fail closed** means deny a privileged transition when proof is missing. Here it means no Paid, not pretending the provider proved a failed charge.

**Server-side verification** means Karigor asks the configured provider through its own authenticated connection instead of accepting the caller's story.

**Authoritative state** means the backend's verified record controls local booking/UI decisions. It does not make the database a substitute for the bank, or validate old records retroactively.

**External-system uncertainty** means a request can time out even if the remote operation succeeded. Keep the outcome unresolved and avoid telling the customer no charge occurred.

**Atomicity** means linked SQL writes commit or roll back together. It is different from idempotency, which means retrying an intent has one business effect.

| Failure/scenario | Behavior and evidence |
|---|---|
| SQL rejects booking write | Actual fixture CHECK failure returned 503 and left payment/booking/receipt unchanged |
| Two callbacks overlap | Both may verify and notify; no rowversion/settlement allocation guarantee added |
| Provider timeout/network/malformed body | No success/failed write; fake cases prove missing proof does not grant authority |
| User sends forged receipt/status/ValueA | Exact lookup/binding ignores those fields; committed receipt provenance tested |
| Client retries status read | Explicit browser retry can recover after HTTP 503; no new payment is initiated by this button |
| Payment initiation retry after uncertainty | Existing code can create another attempt; intentionally deferred |
| Sequential callback after completion | Existing record preserved, including PaidAt/receipt; tested |
| Notification/hub fails after commit | Existing best-effort handling keeps database truth; no durable retry added/tested |
| User signed out or summary access denied | No confirmation fallback; guest browser and real API ownership cases tested |
| Historical Paid rows were created by old code | No migration/audit/repair performed; current UI reports stored completion, not retroactive verification |

## 8. Database and security implications

No production SQL script, model, migration, constraint, index or column changed.

- The existing unique TransactionId index remains; the real SQL uniqueness baseline still passes.
- Application ordinal comparison supplements SQL collation behavior.
- Payment and booking updates use the existing EF transaction for one SaveChanges call.
- No rowversion, selected settlement, allocation, initiation key or reconciliation metadata was added.
- A temporary CHECK exists only within the generated test database to force a booking-write failure. It is dropped in finally; normal database cleanup removes the fixture.
- Provider HTTP executes before SQL save. This task does not hold a database transaction across a network request.

PaymentReceived still uses the existing global broadcast. Confidential event routing is F3 and is not claimed fixed. Negotiation integrity is also unchanged: provider binding cannot prove customer consent to a price corrupted by F5.

Verification errors no longer log raw malformed receipt bodies or echo internal exception text to the browser. This is not a complete log/PII audit; existing initiation and HTTP instrumentation still need operational review.

## 9. Test inventory and what each case proves

All F1 tests now assert safe behavior as normal green tests. Four Phase 0 assertions were preserved verbatim, promoted to GreenBaseline, and removed from the manifest only after observed passes. No unresolved test was skipped or relabeled green.

| Test name | Cases | Setup | Action | Expected result | Invariant | Layer / why |
|---|---|---|---|---|---|---|
| CallerValidStatusAloneCannotSettlePayment | 1 (promoted) | Initiated BDT attempt; no provider configured | POST success with caller VALID and no ValId | Neither Completed nor Paid; zero provider calls | A caller flag cannot grant payment authority | HTTP + real SQL; checks persisted effect |
| UnavailableProviderCannotFallBackToCallerValid | 1 (promoted) | Fake network exception; Initiated attempt | POST success with VALID and ValId | Neither Completed nor Paid; one fake call | An outage is not success | HTTP + SQL; proves former fallback is gone |
| ReceiptForAnotherTransactionCannotSettlePayment | 1 (promoted) | Fake valid receipt names another transaction | POST success naming this attempt | Neither Completed nor Paid | Receipt identity binds the exact attempt | HTTP + SQL; protects cross-transaction settlement |
| ReceiptWithWrongCurrencyCannotSettlePayment | 1 (promoted) | BDT attempt; fake USD receipt | POST success | Neither Completed nor Paid | Currency is part of payment identity | HTTP + SQL; amount alone is insufficient |
| MatchingProviderReceiptUpdatesPaymentAndBooking | 1 existing baseline | Matching VALID receipt | POST success | Completed and Paid; one fake call | Valid payment still works | HTTP + SQL; protects legitimate processing |
| SqlServerRejectsDuplicatePaymentTransaction | 1 existing baseline | Existing legitimate transaction | Insert duplicate TransactionId | SQL 2601/2627 | Transaction identifier remains unique | Real SQL; checks actual constraint |
| UntrustedCallbackRoutesLeavePaymentUnresolved | 3: fail, cancel, ipn | Initiated payment; no provider receipt | Send VALID without ValId to each route | State and receipt fields unchanged; IPN 422; browser not confirmed | Route names/caller status cannot finalize money | HTTP + SQL; covers other ingress paths |
| BrowserGetCallbackRequiresTheSameProviderVerification | 3: success, fail, cancel | Fresh attempt on each route | GET VALID without ValId, then GET FAILED with a matching receipt | First unresolved; second Completed/Paid and confirmed | Query hints obey the same verification boundary | HTTP + SQL; verifies declared GET compatibility |
| UnknownOrNonExactTransactionCannotUseBookingFallback | 6: unknown on all four routes; case/space on success | Known booking and configured matching receipt | Send unknown/non-exact transaction plus real ValueA | No provider call or mutation; unknown IPN 404 | ValueA and SQL collation cannot select another attempt | HTTP + SQL; exercises actual query semantics |
| MalformedOrUnboundProviderReceiptLeavesPaymentUnresolved | 14 cases (listed below) | Configured provider JSON with one invalid field | POST IPN | 422; Initiated/Unpaid; no authoritative receipt fields | Incomplete or mismatched proof grants no authority | HTTP + SQL; tests parser and decision together |
| ProviderTransportOrParseFailureLeavesPaymentUnresolved | 4: timeout, non-2xx HTTP, invalid JSON, JSON null | Fresh attempt; deterministic fake failure | POST IPN | 503 with Retry-After; unchanged financial state | Unknown external outcome is not Paid or Failed | HTTP + SQL; no external network |
| VerifiedProviderFieldsOverrideCallbackHints | 1 | Matching provider receipt; forged callback bank/card/amount/currency/ValueA/status | POST IPN | Provider receipt fields stored; Completed/Paid; no forged values | Only verified provider facts become authoritative | HTTP + SQL; checks persisted provenance |
| EveryRouteCanRecordOnlyProviderBoundSuccess | 3: fail, cancel, ipn | Bound VALIDATED receipt; callback says CANCELLED | POST each route | Completed/Paid from provider; one call | Success is a provider fact, independent of route | HTTP + SQL; covers repeated-validation status |
| LateCallbacksCannotDowngradeVerifiedSuccess | 3: fail, cancel, ipn | First complete through a verified success; reset fake | Send late FAILED without a receipt | Completion, PaidAt and stored receipt preserved; no provider call | A later hint cannot erase confirmed success | HTTP + SQL; sequential ordering, not race proof |
| ParticipantsCanReadAuthoritativeSummaryButStrangersCannot | 1 | Verified payment; customer/worker/stranger JWTs | GET summary as both participants, stranger and guest | 200/no-store for participants; stranger 403; guest 401 | UI reads are authenticated and resource-authorized | HTTP + SQL; real JWT/ownership checks |
| DatabaseWriteFailureCannotPartiallyCompletePaymentAndBooking | 1 | Temporary fixture-only CHECK rejects this booking's Paid update | Verify receipt and POST IPN | 503; payment Initiated and booking Unpaid; receipt not committed | Payment and booking commit together | Real SQL; proves rollback on save failure |
| SandboxCredentialErrorNeverSwitchesMerchant | 2: initiation, validation | Configured sandbox client; fake credential error | Call provider client | Exactly one request to configured merchant; no testbox retry | Merchant identity must not silently change | Unit with actual client + fake transport; no SQL needed |
| F1: forged success URL cannot confirm an unresolved payment | 1 | Actual return page/auth client; HTTP summary Initiated | Open status=success plus forged amount/transaction | Not confirmed; backend details only; Bearer header sent | URL hints cannot grant UI confirmation | Browser component; executes actual page |
| F1: backend completion wins over failure URL and forged receipt details | 1 | Backend Completed/PaidAt summary | Open status=failed with forged receipt fields | Confirmed; backend transaction and BDT 1,000; no payout claim | Backend record controls presentation | Browser component; protects valid user flow |
| F1: backend outage remains unconfirmed and an explicit status retry can recover | 1 | First summary response 503; next Completed | Open forged success, then click status retry | Initially not confirmed; then confirmed; two reads | An outage is unresolved, not no-charge proof | Browser component; proves error/retry behavior |
| F1: denied summary cannot be replaced by URL success | 1 | Summary HTTP 403 | Open status=success | Not confirmed; no receipt details | Authorization failure has no client fallback | Browser component; actual API-error handling |
| F1: signed-out return asks for sign-in and does not fetch payment details | 1 | Auth refresh denied | Open status=success | Sign-in prompt; zero payment reads | No anonymous claim of authenticated payment truth | Browser component; actual auth context |

The fourteen invalid-field cases are:
- amount: null, empty, invalid text, 999.99, 1000.01, 1,000.00, 1e3, 1000.0000000000000000000000000001;
- tran_id: null;
- currency: null;
- val_id: null or another-validation;
- status: FAILED or INVALID_TRANSACTION.

The original wrong-transaction and USD cases remain separate named tests. Positive VALID and VALIDATED provider paths remain covered. These are selected immediate-containment cases, not the entire future F1-T1 through F1-T9 program.

## 10. Commands and actual results

Commands actually executed during this task:

```text
python scripts/run-security-tests.py --no-build --strict --filter "Finding=F1"
dotnet build Karigor.slnx --configuration Release --no-restore
dotnet test tests/Karigor.Security.Tests/Karigor.Security.Tests.csproj --configuration Release --filter "Finding=F1" --logger "trx;LogFileName=f1-after.trx" --results-directory TestResults/f1
dotnet test tests/Karigor.Security.Tests/Karigor.Security.Tests.csproj --configuration Release --filter "FullyQualifiedName~BrowserGetCallbackRequiresTheSameProviderVerification" --logger "trx;LogFileName=f1-get.trx" --results-directory TestResults/f1
python scripts/run-security-tests.py --no-build
python scripts/run-security-tests.py --no-build --filter "Layer=Unit"
python -m unittest discover -s scripts/tests -v
npm --prefix karigor-client run typecheck:security
npm --prefix karigor-client run test:security
npm --prefix karigor-client run build
npm --prefix karigor-client run lint
```

The strict F1 command was run before and after remediation. Initial run: two passes/four safe-assertion failures, exit 1. Intermediate raw F1 run: 44 passes; added GET subset: three passes. Final strict run: 47 passes, zero failures/skips, raw/gate exit 0.

| Final check | Actual result |
|---|---|
| Solution build | Passed, zero warnings/errors |
| Strict F1 backend | 47 passed; no expected failures |
| Full backend runner | 57 executed: 51 passes, 6 exact unrelated expected failures, zero skips; raw dotnet exit 1, gate exit 0 |
| Deployment-style unit subset | 6 executed: 4 passes, 2 known F7 failures; gate exit 0 |
| Classifier self-tests | 6 passed; classifier code unchanged |
| Browser security suite | 6 actual passes, 1 expected F4 assertion failure; no skips/unexpected failures; process exit 0 |
| Browser fixture typecheck | Passed |
| Frontend build | Passed; existing Vite config/bundle warnings |
| Frontend lint | Exit 0; 21 existing warnings, none introduced by these F1 files |
| Final diff/document/scope checks | Passed; only the five intended F1 production files changed, approved plan/ADR untouched, prior study entry preserved |
| SQL fixture cleanup | Read-only sqlcmd count: zero generated fixture databases remain |

The first build reported a fixture SQL-interpolation warning. The final version formats only a generated typed integer for the CHECK literal; final builds have no warnings.

Backend reports are ignored local artifacts:
- pre-fix strict: TestResults/security/20c6c345baa44fb883e345da4d28f451/security.trx;
- final strict: TestResults/security/8b5c759f1b4a4d7093f8d71a015dd1ab/security.trx;
- final full: TestResults/security/317104640e1842139532d47591b22d12/security.trx.

Browser JSON/traces are under karigor-client/test-results/security-browser. Playwright reports “7 passed” because its F4 expected-failure annotation matched. The F4 assertion actually fails; it is not remediation evidence.

Local commands used the installed Chrome channel with KARIGOR_TEST_BROWSER_CHANNEL=chrome and the real Node/npm installation prepended to PATH. No dependency/package/CI changes were necessary for F1; existing harness discovery already includes the new tests.

git diff --check and final documentation/report/scope checks passed. A read-only sqlcmd query found zero generated fixture databases. GitHub-hosted CI, actual gateway retry behavior and production deployment were not run.

## 11. Files changed in this task

| File | Change | Reason |
|---|---|---|
| backend/Karigor.Application/Payments/PaymentService.cs | One verifier for success/fail/cancel/IPN; exact lookup/binding; provider-only receipts; leave uncertainty unchanged; correct payout wording | Remove payment trust bypass without redesigning initiation or settlement allocation |
| backend/Karigor.Application/Payments/PaymentVerificationException.cs | Small unresolved-verification exception carrying stored booking ID and retryability | Keep browser/IPN outcomes honest without a schema or new stored state |
| backend/Karigor.Application/Payments/SslCommerz/SslCommerzClient.cs | Require successful HTTP; dispose responses; remove merchant fallbacks; avoid raw malformed validation logging | A failed call or another sandbox merchant is not authoritative proof |
| backend/Karigor.Api/Controllers/PaymentsController.cs | Consistent browser handling; IPN 400/404/422/503; safe redirect encoding; no-store summary and explicit 403/404 | Expose unresolved outcomes and support authorized status reads |
| karigor-client/src/pages/PaymentCallbackPage.tsx | Fetch authenticated summary; ignore URL status/receipt; conservative errors/sign-in; explicit status retry; remove payout/charge claims | Present backend truth rather than caller hints |
| tests/Karigor.Security.Tests/PaymentSecurityTests.cs | Preserve/promote four regressions; add receipt/route/GET/provenance/ownership/SQL rollback cases | Verify immediate F1 containment |
| tests/Karigor.Security.Tests/SslCommerzClientSecurityTests.cs | Two sandbox merchant-boundary cases | Prove credential errors never switch stores |
| tests/Karigor.Security.Tests/Infrastructure/FakePaymentHandler.cs | Add timeout/HTTP/body/initiation modes and captured request metadata | Deterministic evidence with no socket-backed transport |
| tests/known-security-defects.json | Remove exactly four verified F1 exceptions; retain six unrelated defects | Make F1 a normal blocking gate |
| karigor-client/e2e/fixtures/payment.html | Test-only browser entry | Mount the real return page outside production routing |
| karigor-client/e2e/fixtures/payment.tsx | Actual router/query/auth/theme/page fixture | Reuse existing stack without copying decision logic |
| karigor-client/e2e/payment.security.spec.ts | Five browser regressions with local mocked HTTP and external requests blocked | Prove URL/error/auth presentation boundaries |
| docs/testing/PHASE1_SECURITY_TEST_HARNESS.md | Add current F1 status note; preserve Order 0 evidence | Avoid confusing historical red results with current F1 state |
| docs/security/SECURITY_WORKDONE.md | Append dated F1 study entry; preserve previous history | Explain what changed and what was actually proved |
| docs/security/implementation/F1_PAYMENT_TRUST_AND_VERIFICATION.md | Create final implementation/verification guide | Record architecture, tradeoffs and deferred work |

Preexisting uncommitted Order 0 changes were preserved. This table lists this F1 task's changes, not every dirty file relative to main.

## 12. Remaining risks and intentionally deferred work

Immediate containment is locally verified by executed tests; broader payment consistency is not.

Deferred to the approved later payment-concurrency phase:
- stable initiation/idempotency identity and request fingerprints;
- immutable per-attempt merchant/environment/session metadata;
- rowversions/conditional transitions and coordinated race tests;
- one selected settlement/allocation while retaining a second real payment for review;
- durable notification identity and delivery recovery where required;
- querying/reconciling unknown outcomes without blind re-initiation;
- schema ownership/preflight and reviewed migrations;
- accurate summary selection when multiple attempts exist.

Other limitations:
- Sequential completion protection is not exactly-once settlement or notification.
- Historical Completed/Paid rows may lack valid provenance; no production read/cleanup occurred.
- Current summary returns the latest attempt, which can conceal an earlier settlement.
- Actual provider risk flags, FX/original-currency fields, chargebacks/refunds, retry cadence and merchant cutover remain unverified/out of scope.
- Rejecting unverified failure/cancel leaves some abandoned attempts Initiated; no automatic cleanup was added.
- Strict decimal/identity checks can leave previously tolerated receipts unresolved. This is deliberate compatibility containment.
- Callback responses remain anonymous. Existing rate limits apply, but no new anti-abuse/callback-signature layer was added.
- PaymentReceived confidentiality, F5 price integrity and F6 sessions remain separate findings.
- Browser tests use controlled HTTP and Chrome, not a live gateway/API/browser checkout journey.
- No commit, push, merge, deployment, credential rotation or production payment call was performed.

## 13. Educational scaling discussion

| Scale | What would change if measurements required it |
|---|---|
| 100 users | Keep this API/SQL design; monitor unresolved attempts and verify merchant configuration |
| 10,000 users | Measure callback volume, provider latency/rate limits and query plans; prioritize the already-planned idempotency/reconciliation guarantees |
| 1,000,000 users | Educational concerns include gateway capacity, settlement reconciliation throughput and durable delivery; choose changes from workload evidence |

At every scale, callback hints remain untrusted. This task adds no broker, cache, lock service or large-scale redesign.

## 14. Flow diagrams

```mermaid
sequenceDiagram
    participant Caller as Callback caller
    participant API as PaymentsController
    participant Service as PaymentService
    participant DB as SQL Server
    participant Provider as Configured provider
    Caller->>API: Success / fail / cancel / IPN hints
    API->>Service: Same verification boundary
    Service->>DB: Exact transaction lookup
    DB-->>Service: Stored attempt and booking
    alt Already Completed
        Service-->>API: Existing completion, unchanged
    else Not Completed
        Service->>Provider: Validate ValId with configured merchant
        Provider-->>Service: Receipt or error
        alt Missing / unavailable / mismatched proof
            Service-->>API: Unresolved exception; no write
            API-->>Caller: Not confirmed or IPN 4xx/503
        else Matching VALID or VALIDATED receipt
            Service->>DB: One SaveChanges: Completed + Paid + provider receipt
            DB-->>Service: Commit or rollback
            Service-->>API: Completed only after commit
            API-->>Caller: Recorded completion
        end
    end
```

```mermaid
sequenceDiagram
    participant Browser
    participant Page as PaymentCallbackPage
    participant API as Authenticated summary API
    participant DB as SQL Server
    Browser->>Page: URL includes status/amount hints
    Page->>API: GET booking payment with Bearer token
    API->>DB: Check participant and load record
    DB-->>API: Authorized summary
    API-->>Page: Summary or denial/unavailable
    alt Completed with PaidAt
        Page-->>Browser: Confirmed; backend values
    else No trustworthy completed summary
        Page-->>Browser: Not confirmed / sign in / retry status read
    end
```

## 15. Interview explanation

### 30 seconds

Karigor trusted a callback's VALID flag after failed or missing provider verification. I replaced that fallback with one verifier for all callback routes. It requires a matching provider transaction, BDT currency and exact decimal amount before saving Completed and Paid together. The return page reads authenticated backend state. Existing red regressions now pass, while concurrency/idempotency remain separate work.

### Two minutes

The original issue was a trust-boundary failure. An anonymous HTTP caller could name an existing attempt and claim VALID, and the server accepted that claim after a provider exception. Even successful verification did not bind transaction/currency and allowed incomplete or slightly wrong amounts. ValueA could select a different stored attempt.

I kept the current application and schema. Every callback route now uses exact stored transaction lookup followed by server-to-server validation using configured merchant credentials. A valid status alone is insufficient: transaction, currency and decimal amount must match, and receipt facts come from the provider. Unknown results leave state unchanged. One EF save commits payment and booking updates together; an actual SQL fault test proves rollback.

The page also stopped trusting query-string success and caller receipt values. It reads an authenticated participant-only API summary, handles outages conservatively and retries status reads without starting another charge.

We used disposable SQL and a deterministic provider fake. The four original safe assertions changed from red to green without weakening them, and additional receipt/route/ownership/browser cases passed. The tradeoff is delayed confirmation during uncertainty. This does not promise exactly-once settlement, safe simultaneous callbacks or production-history repair; those require the later consistency phase.

### Five questions

1. **Why isn't an IPN automatically trusted?** It is still an incoming HTTP request. Independently verify the provider result and bind it to the stored attempt.
2. **Why exact decimal comparison?** A one-paisa mismatch is still different money. Defined formatting avoids float/rounding/tolerance mistakes.
3. **What does a timeout mean?** We do not know the provider outcome. Do not mark Paid or declare no charge; reconcile later.
4. **Why is SaveChanges not idempotency?** It atomically writes this payment/booking pair. Concurrent or repeated commands can still create multiple business effects.
5. **What did tests prove?** The immediate local trust boundary, valid paths, rollback and browser presentation. They did not prove gateway operations, settlement allocation or concurrent exactly-once behavior.
