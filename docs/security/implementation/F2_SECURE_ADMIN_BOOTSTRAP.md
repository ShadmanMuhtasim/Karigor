# F2 Secure Administrator Bootstrap

Date: 2026-10-07 (Asia/Dhaka).
Status: locally implemented and verified.
Base: c43176d; worktree J:/Karigor-F2-F4; branch fix/admin-bootstrap-and-xss-on-f1.

This follows the F2 decision in the [approved plan](../PHASE1_SECURITY_REMEDIATION_PLAN.md). The original branch remains untouched. F1 architecture, SignalR authorization, negotiation, refresh sessions and worker-document handling are unchanged.

## 1. Problem and failure example

Ordinary API startup used a fixed email/password to create an administrator. If a user already had that email, startup added Admin to that account. A matching email was treated as permission to become privileged.

A customer could own the fixed-email account before restart and receive Admin without operator approval. A fresh deployment could also expose a known credential. Whether any production account remained exposed was not inspected.

The pre-fix Phase 0 Production-startup assertion failed as expected. A demo button advertised the same administrator credentials in the login page.

## 2. Invariants

- Ordinary web startup creates no administrator account and performs no email-based promotion.
- Role definitions remain available; defining Admin is different from assigning it to a user.
- Existing administrator accounts, passwords and roles are preserved.
- Initial privilege requires the explicit operator command.
- Existing accounts are never promoted through bootstrap.
- Bootstrap closes once an Admin assignment exists.
- Account creation and Admin assignment commit together or roll back.
- A failed Identity result is checked, not silently ignored.
- Passwords are supplied through a protected prompt, not source, arguments, redirected input, logs or documentation.
- The command exits without starting the web server.

## 3. Previous architecture

Web startup -> seed roles -> look up hardcoded email -> create known-password user or promote matching user -> start HTTP.

Creation and role-assignment results were not consistently checked. Privilege creation was coupled to ordinary application availability.

## 4. Implemented architecture

### Normal startup

Program detects no bootstrap command
-> build existing web application
-> ensure Customer/Worker/Admin role definitions
-> check every role-creation result
-> keep existing schema/category initialization
-> start HTTP.

There is no fixed-email account lookup and no startup UserManager account/role-assignment call. Existing accounts are not rewritten.

### Explicit operator command

Program sees bootstrap-admin as the first argument
-> reject extra arguments
-> require interactive input/output
-> read email and two hidden password entries
-> reject missing/mismatched input
-> build a non-web host using the configured Identity database
-> create a dedicated scope
-> perform initial bootstrap
-> print only a non-secret outcome
-> exit.

The command branch runs before web configuration, Serilog startup, JWT checks, startup schema DDL and listener creation. It does not call Host.Start or WebApplication.Run.

AdminBootstrapCommand uses the same current password settings as normal Identity registration: minimum length eight, unique email, existing framework uppercase/lowercase/digit requirements, no required non-alphanumeric character. No custom password hashing is implemented. Policy changes must keep these two registration sites aligned.

### Identity transaction

AdminBootstrapper:
1. Trims/validates the email and rejects empty password input.
2. Uses the SQL execution strategy, which can retry transient failures.
3. Clears tracked entities from a previous rolled-back attempt.
4. Starts a serializable transaction.
5. Rejects an existing email or username match.
6. Ensures the Admin role exists and checks its creation result.
7. Rejects bootstrap if any Admin user already exists.
8. Creates a new user through UserManager and checks IdentityResult.
9. Assigns Admin through UserManager and checks IdentityResult.
10. Commits, then returns the created user ID.

Identity stores share the scoped KarigorDbContext. Their individual saves remain inside the same transaction. On rejection/error, disposing the uncommitted transaction rolls back.

Serializable isolation protects the no-admin decision against competing bootstrap transactions. A coordinated test forces two distinct-email operations past that read before allowing creation. One wins; the other sees bootstrap closed after retry. This guarantee is scoped to this command; it is not a redesign of registration, payments or sessions.

Bootstrap does not set EmailConfirmed or send verification email. The authorized operator supplies the intended address; this is not email-ownership verification.

## 5. Running the command

Provision the existing Identity tables first. Review the intended database connection through protected deployment configuration.

From the published API directory:

```text
dotnet Karigor.Api.dll bootstrap-admin
```

For development, the supported invocation is:

```text
dotnet run --project backend/Karigor.Api --no-launch-profile -- bootstrap-admin
```

The published-DLL form was exercised against a generated local fixture. The development invocation above is an instruction, not a separately executed verification claim.

