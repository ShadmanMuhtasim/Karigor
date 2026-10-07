# Phase 1 MonsterASP deployment preflight

Prepared: 2026-10-08, Asia/Dhaka. **Decision: NOT SAFE TO PROCEED.**

This is a preparation document, not permission to deploy. No production application, database, files, accounts or credentials were inspected or changed. Public provider documentation was read; it is not evidence of this account's configuration. Use the [runbook](PHASE1_MONSTERASP_DEPLOYMENT_RUNBOOK.md) only during a separately authorized maintenance window after the gates below are proven.

## 1. What is known and what a preflight means

A preflight checks prerequisites before making a change. A migration changes database structure or data. A backup allows an operator to recover an earlier state. A schema marker records an installed version; it does not prove that constraints, indexes and triggers still match that version.

The repository's [final regression record](../security/SECURITY_WORKDONE.md#phase-1-final-regression-reconciliation) and [test harness](../testing/PHASE1_SECURITY_TEST_HARNESS.md) report 248 backend passes, 49 Chrome passes and 64 schema-subset passes, with no failures/skips/expected failures. These are existing local records, not tests executed against MonsterASP. Disposable SQL databases, fake provider responses and local browser fixtures cannot prove live financial history, hosted filesystem persistence, TLS/proxy behavior, Google configuration or current production settings.

Repository HEAD at inspection was `1f3abc290d75b98663cb6f0cae047bce43b993f1` (the Phase 1 merge). Record the full immutable release revision and artifact hashes when preparing an actual release. No `AGENTS.md` was found. ADR 0001 exists but is empty; decisions are supported by the Phase 1 plan and ADRs [0003](../adr/0003-f5-sql-authority-and-immutable-negotiation.md), [0004](../adr/0004-payment-schema-authority.md), [0005](../adr/0005-payment-intent-and-settlement-allocation.md) and [0006](../adr/0006-refresh-session-authority.md). Older proposed/historical paragraphs do not override those implementations.

## 2. Required release content

Ship a matching backend/frontend artifact from one reviewed revision, the versioned SQL files, configuration checklist and this runbook. Preserve a copy of the old artifact and protected configuration separately.

| Finding/surface | Production change and files to include | Deployment consequence |
|---|---|---|
| F1 provider trust | `PaymentService`, `SslCommerzClient`, payment DTOs/controller, `PaymentCallbackPage` and payment API | Anonymous callbacks are hints; only provider verification bound to stored transaction, exact amount, BDT and merchant/environment settles payment. Return UI fetches authorized status. No caller VALID or booking-ID fallback. |
| F1 concurrency | Payment/Booking models, DbContext, `PaymentSchemaGate`, SQL 006/007, booking payment UI | One durable initiation intent; 202 means unresolved, not retry a new charge. Booking selects one payment; another real settlement remains Completed/RequiresReview. Notification and allocation commit together; push is best effort. |
| F2 administration | `Administration/AdminBootstrapCommand`, `AdminBootstrapper`, `IdentityRoleSeeder`, Program and LoginPage | Ordinary startup seeds role definitions, never an administrator. Existing accounts remain. Interactive bootstrap exits without HTTP; no public bootstrap endpoint or deployment flag. |
| F3 realtime | `KarigorHub`, `BookingAccess`, notifier/services and SignalR client | Join/typing need current participation; private DTOs go to current recipients. Public broadcasts contain only fixed refresh hints. Admin is not automatically a booking participant. |
| F4 map rendering | `KarigorMap.tsx` | Dynamic stored text uses DOM/textContent; historical text needs no rewrite. Validate the new browser bundle, not just the API. |
| F5 negotiation | Marketplace service, quotation/request/booking mappings, DTOs/controller, `F5SchemaGate`, SQL 005, marketplace API, request page and worker booking UI | Immutable offers with explicit author/time, displayed version required for counter/accept, 409 for stale intent; one booking/request and exact accepted price. Old writers/callers are incompatible. |
| F6 sessions | Auth/Token/RefreshSession services and models, DbContext, `RefreshSessionSchemaGate`, AuthController/Origin filter, admin suspension, Program, realtime registry/notifier; `authSession.ts`, auth API/client, AuthContext and SignalR client; SQL 008 | JWT sid plus SQL session/account checks; absolute family expiry, strict rotation, coordinated browser cookie writes. Matching schema/backend/frontend and forced sign-in are required. |
| F7 documents | validation/limits, WorkerService, `PrivateUploadPathProvider`, file/upload controllers, Program, `web.config`; private-document API/viewer, admin/worker panels and locales | Storage outside public web root; authenticated Blob retrieval; PDFs download only; supported PDF/JPEG/PNG signatures; 5 MiB file and 5,308,416-byte whole-request cap. Legacy disk files need inventory. |
| Hosting/configuration | API project/publish output, `web.config`, config key names, workflow | .NET 10 IIS in-process artifact embeds frontend into API `wwwroot`. Retain uploads/config and maintenance access restrictions during replacement. |

