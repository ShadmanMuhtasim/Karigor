# Phase 1 MonsterASP deployment runbook

Prepared: 2026-10-08, Asia/Dhaka. **Current decision: NOT SAFE TO PROCEED.**

This runbook describes a future authorized release. It was not executed against production. Do not deploy, run its apply commands, restore a database, rotate credentials or move files merely because this document exists. First complete the [preflight](PHASE1_MONSTERASP_DEPLOYMENT_PREFLIGHT.md), including a production evidence record, an isolated rehearsal and all GO conditions.

## 1. Release worksheet and responsibilities

Assign a release operator, SQL/backup operator and tester; one student may hold all three roles but should have a supervisor review the evidence. Use an approved private operational record, never a secret-filled Markdown file.

| Field | Fill before maintenance |
|---|---|
| Release revision and backend/frontend artifact SHA-256 | `<IMMUTABLE_REVISION_AND_HASHES>` |
| Old artifact and protected configuration location | `<PROTECTED_RECOVERY_LOCATION>` |
| Target site/database identity; current/final markers | `<SITE_DB>`, `<CURRENT>` → F5 1 / Payment 2 / F6 1 |
| Applicable scripts and their hashes | `<APPROVED_CONDITIONAL_SEQUENCE>` |
| Legacy-data resolution record | `<REVIEW_AND_REHEARSAL_REFERENCE>`; no unresolved blocker |
| Maintenance start/end | `<ASIA_DHAKA_TIMES>` plus UTC; include sign-in reset announcement |
| Writer fence and tester-only access mechanism | `<VERIFIED_HOST_METHOD>` |
| Final backup/download/hash/separate copy | `<BACKUP_JOB_AND_RECORD>` |
| Restoration rehearsal and rollback credential plan | `<RESTORE_PROOF_AND_APPROVAL>` |
| Private directory and preserved file manifest | `<VERIFIED_PRIVATE_PATH_AND_MANIFEST>` |
| Pending provider/callback reconciliation owner | `<AUTHORIZED_OPERATOR>` |
| Log access, observation interval and abort deadline | `<OWNER_AND_APPROVED_INTERVAL>` |

No generic deployment button meets these requirements automatically. The existing push/main workflow has no maintenance, migration, forced-reset or smoke approval gate and only warns on health failure. Fence automatic deployment and queued runs through an authorized operator before the release; do not edit/trigger GitHub or hosting in this preparation task.

## 2. Rehearse and package before the outage

1. Restore an authorized backup into an isolated non-production database with sensitive-data controls. Its application must not reach live gateway endpoints or serve real users. Capture preflight/data findings, backup/restore duration and actual schema behavior. A copy with legacy Payments still encounters SQL 007's hard refusal; do not empty it to disguise the blocker.
2. Build from the reviewed immutable revision. Include frontend output in the backend's `wwwroot` using the existing workflow's build/publish steps **without invoking its deploy step**. Inspect `Karigor.Api.dll`, dependencies/runtime metadata, published `web.config`, `wwwroot/index.html` and matching hashed assets. Ensure published launcher placeholders were transformed and .NET 10 support was verified.
3. Run the release's local/CI gates in their guarded local environments: Release build, `python scripts/run-security-tests.py --strict`, frontend typecheck/build, security browser suite and classifier checks. Consult the test harness for setup; never point fixtures at a hosted/application DB. Existing local evidence is 248 backend/49 browser passes, not a new execution in this preparation task.
4. Hash/review SQL files and determine which apply to production. Rehearse the exact conditional sequence and all read-only gates. Keep original baseline/history/financial evidence intact; use the current SQL-first path rather than old EF migrations.
5. Verify configuration key presence and effective precedence using the preflight checklist. Arrange HTTPS, same-origin frontend, private directory/ACLs, logs and maintenance access restrictions. Prove deployment preserves a synthetic private document outside public roots with the same action/options. `MsDeploySkipRules` in the project do not by themselves prove directory-package preservation.
6. Decide how expired/in-flight gateway sessions and callbacks are handled during downtime. Establish retry/reconciliation behavior from the merchant/provider contract through the authorized owner. Do not assume that an HTML maintenance response with status 200 will cause the gateway to retry. Pausing the app does not cancel a checkout already open at the provider.
7. Prepare dedicated accounts/test request/document/message IDs and isolated sandbox data. Complete gateway-changing/rotation tests in staging. No test in this runbook requires real money, shared-host scanning, brute force or load generation.