The command's non-web host reads appsettings from the executable directory and standard host environment configuration. Use DOTNET_ENVIRONMENT when selecting its environment; the normal web host also uses its existing ASP.NET environment configuration. A JWT key is not required by bootstrap.

Enter the operator-selected email, password and confirmation. Password characters are not echoed. Extra arguments and piped/redirected input are refused. Never put the administrator password into an environment variable, script, command argument or documentation.

| Exit | Meaning |
|---|---|
| 0 | Database creation/assignment was confirmed |
| 2 | Usage, noninteractive terminal or missing/mismatched prompt input |
| 1 | Bootstrap did not confirm success; inspect account/role/configuration before retrying |

A commit whose response is lost may have created a complete account. Exit 1 is not universal proof that nothing committed. The transaction prevents a partial user/role result; inspect state before repeating an uncertain operation.

On a hosting panel without an interactive console, run the published API from a trusted operator machine with authorized database connectivity. No hosting console, production connection or deployment was exercised here.

See [deployment instructions](../../MONSTERASP_DEPLOYMENT.md) and [database setup](../../../database/production/README.md).

## 6. Why this design

| Alternative | Why considered | Why rejected/deferred |
|---|---|---|
| Development-only known admin seeding | Easy demonstrations | Still encourages shared credentials and startup privilege; no product need established |
| One-time startup environment flag | Simple deployment toggle | Couples privilege creation to serving HTTP and can accidentally remain enabled |
| Password in process arguments or piped stdin | Easy automation | Argument/history/process exposure; hidden prompt is practical here |
| Direct Identity SQL inserts | Avoid application command | Bypasses password hashing/normalization/Identity validation |
| Promote an existing matching account | Convenient recovery | Email match is not approval; any future promotion workflow must target a reviewed identity |
| New console project/framework/IAM/MFA | Separation or more controls | Existing assembly plus early mode is sufficient for the authorized scope |
| Check account/role without transaction | Less code | Can leave an account after role assignment fails or allow competing initial administrators |

A serializable transaction can block or deadlock competing requests. The command is rare and short; transient SQL retry handles deadlock recovery. No distributed lock, broker, cache or new database object is required.

Identity failure descriptions are not printed; they can contain input. Diagnostics are deliberately limited to safe outcomes. This helps secrecy but makes operator troubleshooting less detailed.

The implementation matches the approved F2 approach. ADR 0001 is zero bytes in this checkout and remains unchanged; no unrelated Proposed decisions were changed.

## 7. Failure scenarios

| Scenario | Behavior / verification |
|---|---|
| Invalid email or weak password | No user/role remains in the fresh fixture; actual Identity validation tested |
| Role creation returns a failed IdentityResult | Error checked; no user/role persisted; sensitive description not exposed |
| SQL rejects Admin assignment | User creation rolls back; no account or assignment; actual CHECK fault tested |
| Two initial commands compete | Barrier-coordinated serializable test produces one account/Admin assignment |
| Existing customer matches email/username | Refused; existing role/password preserved |
| Existing administrator | Bootstrap closed; normal startup preserves account and actual login succeeds |
| Redirected input or extra arguments | Actual API child process exits 2 before web startup |
| Prompt confirmation mismatch | Exits before host/database configuration |
| SQL commit/response becomes uncertain | No success is asserted; inspect state before retrying |
| Current production default may already exist | Preserved, not inspected/rotated/revoked; separate authorized operator review needed |

Role seeding itself now fails visibly if Identity cannot create a required role. Successful sequential restarts preserve the existing role definitions.

## 8. Database and security implications

No schema/model/migration/index change was added.

Existing AspNetUsers, AspNetRoles and AspNetUserRoles store the result. The existing unique normalized username and role-name indexes remain. Serializable reads and one transaction protect this command's decision and writes.

The only production SQL-file change is an explanatory comment in 002_seed.sql. Executable seed/schema SQL is unchanged. Test-only CHECK constraints live in generated loopback databases, not production.

This command is an operator tool, not an HTTP authorization endpoint. Its authority comes from trusted access to the executable and database configuration. It does not authenticate remote users, add MFA or repair session revocation.

Removing startup seeding does not invalidate an already exposed administrator. Never delete/promote/rotate existing production accounts automatically as a migration. Legacy-account investigation, credential rotation and session review remain separate authorized operator work.

The obsolete Admin Demo handler/button was removed. Other demo buttons and historical development logs remain outside this task. Archived credential examples are not current setup instructions.