Implementation references: [F1](../security/implementation/F1_PAYMENT_CONCURRENCY_AND_IDEMPOTENCY.md), [F2](../security/implementation/F2_SECURE_ADMIN_BOOTSTRAP.md), [F3](../security/implementation/F3_SIGNALR_AUTHORIZATION.md), [F4](../security/implementation/F4_STORED_XSS_PREVENTION.md), [F5](../security/implementation/F5_NEGOTIATION_INTEGRITY.md), [F6](../security/implementation/F6_REFRESH_SESSION_ARCHITECTURE.md), [F7](../security/implementation/F7_PRIVATE_DOCUMENT_SECURITY.md).

## 3. Exact SQL authority and conditional order

There is no single cumulative sequence called production 001 through 008. Production has 001, 002 and 005–008; 003/004 are historical development paths outside that directory. SQL scripts own F5, Payment and F6. Current EF mappings consume them; historical EF migrations/snapshot are not a second owner. Do not run `dotnet ef database update`, `EnsureCreated`, or scripts that target KarigorDev against production.

| Exact file | Kind / prerequisite | When applicable |
|---|---|---|
| `database/production/001_schema.sql` | Host-selected baseline, Identity/domain/legacy RefreshTokens/booking verification; no Payments or RefreshSessions | A newly provisioned empty database. Existing installation: compare metadata, do not blindly rerun. It can add booking-verification columns and other objects; it is not read-only or a complete drift repair. |
| `database/production/002_seed.sql` | Optional idempotent role/category seed; not a security schema version | Fresh database or separately approved missing seed data. Admin role definition does not create an account. Startup also seeds ordinary roles/categories. |
| `database/003_add_booking_verification.sql` | Historical booking extension; current file is host-neutral (no USE), adds four columns only if VerificationCodeHash is absent | Not a Phase 1 production migration owner. Verify all four columns separately; production 001 already contains them. Its first-column guard cannot repair a partial installation. |
| `database/004_add_payments.sql` | Retired; raises an error pointing to 006 | Never use as an alternative to 006. Development 001/002 are also environment-specific bootstraps, not hosted upgrades. |
| `database/production/005_f5_negotiation_integrity.sql` | Negotiation upgrade from understood baseline; target `Quotations.KarigorF5Version=1` | Default preflight then explicit apply for uninstalled supported shape. Partial/unknown versions require review. Installed v1 still needs preflight and exact metadata gate. |
| `database/production/006_payment_schema_authority.sql` | Frozen Payment version-1 base; target `Payments.KarigorPaymentSchemaVersion=1` | Supported unstamped legacy shape or missing empty-table financial structures; default preflight then apply. **Never run against Payment v2**: its v1 contract intentionally rejects v2 columns/marker. |
| `database/production/007_payment_concurrency.sql` | Forward extension of exact Payment v1 to v2 | Preflight/apply after 006 as needed. **Refuses every existing v1 Payment row**, and every Booking not exactly known Unpaid. v2 reports already installed; verify the exact current gate instead of accepting that message as proof. |
| `database/production/008_refresh_session_authority.sql` | F6, after canonical baseline/F5/Payment v2; target `RefreshSessions.KarigorF6Version=1` | Legacy shape: preflight, then apply with forced reset acknowledgement. Existing v1 returns early: use gate and supplemental checks; no second reset is performed by rerunning 008. Partial/unknown installation is NO-GO. |

Fresh schema order: **001 → optional 002 → 005 → 006 → 007 → 008**. Final markers: **F5 1 / Payment 2 / F6 1**. The baseline has 21 tables; adding Payments and RefreshSessions normally gives 23, but table counts are not schema verification. The old deployment guide's 22-table expectation is incomplete after F6.