## 3. Maintenance window: exact order and stop points

Steps in this section are for the future approved window. If an expected check fails, keep the writer fence closed and use the rollback matrix; do not continue on assumptions.

1. **Announce maintenance.** Publish the approved downtime and that every existing user must sign in again after F6. Explain that drafts may need refreshing and payments in progress will be reconciled. Record the operator and time.
2. **Stop/disable all application writers.** Cover every old backend instance, background/scheduled task, direct SQL writer and provider callback route. A maintenance page alone is insufficient unless the backend actually stops. MonsterASP documents the panel Stop control / `app_offline.htm`; confirm the **actual IIS application root** first and verify the process stopped. The panel's folder named wwwroot is not necessarily the ASP.NET public ContentRoot/wwwroot. Do not place the file by guessing. [MonsterASP offline procedure](https://help.monsterasp.net/websites/deploy/app-offline).
3. **Verify deployment exclusion.** Check running and queued Actions/WebDeploy/Git deploy/panel operations; prevent a queued old release from starting. The workflow concurrency group covers only that workflow and can leave runs queued. Confirm old sockets/requests have drained and no writer remains. A UI message or elapsed delay is not proof.
4. **Take the final backup at the frozen point.** Create/download full BAK, record completion UTC/Dhaka timestamps, verify size/hash/readability and separate copy. Capture private/legacy files, config and old artifact with consistent manifest. Confirm restore proof and approved recovery limits. Do not migrate without these.
5. **Run final read-only preflight.** Use a new read-only connection, explicitly confirm target, execute supplemental inventory and each applicable default canonical preflight. Capture all findings/errors. Use the version-aware rules: never 006 on Payment v2; installed 007/008 status messages need exact gates. Do not print hashes/secrets or autofix findings.
6. **Confirm GO in the worksheet.** No unresolved Review/Blocker, understood schema path, final backup, no writers, secrets/host/storage verified, paired artifact, forced-reset communication and recovery plan. **Any legacy v1 Payment row makes the standard 007 path NO-GO.** A separate approved/rehearsed migration must already exist before this point if such data is present. Close the window safely if GO is unavailable.
7. **Apply only the approved schema upgrades.** Use a separate authorized migration connection, intended database and full files in dependency order below. Fresh empty database only: baseline 001 and optional 002 first. Existing databases skip understood installed prerequisites. Stop at any SQL exception or unexpected result. Per-script transactions do not make the whole 005–008 sequence one transaction.
8. **Validate schema before hosting.** Open another read-only connection; execute the [exact schema gate snapshot](sql/PHASE1_SCHEMA_GATES_READ_ONLY.sql), final markers/metadata and supplemental financial/F6 checks. No disabled/untrusted guard, no unexpected partial install. Confirm four booking verification columns too. Migration flag sessions must be closed.
9. **Deploy the new backend while access remains blocked.** Use the reviewed artifact, correct runtime/config and demonstrated upload preservation. Ensure the chosen tool cannot remove the maintenance fence or restart/publicly expose the app prematurely. Validate hashes/paths/config persistence. A host that cannot keep that fence through deployment is a prerequisite blocker.
10. **Deploy the matching frontend.** It is normally embedded in the same artifact. Confirm index.html and assets agree; invalidate only the approved CDN/static-cache scope if needed. Do not serve an old frontend to a new backend. Already-open old tabs should fail closed, then hard-reload/sign in. No service worker migration is implemented.
11. **Confirm the forced-sign-in cutover.** SQL 008's retirement occurs at step 7, not through a later blanket token DELETE. Confirm null-family legacy rows are revoked and new backend rejects no-sid JWTs. New UI clears invalid state and asks for sign-in. On a database already installed at F6 v1, rerunning 008 does not revoke existing families; any additional reset needs a separately approved process.
12. **Validate private storage/configuration before restart.** Compare absolute effective root, permission/link/static-alias checks, backup manifest and legacy containment plan. If production files need controlled migration, complete only the separately approved rehearsed operation here; this preparation task moves/deletes none. An empty newly created private directory is not proof old documents are available.
13. **Start the new app under tester-only access.** Keep the external user/write restriction in place, remove the application-offline mechanism only using the verified host procedure, then restart/warm up. No built-in read-only/maintenance mode exists. A separate proxy/IP/host access restriction must let testers reach it while users/callbacks remain managed. Startup gates must pass before any traffic. Ordinary startup can seed roles/categories/create directories; those are authorized release writes, not read-only inspection.
14. **Run low-volume security smoke tests.** Use section 7, dedicated data and approved staging-versus-production boundaries. Check TLS with normal certificate validation; workflow SkipCertificateCheck is not acceptable proof. Any invariant failure keeps service restricted.
15. **Monitor.** Observe section 8 for the agreed period, check errors/rejections against expected reset traffic, and examine sanitized database state for required test records. Save pass/fail evidence without token-bearing HAR files or secrets.
16. **Reopen service/writes explicitly.** Operator signs off only after all mandatory checks pass and callback/reconciliation routing is ready. Remove the separate user restriction, verify normal HTTPS traffic and watch logs. Resume automatic deployment only after its coordinated-release policy is reviewed; do not allow queued old binaries to follow this release.