## 9. Tests and what each proves

| Test | Cases | Setup | Action | Expected result | Invariant / layer |
|---|---|---|---|---|---|
| OrdinaryProductionStartupDoesNotProvisionDefaultAdministrator | 1; original promoted | Fresh Production-style WAF host | Start actual API | No fixed-email account created | No implicit privileged identity; startup + SQL |
| RealCommandRejectsRedirectedInputOrExtraArgumentsWithoutStartingWebServer | 2: redirected input, extra argument | Actual API child process, redirected streams | Invoke bootstrap-admin | Exit 2; no web-start/listening output | Operator mode is explicit and non-web; process test |
| MissingOrMismatchedPromptInputStopsBeforeDatabaseConfiguration | 3: email, password, confirmation | Synthetic prompt; no database supplied | Invoke command | Exit 2; no secret output | Invalid prompt cannot reach provisioning; unit |
| ExplicitBootstrapCreatesExactlyOneRequestedAdministrator | 1 | Fresh generated SQL Identity schema | Run actual command with test input/config | Exit 0; one hashed account/Admin assignment | Requested identity and privilege created together; SQL integration |
| RepeatedBootstrapAndAdditionalAdministratorAreRejected | 1 | One successfully bootstrapped account | Repeat same email, then try another email | Exit 1; one account/assignment, original password unchanged | Initial bootstrap closes and never overwrites; SQL integration |
| BootstrapNeverPromotesAnExistingCustomer | 2: email match, username-only match | Existing customer and password | Request its address/name as bootstrap | Exit 1; customer preserved, no Admin | Matching an account is not promotion authority; SQL integration |
| InvalidIdentityInputLeavesNoAccountOrRole | 2: bad email, weak password | Fresh generated database | Attempt bootstrap | Exit 1; zero users/assignments/roles | Input/Identity failure rolls back creation; SQL integration |
| RoleAssignmentSqlFailureRollsBackAccountCreation | 1 | Fixture-only CHECK rejects Admin assignment | Run bootstrap | Exit 1; no account or assignment | User creation cannot partially commit; real SQL fault |
| RejectedRoleIdentityResultIsCheckedWithoutLeakingInput | 1 | Real RoleManager with rejecting validator; sensitive description | Call bootstrap service | Throw safe error; no user/role; description absent | Failed Identity results are not ignored; SQL + Identity |
| CoordinatedConcurrentBootstrapCreatesOnlyOneAdministrator | 1 | Two scopes, distinct emails, validator barrier after no-admin reads | Run both bootstrap operations | One success; one closed-bootstrap rejection; one user/assignment | Serializable initial bootstrap prevents two winners; real SQL/barrier |
| NormalStartupDoesNotPromoteDefaultEmailCustomer | 1 | Create fixed-email customer, restart actual API on same fixture | Read roles/password after restart | Still Customer, not Admin; password works; three roles remain | Startup does not elevate by email; WAF/SQL |
| ExistingAdministratorSurvivesStartupAndCanSignIn | 1 | Existing hashed Admin; restart actual API | POST actual login | 200 with Admin role | Legitimate privileged identities survive; WAF/SQL/auth |
| F2: login page offers no default administrator demo credentials | 1 | Real LoginPage fixture with local mocked HTTP | Open login | Customer/Worker demos present; Admin Demo absent | Product UI no longer advertises default privilege; browser |

Seventeen backend cases passed; the login browser case passed. The original F2 assertion was preserved and promoted; only its manifest exception was removed after observed passes.

The concurrency test uses a barrier in user validation after both operations read the no-admin condition. It does not rely on Thread.Sleep. Separate scopes use separate SQL contexts/connections.

The terminal smoke test used a uniquely generated loopback SQL database, a synthetic account and a generated test password. Neither password entry appeared in terminal output. The real command exited 0, SQL showed one user and one assignment, and finally removed the fixture.

## 10. Actual commands and results

```text
python scripts/run-security-tests.py --strict --filter "Finding=F2"
dotnet build Karigor.slnx --configuration Release --no-restore
dotnet test tests/Karigor.Security.Tests/Karigor.Security.Tests.csproj --configuration Release --filter "Finding=F2" --logger "trx;LogFileName=f2-after.trx" --results-directory TestResults/f2
python scripts/run-security-tests.py --no-build --strict --filter "Finding=F2"
npm --prefix karigor-client ci --cache J:\SD_3200_1\TestResults\npm-cache
npm --prefix karigor-client run test:security -- --grep "^F2:"
python scripts/run-security-tests.py --no-build
python -m unittest discover -s scripts/tests -v
npm --prefix karigor-client run typecheck:security
npm --prefix karigor-client run test:security
npm --prefix karigor-client run build
npm --prefix karigor-client run lint
```

