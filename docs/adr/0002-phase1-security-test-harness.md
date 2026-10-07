# ADR 0002: Minimal Phase 1 security test harness

- Status: Accepted for the implemented testing foundation only.
- Date: 2026-10-07 (Asia/Dhaka).
- Scope: Order 0; no production remediation.
- Guide: [PHASE1_SECURITY_TEST_HARNESS.md](../testing/PHASE1_SECURITY_TEST_HARNESS.md).
- Study log: [SECURITY_WORKDONE.md](../security/SECURITY_WORKDONE.md).

## Context

The approved plan needs executable evidence for F1/F2/F3/F4/F5/F7 before code changes. Local Windows has SQL Express 2022. Existing backend CI uses Ubuntu; frontend CI uses Node 22. There are no existing test projects/scripts.

The referenced ADR 0001 is empty in this checkout. The approved plan supplies the remediation constraints; this ADR records only the testing decisions actually implemented.

## Decision

Use one net10.0 xUnit project with Layer/Finding/Classification traits. Use WebApplicationFactory<TestAssemblyController> to start the actual API in Production mode without changing Program.cs. Real Identity/JWT, controllers, SQL and MVC execute. Replace only payment transport and test file storage/configuration.

Use unique disposable databases on loopback SQL:
- Existing `.\SQLEXPRESS` locally.
- A SQL Server 2022 service container in Ubuntu CI.
- No Testcontainers/Compose/local Docker requirement.
- Reject remote servers and application catalogs; only generated databases may be dropped.
- Mirror current schema-plus-startup behavior, not invent an authoritative migration framework.

Use a deterministic payment handler with no socket-backed transport, configured receipts/outages and unexpected-call guards.

Use Playwright with one test-only Vite entry to mount the actual map component. One plain-text interaction baseline and one harmless execution probe cover F4. No new production route is introduced and no backend is needed by this component fixture.

Keep safe assertions red for known defects. Backend TRX is evaluated against an explicit exact-name/marker manifest. Only those assertion failures are accounted for. New/setup/skipped/incomplete failures block. Unexpected passes require promotion. Playwright's native expected-failure annotation is set only after setup/action succeeds.

The existing deploy workflow runs a documented unit subset because it has no SQL fixture. Full SQL cases execute in Backend CI. This is not an independent-workflow/branch-protection redesign.

## Alternatives

| Alternative | Decision |
|---|---|
| EF InMemory | Reject as SQL constraint/concurrency evidence |
| SQLite substitution | Defer: semantics differ from SQL Server |
| Testcontainers everywhere | Defer: native local SQL already works; CI services supply one engine |
| Multiple test projects/full testing pyramid | Defer until useful; one project with traits is enough now |
| Browser DOM emulator/copy of popup HTML | Reject for actual script-execution evidence |
| Vitest plus Playwright plus mock framework | Avoid unnecessary layers/dependencies for this small scope |
| Skip known defects | Reject: no executable reproduction |
| Green tests asserting unsafe behavior | Reject as security regression strategy |
| Blanket continue-on-error | Reject: masks unrelated failures |
| Fix production now | Outside authorization |

## Consequences

The raw backend suite is intentionally red. CI's accounting gate can pass while documented vulnerabilities remain. Raw TRX/JSON and summaries preserve that distinction.

The manifest is temporary technical debt: remove an entry as soon as its remediation is verified, without weakening the assertion. Native browser expected failures have the same promotion requirement.

SQL/file fixtures require local permissions and can leave generated orphans after process termination. Normal cleanup was verified. SQL collection serialization avoids test-fake interference; it does not prove business concurrency. Future race tests need separate contexts and coordinated barriers.

Hosted CI/container/managed Chromium execution has not been performed in this session. The implementation is locally verified, not a production safety claim.

## Evidence

- Backend: 16 executed, 6 green baseline passes, 10 expected assertion failures, zero skips.
- Strict F1: 2 passes and 4 failures; exit 1.
- Classifier unit tests: 6 passes.
- Browser: 1 baseline pass and 1 expected XSS assertion failure.
- Solution build and browser-fixture typecheck passed.
- Frontend build/lint exited zero with existing warnings.
- No production source/database scripts or F6 code changed.

See the guide for commands, individual test contracts, environment and remaining coverage gaps.