If the host offers only a single on/off switch and cannot provide restricted tester startup, stop before GO and design a suitable access gate with the hosting operator. Running public smoke tests while ordinary traffic writes defeats the backup/rollback assumptions.

## 4. Controlled SQL application reference

These commands **modify production when run with the corresponding full file**. They were not executed by this preparation task. Never paste them into a preflight connection. Use the approved migration identity, explicitly selected target and one file at a time; record both SQL errors and results. SSMS Execute Selection on just flags does not execute the file. Panel clients may use a different connection per request, so verify session persistence or prepend the flags to a reviewed copy of the entire file in the same request. Close the connection after each application; clear flags even after an error before reusing it.

| Stage | Required state before application | Set on same migration connection, then execute whole file |
|---|---|---|
| 005 | Understood baseline, clean F5 preflight, writers stopped | `EXEC sys.sp_set_session_context @key=N'KarigorF5Apply', @value=1;` |
| 006 | Payment not v2; supported shape/clean financial preflight, no invented history | `EXEC sys.sp_set_session_context @key=N'KarigorPaymentSchemaApply', @value=1;` |
| 007 | Exact v1, **zero existing Payment rows**, Bookings known exactly Unpaid, no partial extension | `EXEC sys.sp_set_session_context @key=N'KarigorPaymentConcurrencyApply', @value=1;` |
| 008 | Supported legacy tokens, unique well-formed hashes, approved forced reset; F5/Payment prerequisites validated | Both `EXEC sys.sp_set_session_context @key=N'KarigorF6Apply', @value=1;` and `EXEC sys.sp_set_session_context @key=N'KarigorF6ForceSignInReset', @value=1;` |

Filtered indexes require correct connection SET options. Rehearse the migration client, not just the SQL text: legacy sqlcmd without `-I` can fail CREATE INDEX because QUOTED_IDENTIFIER is off. Use sqlcmd `-I -b` if that is the approved client, and set the following options in the same migration connection before the flags/full file. Application writer connections must also use compatible settings. This changes session options, not stored rows.

```sql
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
```

Example for **005 only**, after GO, in the same SSMS connection:

```sql
-- Verify the target before setting ANY apply flag.
SELECT DB_NAME() AS SelectedDatabase;
-- Match it manually to the approved target; STOP on a mismatch.
EXEC sys.sp_set_session_context @key=N'KarigorF5Apply', @value=1;
-- Execute ALL of database/production/005_f5_negotiation_integrity.sql here.
EXEC sys.sp_set_session_context @key=N'KarigorF5Apply', @value=NULL;
```

For 006/007/008 use the table's exact corresponding flags and clear **every** set flag with `@value=NULL`, then close that connection. Never set all flags in one reusable preflight tab. Capture script hashes and marker results. A clean default preflight does not itself install anything. Application startup verifies F5, Payment v2 and F6, but does not run these upgrades. Do not remove triggers/constraints, manufacture version stamps or switch to stale EF migrations to force startup.