The first F2 command was pre-fix: one known assertion failure, exit 1. The raw post-fix and strict accounted F2 runs each passed 17 cases. The login browser run passed one.

Initial build warnings concerned only test DDL formatting and an xUnit assertion style; both were corrected. Final backend build: zero warnings/errors.

Combined backend: 73 cases, 68 passes, five exact F3/F5/F7 failures, zero skips. Raw dotnet exit 1; classifier gate exit 0. This is not a claim that those other vulnerabilities are fixed.

Combined browser: 19 passes, no expected failures/skips. Existing F1 cases remained green. Classifier self-tests: six passes. Typechecks and frontend build passed; existing config/bundle warnings remain. Lint returned 0 with 20 existing warnings; no new warning was introduced.

The manual terminal command was launched inside a guarded generated-database script, using the published-DLL invocation above and the fixture-only ConnectionStrings__DefaultConnection environment setting. sqlcmd applied the existing schema, verified counts and dropped only the generated database. No production database/password was used.

Reports:
- pre-fix F2: TestResults/security/d054f018f1384ecdb87d58f628bb63ca/security.trx;
- post-fix raw: TestResults/f2/f2-after.trx;
- strict F2: TestResults/security/6d9c8c4deacf443ea719af0d1f97d52e/security.trx;
- combined: TestResults/security/6c55c53bd0044fa78f025bb476242707/security.trx;
- browser: karigor-client/test-results/security-browser/results.json.

Browser runs used installed Chrome, KARIGOR_TEST_BROWSER_CHANNEL=chrome and the real Node/npm directory prepended to PATH. Third-party requests were blocked. Google/SignalR console errors in controlled fixtures are expected mocked-service messages, not live integration proof.

Final checks passed: git diff --check using repository line-ending settings, exact 21-file F2/F4 scope, original regression-assertion preservation, unchanged prior study history, UTF-8/fence/relative-link checks, required study sections, report-counter checks and identical executable seed SQL. A read-only SQL query found zero generated fixture databases. No test process referenced this worktree. Approved plan/ADR, F1 production surfaces, CI, solution and package/lock files remain unchanged.

## 11. Files changed

| File | Change | Reason |
|---|---|---|
| backend/Karigor.Api/Program.cs | Early explicit command dispatch; roles-only ordinary startup | Remove default creation/promotion |
| backend/Karigor.Api/Administration/AdminBootstrapCommand.cs | Hidden prompt; no args/piping; non-web service host; safe exit messages | Separate operator provisioning from HTTP startup |
| backend/Karigor.Api/Administration/AdminBootstrapper.cs | Initial-only Identity creation in retried serializable SQL transaction | Reject promotion/partial privilege/concurrent winners |
| backend/Karigor.Api/Administration/IdentityRoleSeeder.cs | Idempotent role definitions and checked Identity results | Preserve roles without implicit users |
| karigor-client/src/pages/auth/LoginPage.tsx | Remove Admin Demo handler/button | Retire unsafe credential shortcut |
| tests/Karigor.Security.Tests/AdminBootstrapCommandTests.cs | Five command/input tests | Prove process exit and prompt rejection |
| tests/Karigor.Security.Tests/AdminBootstrapSecurityTests.cs | Eleven actual SQL/startup/login/bootstrap cases | Verify authority, rollback and coordination |
| tests/Karigor.Security.Tests/ApiSecurityTests.cs | Promote original F2 classification; assertion unchanged | Make verified startup rule blocking |
| tests/known-security-defects.json | Remove only F2_DEFAULT_ADMIN entry | Keep unrelated failures explicit |
| karigor-client/e2e/fixtures/payment.tsx | Test-only option mounts actual LoginPage | Reuse existing auth/query/router fixture; payment code unchanged |
| karigor-client/e2e/admin-bootstrap.security.spec.ts | Actual login UI regression | Verify Admin Demo removal |
| docs/MONSTERASP_DEPLOYMENT.md | Replace automatic/default admin setup with explicit prompt command | Correct operator instructions |
| database/production/README.md | Replace automatic admin setup instructions | Correct provisioning sequence |
| database/production/002_seed.sql | Admin-setup comment only; executable SQL identical | Remove misleading automatic-provisioning note |
| docs/security/implementation/F2_SECURE_ADMIN_BOOTSTRAP.md | Final F2 architecture, commands/tests/limits | Technical implementation reference |
| docs/security/SECURITY_WORKDONE.md | Append two dated study entries; preserve Order 0/F1 history | Explain why each task matters |
| docs/testing/PHASE1_SECURITY_TEST_HARNESS.md | Update current F2/F4 status; preserve prior evidence | Keep current gates distinguishable from historical red tests |