Existing schema order: inventory first, then **only missing approved upgrades in the same dependency order**. At Payment v1, skip installing 006 if its exact contract already holds and preflight passes; run 007's review. At Payment v2, skip 006 entirely and use 007's default status plus the current Payment gate. Unrecognized markers, extra/conflicting objects and partial schemas block the standard path.

The scripts/gates use SESSION_CONTEXT and ordered STRING_AGG. The latter requires SQL Server 2017 or later and compatibility level at least 110 for its order clause; this is a SQL-syntax prerequisite inferred from the repository, not proof the complete EF/application workload supports every such compatibility level. Collect actual engine/version/compatibility before running advanced preflight, and rehearse the current runtime's queries on that target. Do not change compatibility as part of read-only inspection. [Microsoft STRING_AGG reference](https://learn.microsoft.com/en-us/sql/t-sql/functions/string-agg-transact-sql?view=sql-server-ver17), [SESSION_CONTEXT reference](https://learn.microsoft.com/en-us/sql/t-sql/functions/session-context-transact-sql?view=sql-server-ver17).

**The historical-payment gate is stronger than financial consistency.** A plausible v1 receipt is still a row that 007 refuses. Reading a receipt and approving it manually does not change this script's eligibility. There is no implemented legacy-adoption command. If any legacy attempts exist, stop this runbook and obtain a separately designed, versioned, evidence-preserving migration and rehearsal. Do not delete attempts, set all Bookings Unpaid, fabricate merchant/environment, choose a settlement, or bypass checks to get 007 to run. [Payment authority](../database/PAYMENT_SCHEMA_AUTHORITY.md) and ADR 0005 explain this limitation.

## 4. Topology evidence and unknowns

| Subject | Repository evidence / public documentation | Actual deployed state |
|---|---|---|
| Hosting | API targets `net10.0`; `web.config` uses AspNetCoreModuleV2, `hostingModel=inprocess`; published launcher values replace source placeholders | **UNKNOWN:** installed runtime/hosting bundle, bitness, app pool identity, real IIS configuration |
| Frontend | Workflow builds Vite dist, copies it into API `wwwroot`, publishes unified artifact; Program uses static files/SPA fallback | **UNKNOWN:** deployed revision, actual domain/path, CDN cache and any split frontend deployment |
| Database | EF SQL Server provider and T-SQL scripts | **UNKNOWN:** SQL engine/version, compatibility/collation, actual database identity, shape/markers/data, permissions/quota |
| Secrets | ASP.NET IConfiguration supports `__` environment keys; panel documents website environment variables | **UNKNOWN:** which settings are active, whether deployment replaces web.config variables, availability of all secrets |
| Public paths | API `/api`, hub `/hubs/chat`, SPA fallback at site origin; workflow publishes `./publish` | **UNKNOWN:** physical application/content root and hosting folder mapping; do not confuse hosting folder named wwwroot with API public ContentRoot/wwwroot |
| HTTPS/proxy | Production UseHttpsRedirection; no explicit `UseForwardedHeaders` or known-proxy configuration in Program | **UNKNOWN:** TLS termination, extra proxy/CDN, effective Request.Scheme/Host/client IP, redirect loops and trust boundaries |
| SignalR | In-process registry, WebSockets plus LongPolling, auth-expiry closure | **UNKNOWN:** actual transport, idle timeouts, recycle behavior, number of API workers; no backplane configured |
| Files | Default private ContentRoot/App_Data/Uploads/WorkerDocuments; configurable Storage:UploadPath; project declares MSDeploy skip rules for App_Data/Uploads and legacy wwwroot/uploads | **UNKNOWN:** effective private directory, ACLs, quota, aliases/junctions, uploaded legacy locations and preservation by the actual action |
| Logs | Serilog console/configuration; stdout disabled in web.config, path `.\logs\stdout` | **UNKNOWN:** log capture/retention, safe access, filesystem permission and IIS query-string redaction |