Fresh order: 001 → optional 002 → 005 → 006 → 007 → 008. Existing target: skip installed understood versions; **do not rerun frozen 006 on v2**. If financial/history gates fail, there is no safe command sequence to guess; keep service stopped and return to the reviewed legacy-data plan.

## 5. F6 forced-sign-in cutover

Old access JWTs often have no `sid`. The new backend requires that claim plus an active SQL session bound to the same user on every bearer authentication. An old token with a valid signature but no sid gets denied; waiting for its original expiry is not required. Disconnect all old backend processes/sockets during the outage so none can continue authorizing with the former policy.

008 retains legacy RefreshTokens, sets RevokedAt where absent, narrows hashes, creates RefreshSessions/relations/rowversions/indexes/checks and stamps F6 v1. Legacy rows keep `SessionId=NULL` and no invented parent/family. `ReplacedByToken` does not establish authentic lineage. The new service rejects null-family refresh rows, so the old HttpOnly cookie cannot refresh. Do not fabricate families or bulk-delete tokens to create a clean-looking database.

Deploy matching browser/API together. Old tabs have in-memory credentials; after new-server denial they must clear local auth and reload/sign in. New login produces a new independent family and replaces the cookie with `karigor_rt`, host-only, Path=/, HttpOnly, Secure, SameSite=Lax. Logout uses the same cookie scope and can revoke with expired access. There is no need to reveal cookies or instruct users to paste JWTs into terminals.

Refresh consumes once and creates one successor, bounded by the family's fixed deadline (default seven days). Two callers that both observed active can produce one success and a loser 409 without a cookie rewrite. A later presented consumed token revokes the family and gives 401. A lost successful response requires sign-in; no grace/recovery of the predecessor is promised. Browser Web Locks serialize auth cookie changes across same-origin tabs; blocked storage/unsupported coordination fails closed. Separate browsers/devices logging in have separate families; same-origin tabs generally share the cookie family.

Old binaries cannot create valid new null-family active rows under F6 constraints and do not enforce sid/current-family authority. F5 mutable writers also conflict with immutable guards; Payment v2 needs compatible allocation writers. An old-binary redeploy after SQL cutover is unsafe even if it happens to start. A database restore can resurrect credentials and undo later business writes; section 9 applies.

## 6. Payments, proxy/realtime and documents

### Payment validation without live money

Use the existing fake provider only in the guarded local test host; no fake-provider production configuration switch exists. For external integration use a separate sandbox host/database with sandbox credentials and `IsSandbox=true`. Keep live credentials out of that host; verify `SSLCOMMERZ_*` overrides cannot silently switch it to live. A sandbox attempt writes test financial data and belongs in the isolated environment.

On a production host configured Live, **do not click Pay/initiate, open a gateway checkout, replay live callbacks or switch the shared merchant to sandbox for a test**. Validate production configuration/route availability separately without issuing provider-bound financial requests. If same-host integration proof is required, arrange a separately isolated sandbox site with the equivalent IIS/proxy/storage settings. Stage payment initiation, provider verification, duplicate callbacks and 202/409 behavior there. Record the distinction honestly.

For the approved production base, the configured callback URLs are:

- `https://<PUBLIC_HOST>/api/payments/sslcommerz/success`
- `https://<PUBLIC_HOST>/api/payments/sslcommerz/fail`
- `https://<PUBLIC_HOST>/api/payments/sslcommerz/cancel`
- `https://<PUBLIC_HOST>/api/payments/sslcommerz/ipn`
- Browser return: `https://<PUBLIC_HOST>/payment/callback`

Check their configuration with the merchant/operator record and published routes without submitting a transaction. Callbacks are anonymous because the provider has no user JWT; they remain bound to independent exact provider verification. Do not apply the auth Origin/CSRF requirement to gateway callbacks. Verification must bind transaction/BDT/exact decimal amount/receipt/merchant/environment; untrusted success/fail/cancel parameters cannot settle/downgrade records. IPN uncertainty may return 503/Retry-After or 422; verify the provider's real retry contract separately. A selected settlement plus Paid commits once; additional real receipts retain RequiresReview, never a second allocation. Dispatching/Unknown is uncertainty and must not be “fixed” by another automatic charge.