The shared log/harness changes also record F4. The separate F4 guide lists its map files. Dependency locks, CI workflows, payment architecture and database schema were not changed.

## 12. Limitations and recovery

- Local Windows terminal behavior was verified; Linux/hosting-panel interactive behavior and GitHub-hosted CI were not run.
- Passwords briefly exist as managed strings during provisioning; hidden entry is not protection against a compromised operator machine.
- No durable operator audit trail or email-verification workflow was added.
- Existing administrators are preserved, including any historically unsafe one; production credential state remains unknown.
- Initial bootstrap refuses additional administrators; future reviewed account management is separate.
- Normal and command Identity password-policy settings must stay aligned.
- Do not roll back to the old known-password/email-promotion startup behavior. If bootstrap is unavailable, inspect/fix the operator workflow while preserving safe ordinary startup.
- Payment concurrency, SignalR resource access, negotiation and refresh/document architecture remain outside scope.
- No commit, push, merge, deployment or production credential change occurred.

## 13. Educational scaling

| Scale | What remains appropriate |
|---|---|
| 100 users | One rare operator command and existing Identity tables |
| 10,000 users | Keep privilege creation explicit; measure deployment/startup role contention if present |
| 1,000,000 users | Educational concern: reviewed administration/audit processes; do not move initial provisioning into public startup |

No scaling infrastructure was added. The same authority/atomicity invariant applies at each size.

## 14. Flow

```mermaid
sequenceDiagram
    actor Operator
    participant Command as bootstrap-admin
    participant Identity
    participant SQL
    Operator->>Command: Interactive email + hidden password/confirmation
    Command->>SQL: Serializable transaction
    Command->>Identity: Reject existing account; ensure Admin; check no Admin user
    Command->>Identity: Create user; check result
    Command->>Identity: Assign Admin; check result
    alt All operations succeed
        Command->>SQL: Commit
        Command-->>Operator: Confirmed; exit 0; no HTTP server
    else Rejection / Identity / SQL failure
        Command->>SQL: Roll back uncommitted writes
        Command-->>Operator: No confirmed success; safe message; exit
    end
```

## 15. Interview explanations

### 30 seconds

Karigor used to create a known-password administrator, or promote a matching email, whenever the API started. I removed that behavior and kept role definitions. Initial privilege now requires an explicit non-web command with hidden password input. Identity creation and Admin assignment run in one serializable SQL transaction. Startup, rollback, existing-account preservation and competing bootstrap tests pass.

### Two minutes

The issue was unsafe default privilege. Application availability and administrator provisioning shared the same startup path, and an email match could silently elevate an existing customer.

I kept the existing Identity and SQL stack. Ordinary startup seeds roles only. The explicit bootstrap-admin mode runs before web construction, accepts no arguments for secrets, requires a terminal and reads the password twice without echo.

Inside a dedicated scope, the service rejects existing accounts, checks that no administrator already exists, then creates the user and assignment through Identity. All operation results are checked. One serializable transaction and the SQL retry strategy protect both atomicity and the initial-only decision.

Tests use disposable SQL, real Identity, restarted Production-style hosts, actual login and real command child processes. A CHECK fault proves account creation rolls back if assignment fails. A barrier lets two operations reach the no-admin window; exactly one commits. A real terminal smoke test also confirmed hidden input and non-web exit.

The tradeoff is an explicit operator step and less verbose secret-safe errors. It does not rotate existing credentials or prove production account safety. Those remain a reviewed operator responsibility.

### Five questions

1. **Why keep Admin role seeding?** A role definition is permission metadata; it grants nothing until a user is assigned.
2. **Why reject an existing email?** Matching a string does not prove operator-approved promotion of that identity.
3. **Why a transaction around Identity?** User creation saves separately from role assignment; both must commit together.
4. **Why serializable and a barrier test?** Two commands can both see no admin. Serializable protects that decision; the barrier proves real overlap rather than guessing with delays.
5. **What happens to old administrators?** Their account/role/password remains. Removing unsafe startup does not rotate exposed credentials.