The workflow triggers on push to main and manual dispatch, uses a `monsterasp-deploy` concurrency group with cancellation disabled, .NET 10 and **Node 22**. It validates backend unit tests and frontend build/types, copies dist, publishes and invokes `rasmusbuchholdt/simply-web-deploy@2.1.0` with a **directory** package. It does not migrate SQL, force sign-in, stop all writers or provide an operator smoke gate. No production configuration injection or explicit preservation options are visible in its action arguments. Project skip rules are intent, not proof they reach this directory-sync action. Its health calls skip certificate validation and only warn after exhausting retries: a green workflow is not a security/readiness verdict. Do not trigger it as part of this preparation task.

Public MonsterASP documentation, checked 2026-10-08, describes Windows/IIS, WebSockets/SignalR support and per-website environment variables. These describe platform capability, not account verification. It documents no SSH terminal; plan a trusted local interactive bootstrap terminal if needed. Sources: [supported technologies](https://help.monsterasp.net/getting-started/first-steps/supported-technologies), [environment variables](https://help.monsterasp.net/websites/configuration/environment-variables). Configuration changes there take effect on restart; schedule them within the writer outage.

The older [MonsterASP guide](../MONSTERASP_DEPLOYMENT.md) contains stale public upload paths, implied storage guarantees, Node 20 and generic old-binary rollback advice. Follow current code and this runbook for Phase 1. Do not infer an edge TLS arrangement from the old diagram.

## 5. Required configuration checklist

Record **present/verified**, key name, owner and protected location. Never record values of secrets in this document, terminal transcripts or screenshots. A public URL/client ID is not a password, but use placeholders here.

| Required setting | Placeholder / expected behavior | Verification |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | Effective app environment agrees with published web.config; no unexpected DOTNET_ENVIRONMENT override |
| `ConnectionStrings__DefaultConnection` | `Server=<SQL_HOST>;Database=<TARGET_DATABASE>;User Id=<APP_USER>;Password=<SECRET>;Encrypt=True;TrustServerCertificate=False;MultipleActiveResultSets=True;` | Operator validates TLS/certificate support and provider connection string; database identity exactly matches approved record. Do not copy insecure certificate bypasses as proof of encryption. |
| `Jwt__Key` | `<EXISTING_APPROVED_HIGH_ENTROPY_HS256_KEY>` | At least 32 random bytes of key material appropriate to HS256; secure storage, present/nonempty. Do not rotate in this task. Startup null-check alone is insufficient validation. |
| `Jwt__Issuer`, `Jwt__Audience` | `<APPROVED_ISSUER>`, `<APPROVED_AUDIENCE>` | Issuance and validation match explicitly; no reliance on token-service fallbacks |
| `Jwt__AccessTokenExpiryMinutes` | `<POSITIVE_INTEGER_MINUTES>`; default 15 | Valid positive lifetime, clock/UTC correct; JWT is capped at family deadline |
| `Jwt__RefreshTokenExpiryDays` | `<1_TO_365_DAYS>`; default 7 | Absolute session lifetime, not sliding. No separate F6 secret, family-migration flag or cookie-name config exists. |
| Trusted origin / CORS | `Cors__AllowedOrigins__0=https://<PUBLIC_HOST>` | Exact scheme/host/port, no wildcard/null/localhost trust in production. Same-origin is the supported arrangement; additional origins require review. CORS permits credentials and X-Karigor-CSRF. |
| Auth POST headers | Browser Origin plus `X-Karigor-CSRF: 1` | All auth POSTs including login/register/Google/refresh/logout; missing/hostile Origin or missing header gives 403 without cookie mutation. Check effective scheme/host behind proxy. |
| Cookie/browser requirements | `karigor_rt`, HttpOnly, Secure, SameSite=Lax, host-only, Path=/ | Browser accepts it over HTTPS; writable localStorage and Web Locks work. Tokens stay in memory/HttpOnly cookie; generation metadata only is stored locally. |
| Google | `Authentication__Google__ClientId=<APPROVED_CLIENT_ID>`; fallback `Google__ClientId` | Backend ID-token audience and Google authorized JavaScript origins match actual HTTPS host. `/api/auth/config` supplies client ID; optional `VITE_GOOGLE_CLIENT_ID` is a build-time public ID and must match. |
| Google client secret | **Not consumed by this implementation** | Current GIS ID-token flow has no server authorization-code/client-secret exchange. Do not invent a required secret or put it in Vite. If deployed production uses another flow, investigate before GO. |
| SSLCommerz credentials | `SslCommerz__StoreId`, `SslCommerz__StorePassword` placeholders | Correct merchant/environment and configured outbound access; no credentials in documentation/logs |
| SSLCommerz mode | `SslCommerz__IsSandbox=<APPROVED_MODE>` | Default true; release owner explicitly verifies intended production mode. Safe tests use separate sandbox/fake environment. Do not switch shared production to sandbox for smoke tests. |
| Backend public URL | `SslCommerz__AppBaseUrl=https://<PUBLIC_HOST>` | Explicit correct base for success/fail/cancel/IPN callbacks, no localhost or tunnel |
| Frontend public URL | `SslCommerz__ClientBaseUrl=https://<PUBLIC_HOST>` | Same-origin SPA payment return `/payment/callback` |
| SSLCommerz alternative envs | `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_SANDBOX`, `SSLCOMMERZ_APP_BASE_URL`, `SSLCOMMERZ_CLIENT_BASE_URL` | Program explicitly overrides bound options with these. Avoid conflicting dual sets; verify effective precedence without printing values. |
| REST / realtime URLs | Relative `/api`, `/hubs/chat`; HTTPS yields WSS | `VITE_API_URL` affects a file-URL helper, **not Axios baseURL or SignalR**. A split-host release cannot be enabled by that variable alone. No standalone hub URL config exists. |
| Proxy/forwarded headers | `<VERIFIED_IIS_AND_PROXY_TOPOLOGY>` | No application known-proxy keys are implemented. Confirm trusted scheme/host/client-IP handling; an extra proxy requiring code changes blocks this documentation-only task. Never enable blanket trust of forwarded headers. |
| Private root | `Storage__UploadPath=<PERSISTENT_PRIVATE_DIRECTORY>` or default | Resolve relative to ContentRoot, outside both effective/default public roots and without reparse-point ancestors/worker/file links. The permitted MonsterASP physical path must be proven. |
| Private ACLs | `<APP_POOL_IDENTITY>` | Read/create/write/rename/delete for document operations; operator can back up; ordinary users/other sites cannot replace ancestors or bytes. No executable/static mapping. |
| Request limits | 5 MiB file; IIS total 5,308,416 bytes | Matching published web.config and application limits; any proxy cap tested with synthetic documents |
| Serilog/logging | Console sink and optional reviewed `Serilog__MinimumLevel__Default` / overrides | Confirm destination/retention/redaction; no file sink/rolling-log config is currently declared by Program. `.\logs\stdout` is ANCM diagnostic logging, disabled by default. |
| AllowedHosts/rate limits | `<PUBLIC_HOST>` and approved existing limits | Host-header handling and correct client IP behind proxy; keep smoke traffic below AuthLimiter (default 10/min/IP), no brute-force/load tests |
| Bootstrap | Protected interactive `dotnet Karigor.Api.dll bootstrap-admin` | Only for zero existing admins and verified fresh identity. No password args/env/redirected input. Existing admins require review, not bootstrap promotion. |
| Deployment credentials | GitHub `WEBSITE_NAME`, `SERVER_COMPUTER_NAME`, `SERVER_USERNAME`, `SERVER_PASSWORD`; optional `PRODUCTION_URL` | Authorized operator checks availability only; these do not supply API runtime secrets. Workflow disabled/fenced until coordinated release is approved. |

Ordinary startup is **not read-only**: it creates the private directory, seeds roles/categories, and retains a booking-verification ALTER branch if its first column is absent. Never start the application to inspect production. Inventory all four booking verification columns before cutover; partial installation needs a reviewed SQL repair instead of hoping startup fixes it.

## 6. Read-only production preflight procedure

This task deliberately made no production connection. A future operator must have explicit access and use a principal that can SELECT application tables and VIEW DEFINITION but cannot modify application data/schema. `ApplicationIntent=ReadOnly` alone does not restrict writes on an ordinary primary. If a preconfigured safe read-only connection is unavailable, gather its setup/authorization separately. Do not enable remote access or create users as part of a read-only inspection.

1. Select the intended database in SSMS; verify name and host against the private operational record. Open a **new connection**. Never reuse a migration tab/session. Record UTC and Asia/Dhaka time, source revision, engine version/compatibility/collation and query file hashes.
2. Open [PHASE1_READ_ONLY_PREFLIGHT.sql](sql/PHASE1_READ_ONLY_PREFLIGHT.sql), replace only `<TARGET_DATABASE>`, execute and save every result/error to restricted evidence. It refuses any non-null apply/reset session flag and requires metadata visibility. It uses SELECT/catalog queries and session settings, with dynamic SELECT for optional columns; it neither repairs rows nor creates persistent objects.
3. On a supported baseline, execute the **entire canonical 005 file** without flags. It audits heads/roots/forks/cycles/statuses/parents/booking uniqueness and active authorship. Its temporary issue table is in tempdb, not persistent application schema. Unknown author on a Pending offer is a blocker even if chain parity looks obvious; inactive NULL history is retained.
4. Payment missing/unstamped/v1: execute **006 default preflight**. Review its Severity/Issue/EntityId outputs, schema drift, duplicate identifiers/receipts, amounts/fees/statuses/currency/orphans/contradictory Paid history. If the table is already v2, **skip 006** and use supplemental v2 financial queries plus the exact current Payment gate.
5. Execute **007 default preflight** when v1 or v2 exists. On v1, every Payment row and every non-Unpaid Booking is Review; this blocks apply. If prerequisites are not installed, its prerequisite failure is expected pending a successful rehearsal, not permission to ignore it. Re-run after each prerequisite during the outage.
6. Execute **008 default preflight** for an understood legacy RefreshTokens shape. It reports row counts and refuses malformed/duplicate hashes and partial F6 schema. Do not SELECT hash values. On installed F6 v1 it returns early; inspect retained legacy rows and run the exact F6 gate instead. Retire old rows, never migrate guessed lineage.
7. Use [PHASE1_SCHEMA_GATES_READ_ONLY.sql](sql/PHASE1_SCHEMA_GATES_READ_ONLY.sql) after upgrades, or against an installation claiming the final versions. It is a snapshot of the current metadata-only C# gates, with a database/flag guard; inserts only in local table variables. It checks the exact runtime contract without launching/seeding the web application. A prerequisite failure before migration is expected but must pass before startup. Unknown version markers remain NO-GO even if another query is empty.
8. Collect a **separate authorized read-only disk inventory**: metadata document IDs/worker IDs, expected route-to-private-path mapping, file existence/size, links/ACLs, legacy public copies and host static aliases. SQL cannot check remote files. No file is moved/deleted here. Restrict the manifest; do not download private document contents just to inspect paths.
9. Save findings and classify them. Query failure, timeout, hidden metadata, unsupported type, recursion over 256 levels, partial report or changing data means **INCOMPLETE**, never PASS. These SELECTs may take shared locks/use CPU. Run once at low traffic; large histories should first be rehearsed on an isolated restored copy. Canonical 005 uses unbounded recursion; do not repeatedly hammer shared hosting. Avoid NOLOCK because inconsistent reads could hide blockers.

An early report collected while writers run is provisional. Repeat under the confirmed writer outage immediately after the final backup. SQL locking during apply complements the outage; it does not stop old binaries from writing after the transaction commits. Capture active-writer evidence through panel/process/session information if permissions allow; inability to see sessions requires a host/operator method, not assumptions based on an empty query.

| Area | Required result coverage | What still needs non-SQL evidence |
|---|---|---|
| F5 | Ambiguous Pending authors; multiple heads/roots, forks, cycles, invalid/missing/cross-request/cross-worker parents, wrong/same participant authors, statuses, closed requests and duplicate bookings | Participant-confirmed history resolution if needed; never parity-based inference |
| Payments | Table/marker/shape, duplicate/blank/malformed transaction IDs, apparent duplicate receipt IDs, multiple Completed attempts, Paid without success, success without Paid, amounts/fees/booking price, BDT, orphans/statuses/unknown missing columns; v2 selection and RequiresReview | Authoritative financial history/reconciliation, merchant/environment, unresolved in-flight gateway sessions; no real gateway call in this task |
| F6 | Legacy columns/counts, malformed/duplicate hashes without displaying them, Sessions table/marker/constraints, retained null-family rows revoked, whether reset required | All old instances stopped, user announcement, browser cookie/origin coordination |
| F7 | Orphan worker metadata, duplicate/unsupported URLs, count of rows needing disk inventory | Missing physical files, unreferenced files, public exposure, effective root/ACLs/persistence |
| F2 | Roles/assignment counts, admin user IDs, lockout state and historical `admin@karigor.com` match flag | Password exposure/ownership/action audit; never test known password or print hash. Removing seed does not secure an existing exposed account. |

## 7. Backup and restore gate

The public [MSSQL backup guide](https://help.monsterasp.net/databases/mssql/backup) describes Databases → selected database → Backups → Create BAK file, waiting for completion and downloading the fresh full `.bak`. Premium daily backup availability is separate from an operator-created cutover backup. Confirm these controls work for the actual subscription; no backup was taken in this task.

- [ ] Name the authorized backup/restore operator and confirm account/target, quota, download rights and restoration destination/version.
- [ ] Rehearse restoration to an isolated authorized non-production database; never point the rehearsal at production. Prevent that copy from serving users or reaching live payment/Google systems; treat its private data as sensitive.
- [ ] Before any schema apply, stop all writers and create a final **full** database backup. Record job ID, completion state, filename, byte length and timestamp in UTC plus Asia/Dhaka.
- [ ] Download; verify non-zero size, readable local file and SHA-256 hash. A readable nonzero file alone does not prove a usable SQL backup: successful isolated restore/query verification is the stronger gate. Record verification result.
- [ ] Keep a separate protected copy outside hosting and separate from the first local copy. Verify matching hashes/access. A SQL script export is not silently equivalent to a full backup; prove it preserves data, Identity, triggers, constraints, indexes, defaults, extended properties and identity values and has a rehearsed restore path.
- [ ] Back up private and historical public document directories plus mapping manifest, old application artifact and protected configuration. Database backups do not contain uploaded bytes. Inventory/backup files from the same writer-frozen point.
- [ ] Record approved downtime/recovery time and maximum acceptable data loss; the writer outage should leave no new business writes to lose before GO. Record provider attempts/callbacks that might arrive during downtime.
- [ ] Document the actual panel restore action and the overwrite confirmation. The [MSSQL restore guide](https://help.monsterasp.net/databases/mssql/restore) documents upload/listed BAK restoration and warns that later changes are lost. Confirm the current panel controls; stop applications before a separately approved restore, wait for completion, validate markers/data/files/config before restart. Do not restore to a lower SQL Server version or assume a BACPAC is accepted by the BAK tool.
- [ ] Approve post-008 recovery handling: a pre-cutover restore resurrects legacy refresh credentials and possibly earlier passwords/lockouts. Keep traffic blocked until a separately approved credential/session invalidation decision is implemented and tested. No credential rotation is performed by this task.

Without a readable separate backup, restoration rehearsal and credential-aware rollback procedure: **NO-GO**. Application rollback alone cannot undo 008's retirement or make pre-F6 binaries comply with session constraints. Details are in the runbook's rollback matrix.

## 8. Legacy decision gate

“SAFE TO AUTO-MIGRATE” below means the reviewed canonical script can handle that known condition **after** backup/outage/explicit apply; nothing is applied automatically by this task or startup.

| Finding/prerequisite | Classification | Decision/action |
|---|---|---|
| Exact supported baseline, empty financial tables, known Unpaid bookings, clean negotiation; missing objects expected by canonical upgrade | SAFE TO AUTO-MIGRATE | Rehearse/apply dependency order with explicit flags; validate exact gates |
| Inactive legacy offers with NULL author/time and otherwise clean structure | SAFE TO AUTO-MIGRATE | Preserve NULL history; do not invent authors or times |
| Well-formed unique legacy refresh hashes under understood legacy shape | SAFE TO AUTO-MIGRATE | 008 retires history with explicit forced reset; never fabricates families |
| Existing final markers and exact gates pass | SAFE TO AUTO-MIGRATE (no schema work needed) | Skip installed upgrades; complete data/config/operations checks |
| Active unknown/nonparticipant authors, chain anomalies, duplicate bookings | REQUIRES MANUAL REVIEW | NO-GO until separately authorized participant/business resolution and clean rehearsal; no random deletion |
| Any v0/v1 Payment row, even consistent/Failed/Cancelled/Initiated | REQUIRES MANUAL REVIEW | **BLOCKS standard 007 deployment.** Separate reviewed migration required; business review alone cannot make existing 007 accept rows |
| Paid/unknown Booking state, missing financial history, contradictory receipts/amounts/currency/orphans | REQUIRES MANUAL REVIEW | NO-GO; authoritative financial evidence and separately reviewed migration, no invented Unpaid/fee/provider facts |
| Multiple verified v2 settlements or RequiresReview | REQUIRES MANUAL REVIEW | Preserve all facts/one selection; approve reconciliation before GO. Never add unique Completed/Booking constraint |
| Malformed/duplicate legacy refresh hashes | REQUIRES MANUAL REVIEW | NO-GO; preserve evidence, do not truncate/deduplicate; reset plan alone does not bypass 008 refusal |
| Legacy public files, missing/orphan files, unsupported route patterns, default admin email/exposure | REQUIRES MANUAL REVIEW | NO-GO for unresolved exposure/required documents/privilege ownership; controlled separate remediation and manifest |
| Unknown/partial schema version, metadata drift/disabled guards, incomplete inspection, incompatible SQL engine/permissions | BLOCKS DEPLOYMENT | Establish reviewed schema path/metadata compatibility before proceeding |
| No proven backup/restore, writer-stop mechanism, queued deployment fence, required secrets, browser support, log access or rollback invalidation plan | BLOCKS DEPLOYMENT | Gather proof; no elapsed-time or “probably configured” substitute |
| Cannot force old sessions to sign in again, mixed old/new backend/frontend, unreviewed split-origin or multi-node realtime topology | BLOCKS DEPLOYMENT | Coordinated outage and compatible release required |
| Required payments/WebSockets/proxy/storage smoke behavior cannot be safely tested | BLOCKS DEPLOYMENT | Rehearse or resolve host requirements before GO; never exercise live money to complete a checklist |

GO requires every mandatory operational prerequisite proven, every applicable canonical preflight free of unresolved Review/Blocker, exact gates passing on a rehearsal, compatible artifact ready, approved cutover/reset/rollback and host-specific validation evidence. Installed-schema Info messages or all-green local tests alone are insufficient. Current production findings are **UNKNOWN**, not assumed dirty or clean; current status stays **NOT SAFE TO PROCEED**.

## 9. Information the operator must still gather

Complete this record privately, using placeholders in shared documentation:

| Missing information | Acceptable evidence |
|---|---|
| Hosting subscription/site identity, actual deployed revision/artifact, active/queued deployment operations | Operator panel/Actions read-only record; release hashes, workflow freeze owner |
| Target SQL database identity/version/compatibility/collation/permissions/quota and all three markers | Read-only connection result and full metadata/preflight outputs; no credential dump |
| All F5/financial/refresh/admin findings and separately approved legacy resolutions | Restricted issue-ID reports, business/provider evidence and rehearsed migration, no guessed facts |
| Runtime/ANCM/IIS model/bitness, number of workers, recycle/idle settings, physical roots | Hosting settings/support confirmation; incompatible scale-out is resolved before GO |
| Public backend/frontend domain/base path, certificate/termination and any proxy/CDN | Trusted TLS validation and effective scheme/host/IP tests, cache plan |
| Effective runtime key presence and config source/precedence, Google client/authorized origins, correct gateway mode and public callbacks | Authorized owner confirmation without showing values; isolated integration tests |
| Private directory/static mappings/ACLs/quota, actual MSDeploy preservation, legacy public/missing/unreferenced files | Restricted disk/metadata manifest, synthetic-file persistence rehearsal and approved controlled file plan |
| Backup/export availability and completed final backup; restore controls/time/version and off-host copies | Job record, file size/hash, isolated restore proof, restore operator and rollback signoff |
| Writer outage plus separate tester-only access gate during startup/smoke | Proven stop/fence procedure covering backend replicas, scheduled/direct SQL writers, frontend clients and gateway callbacks |
| WebSocket transport/auth/expiry/revocation/privacy and fallback behavior | Low-volume dedicated-account tests in same host configuration; no token-bearing HAR export |
| Log locations/retention/query-token and outbound credential redaction; observation period and incident owner | Operator access verification and sanitized diagnostics, not config/secret dumps |
| Maintenance announcement, forced-sign-in expectation, callback retry/reconciliation, recovery limits | Approved operations record and staging rehearsal |

The next step is gathering this evidence through an authorized operator. This preparation task does not authorize any of those production writes, credential changes or deployment actions.