Before reopening payments, the authorized owner must account for checkout sessions already in flight and any callbacks during maintenance. Host downtime, especially a 200 maintenance page, may lose notifications; durable payment state and provider evidence need reviewed reconciliation. This task does not call a gateway or add reconciliation code.

### SignalR / HTTPS / proxy test procedure

MonsterASP's [public support list](https://help.monsterasp.net/getting-started/first-steps/supported-technologies) advertises WebSockets/SignalR. Actual account transport/timeouts and any extra proxy are unverified. The client uses `/hubs/chat` and WebSockets/LongPolling, not a separately configured server URL.

1. With the dedicated customer/worker/unrelated user signed in via HTTPS, inspect sanitized Network state for negotiate and a successful WSS upgrade (101 where applicable). Do not export access_token query strings. Failure to upgrade must be understood; verify approved LongPolling fallback, expiry and revocation, not just a “connected” label.
2. Anonymous, expired and revoked credentials fail handshake. Active participants can JoinBooking/SendTyping; unrelated users, including nonparticipant admins, cannot. No private payload arrives for the unrelated listener. Public `{ refresh: true }` hints are allowed.
3. In an isolated host use a short approved access lifetime, keep a WebSocket open through JWT expiry, confirm server closes it and browser obtains fresh credentials before reconnect/rejoin. On production use natural expiry without changing global lifetime. Physical closure on logout is not the contract: after revocation commits, sensitive methods/private eligibility checks deny the old family even if a socket stays open until expiry.
4. Log out one test browser, then send a dedicated private event from the peer. The old family receives none; a separately logged-in device can still receive authorized events. Reconnect must repeat current session and booking authorization. Already queued/authorized work can finish; do not misclassify bytes authorized before revocation as a promise of cancellation.
5. Validate normal certificate trust, HTTPS/WSS only, no redirect loop, correct public Host/Scheme for auth Origin and callbacks, and true client IP for rate limits. There is no explicit application forwarded-header middleware/config. IIS in-process handling may suffice; an additional proxy that needs a code change is a blocker to resolve separately. Do not blindly trust arbitrary X-Forwarded headers.
6. Confirm one supported in-process realtime topology. A local registry routes current connections; multiple IIS workers/servers or a backplane need a reviewed delivery design preserving per-connection session/expiry fences. SQL session correctness does not make multi-node private delivery automatically correct. Record recycle/idle limits and reconnect test outcomes.

### Private documents and legacy files

Canonical default is **`<ContentRoot>/App_Data/Uploads/WorkerDocuments/<workerId>/<guid>.<ext>`**. `Storage:UploadPath` points at the WorkerDocuments root itself; absolute paths are used directly, relative paths resolve from ContentRoot. Root/ancestors/worker directories/file must not be symlinks or junctions; root must be outside default/effective public web roots. The app identity needs read/write/create/rename/delete, while users cannot replace those directories or files.

Metadata `FileUrl=/uploads/worker-documents/<workerId>/<guid>.<ext>` is still the authenticated route; it is **not evidence the file is public or already physically migrated**. SQL has no byte-length or physical-location field, so match all rows to private/legacy files with a restricted manifest. Historically files may exist under API `wwwroot/uploads/worker-documents` or a configured old root. Identify private/public copies, missing metadata/bytes, duplicates and unsupported names without viewing sensitive contents.

New code reserves `/uploads/worker-documents` from application static serving, and owner/admin file delivery validates the exact metadata pair/path/signature. That cannot prove a separate IIS/CDN/static alias has no exposure. Test only a synthetic public copy, never open someone's real private document anonymously as a probe.

If legacy files need migration, obtain a separate approved writer-frozen plan: backup and hashes, map rows to validated bytes, choose private destination, controlled copy/verification, owner/admin retrieval checks, public-exposure containment, then separately reviewed removal/move of old copies with audit/recovery. Do not silently relabel metadata, delete orphan files, leave public copies assumed safe, or configure the old public directory as the new root. File/SQL operations are not one transaction. This task performs none of them.

MonsterASP documents that private website folders can be outside its public wwwroot and included in website backups; that does not guarantee the actual WebDeploy action preserves a particular root. [Platform backup guidance](https://help.monsterasp.net/websites/manage/backups). Verify physical hosting/application root mapping and deployment preservation with a synthetic file and matching byte hash before GO. Preserve configured paths outside the default project skip-rule pattern too. Check storage quota and filesystem permissions before upload smoke tests.

## 7. Post-deployment security smoke checklist

Use a dedicated customer **C**, worker **W**, unrelated customer **U**, unrelated worker **X** and verified administrator **A**. Give W a dedicated synthetic document; create one dedicated request and booking between C/W. Use separate browser profiles/devices for separate families; tabs on one origin share the cookie. Record only test IDs, response status, expected state and PASS/FAIL. Do not delete financial facts or remove production constraints to clean tests up. Respect configured rate limits and space authentication tests; stop on unexpected 429/500. No abusive testing.

| Check | Low-volume action | Required result / location |
|---|---|---|
| Startup/TLS/assets | Load `/`, direct `/login`, `/api/categories`, Swagger JSON and one referenced JS/CSS asset under tester restriction | Valid trusted TLS, correct MIME/assets and no localhost/mixed content; all three schema gates pass; production |
| Normal/invalid login | C signs in with intended credentials; one intentionally wrong password; one auth POST missing CSRF header | Correct login/cookie/sid/protected read; invalid login rejected; missing header 403/no cookie mutation. Production dedicated accounts only |
| Origin guard | Isolated negative requests with missing/hostile/null Origin or missing header | 403 and no Set-Cookie/state mutation; intended exact origin succeeds. Staging contract test; production check only if approved |
| Refresh | Reload normal signed-in browser or trigger its normal coordinated refresh once | 200, one current successor, same family, no-store; old cookie not returned; authenticated read succeeds |
| Logout | Log out C, then make one protected read from that former browser | Family revoked/server-confirmed cookie deletion, old authorization denied and local state clears; logout also works after access expiry |
| Expired/revoked family | Natural expiry/revocation or isolated short-lifetime fixture | No protected authorization; expired family requires sign-in; no fallback grace credential |
| Second device | Sign C in in two separate profiles, then logout one | Distinct session IDs; second family remains usable. Same-origin tabs coordinate refresh/account changes without token persistence |
| F6 strict one-use | In isolated guarded host, deliberately repeat a consumed test refresh token after successful rotation; coordinated overlap case separately | Later replay 401/family revoked; observed-active loser 409/no Set-Cookie; one successor only. Do not export raw tokens or manually replay production credentials |
| F2 normal startup | Read admin-role count before/after one intended restart | No automatic administrator/default-email promotion; existing legitimate admins retained |
| F2 bootstrap surface | Inspect deployed routing/OpenAPI/release entry point | No public bootstrap API; operator CLI only. Do **not** execute bootstrap merely to test a live database. Full command tests stay local |
| F3 private delivery | C/W join dedicated booking, exchange one marker message/typing event; U/X listen and attempt booking membership | Only current participants receive private message/typing; unauthorized join denied, no leaked booking/user DTO; public hints alone are acceptable |
| F4 literal stored text | Store a harmless probe such as `<img src=x onerror="window.__karigorSmoke=true">` in a dedicated request description; W opens map popup | Original string visible literally, no created payload image/event execution; marker actions still work. Approved synthetic data only, no external/exfiltration URL |
| F5 offer/counter | W submits 1000 BDT; C counters 800 with displayed version | New immutable author/time/versioned offer; original terms unchanged |
| F5 stale/exact acceptance | One attempted response using old ID/version, then W accepts the current C-authored 800 offer | Stale attempt 409/refresh/review; current accepted agreement exactly 800, one booking/request; no self/unrelated acceptance |
| F7 private view | W and A fetch dedicated synthetic PDF/PNG through viewer; U/X and anonymous request the same synthetic route | Authorized complete bytes/headers; image Blob preview, PDF download only; unauthorized 401 or concealed 404, no public static bytes |
| F7 signatures | Upload one synthetic valid `%PDF-` document and one tiny malformed `%FDP` file with PDF extension | Valid accepted within 5 MiB; malformed rejected without orphan row/file. No malware/large-load tests |
| F7 lifetime | Close viewer/sign out/switch account with dedicated image | Preview cleared and object URL revoked; prior account bytes never flash; normal production browser |
| F1 initiation | Complete isolated sandbox booking, initiate/retry once with same terms | One durable intent/transaction/provider session; 200 same Ready URL or truthful 202 Unknown; changed terms 409. **Sandbox/fake only** |
| F1 authoritative settlement | Sandbox provider verifies exact transaction/amount/BDT/merchant; compare SQL Payment/Booking | Provider-derived receipt, Completed, Booking Paid and matching SelectedPaymentId committed together. **Sandbox/fake only** |
| F1 duplicate/late callback | Replay same **sandbox** callback once; deliver sandbox fail/cancel hint after success | One allocation/PaymentReceived notification; no downgrade; extra real fake-provider settlement retained RequiresReview without second allocation. Controlled local fake handles hostile/mismatch/fault cases |
| F6 realtime revocation | Log out C's connected family, peer produces one private event; try a sensitive method/reconnect | Former family gets no subsequent private event/authorization; healthy separate family works; expired JWT connection closes/reconnects correctly |

Payment scenarios against fake/sandbox are mandatory release evidence but are not live financial smoke tests. Production merchant/callback configuration verification is mandatory separately. Do not claim a production charge occurred, or that sandbox passed in production, when only isolated evidence exists. If a required test cannot be performed within these safe boundaries, keep its status unverified and resolve it before GO/reopen.

## 8. Observability and incident triggers

Program uses Serilog console plus configured sinks; early bootstrap and fatal startup logs are present. `web.config` has stdout disabled with `.\logs\stdout` path. An authorized operator may temporarily enable diagnostics during the future window only with private directory/ACL/retention controls, then turn it off. This preparation task changes no logging configuration. Confirm logs survive enough of the cutover to investigate; do not enable detailed EF sensitive-data logging.

| Watch | Evidence / interpretation | Operator response |
|---|---|---|
| Schema gates/startup crash | F5 51010, Payment 51061/51071, F6 51065; fatal `Application terminated unexpectedly`; apply errors include 51005/51006, 51060/51070, 51061–51064 | Stop startup/writes, compare exact script/gate/metadata. Error numbers overlap between components: use phase/message, not number alone. Never bypass a gate |
| Auth rejection/reset | HTTP 401/403 rate, token-expiry/JWT warnings, client sign-in failures | Some legacy-session 401s expected after reset; sustained new-login failures suggest origin/cookie/SQL/config fault. No log of access/refresh token |
| Refresh conflicts/replay | HTTP 409/401 plus restricted read-only aggregate Session revocation reason `Replay` | No dedicated structured replay event is emitted by current service. Do not invent one; use status/aggregate evidence. Preserve strict semantics and avoid replay loops |
| Payment uncertainty | `Provider verification unavailable`, result binding warning, `Payment initiation outcome unknown`, browser/IPN unresolved and 503/422 | Preserve unresolved state; authorized reconciliation. Never retry a new checkout just because the old outcome is unknown |
| Payment RequiresReview | Dedicated payment API/SQL count of RequiresReview, PaymentReview notification | Not necessarily a dedicated log event; investigate all real facts, keep selection immutable |
| Realtime | Handshake/invocation failures, browser reconnect failures, committed-notification/realtime unavailable warnings | Check current family/resource eligibility, actual transport/TLS/proxy and instance count. No broader private broadcast to solve delivery |
| Private documents | Controller authorization/path/signature failures, WorkerService retained-file reconciliation warning, disk permission/full errors | Compare restricted test IDs/manifests; preserve unknown-commit files, no automatic deletion |
| Unexpected 500/timeouts/429 | Exception middleware, SQL timeouts/deadlocks, IIS/ANCM errors/rate limiter | Abort reopening on unexplained failures; investigate quiet dedicated tests, not load generation |

Monitor both host IIS logs and application logs. **Known logging gap:** SignalR access tokens are query parameters; SSLCommerz validation HTTP URL includes `store_passwd`. Built-in HttpClient/proxy/IIS request-URI logging can expose those even if application messages omit them. Require a verified logging policy before GO: suppress credential-bearing URI/query capture and verbose `System.Net.Http.HttpClient` logging (for example an approved Error-level override), scrub the host query fields, restrict log access and verify with synthetic local evidence. Merely setting a level is not proof every sink is safe. Do not export browser HAR or validation URLs, raw gateway responses, passwords, JWTs/cookies/hashes, provider session keys or file contents. If required host logging cannot avoid credential capture, resolve it separately before release.

Use test IDs/statuses/timestamps/counts and sanitized error types. Never print the configuration tree. Every check begun after family revocation must deny; already authorized events/HTTP work may finish. Establish an observation period and abort/recovery deadline from the rehearsal rather than claiming a universal number of minutes.

## 9. Rollback matrix: app rollback versus database restore

An **app rollback** replaces backend/frontend binaries/configuration. A **database restore** overwrites schema and stored rows with a backup, losing later changes. A **file restore** is separate again. There is no reverse SQL 008 script, no fabricated EF rollback, and no guarantee a pre-Phase 1 binary can operate safely on Phase 1 schema.

| Failure point | Application action | Database/file action and safety condition |
|---|---|---|
| A. Before any schema change | Keep maintenance restriction; restore the recorded old paired artifact/config if they were touched | No DB restore normally needed. Verify no change actually committed; retain findings/backup. The old application's known security risks still need an explicit operator containment decision before reopening |
| B. After schema changes, before new app starts | Prefer forward repair using compatible Phase 1 artifacts; do not restart mutable old writers | Record which per-file transaction committed. 005's immutable trigger and 007's allocation guards already make blind app rollback unsafe, even before 008. If full return to old schema is necessary, a separately approved pre-change DB restore plus matching artifact/files/config is required while all writers are blocked |
| C. After 008 committed | Keep new-compatible binaries or forward repair; **old binaries are not a safe rollback** | Forced retirement cannot be undone by binaries. A pre-008 DB restore may resurrect legacy cookies/earlier lockout/password state. Capture failure-state backup/evidence first, approve data-loss/provider reconciliation and credential/session invalidation plan; keep public traffic off until approved security controls and matching schema/artifact are validated |
| D. New app starts, smoke fails | Reclose/retain tester-only gate immediately; stop writers and preserve sanitized logs. Use compatible forward fix or a previously verified **Phase 1-compatible** paired artifact | If no business writes occurred after backup, restore scope is simpler but synthetic tests/issued sessions still need accounting. If traffic/callbacks already wrote, preserve a new failure-state backup and reconcile new bookings/payments/files before an approved restore. Never lose a real settlement or reopen a restored credential state by accident |

For a separately authorized restore: keep writers stopped, retain current failure-state DB/file evidence, identify exact approved backup/timestamp/hash, use the verified MonsterASP Backups restore/upload control, explicitly confirm the intended overwrite target, wait for successful completion, verify schema/data/identity values/markers and file manifest, restore the paired artifact/protected config only if compatible, apply the approved credential invalidation/containment plan and repeat security smoke checks under restriction. [MonsterASP restore documentation](https://help.monsterasp.net/databases/mssql/restore).

A restore does not cancel provider-side payments, retract delivered notifications or restore uploaded bytes automatically. Reopening after a restore requires financial/file reconciliation and a fresh security decision. If those recovery conditions cannot be met, stay offline and obtain operator support; do not remove schema guards or deploy unsafe old code to make the page respond.

## 10. Completion record

Record actual scripts applied/skipped and markers, backup/file/artifact hashes, reset outcome, host transport/proxy/persistence evidence, each smoke test's environment/result, observation logs and operator reopening decision. A skipped mandatory prerequisite is unresolved, not PASS. No release completion is claimed by this document.

**Current status: NOT SAFE TO PROCEED.** Local Phase 1 implementation is complete. Production topology/data/configuration/backup/legacy files/session cutover/recovery prerequisites are unproven, and historical Payment rows may require a separate migration that the repository does not implement. No commit, push, merge, deployment, production query/write, schema apply, credential rotation, live transaction or file move/delete was performed by this preparation task.
