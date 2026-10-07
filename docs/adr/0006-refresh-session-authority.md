# ADR 0006: SQL RefreshSession authority and strict one-use rotation

Date: 2026-10-07. Status: implemented; local evidence and rollout limits are in the [F6 architecture](../security/implementation/F6_REFRESH_SESSION_ARCHITECTURE.md) and appended security study. This decision concerns F6 and its necessary integration with F3, not an OAuth rewrite.

## Context

The former refresh path read a token, separately checked account lockout, retired that row and inserted a successor without a shared family authority. Its 60-second grace branch minted access credentials and returned the revoked predecessor cookie. Two requests could both consume one token, a delayed response could reinstall that predecessor, and logout/suspension could race a successor insert. Access JWTs had no family binding. F3 already checked current booking participation and selected private recipients from SQL, but its user-group delivery could not distinguish a logged-out session from another device belonging to the same user.

## Decision

SQL Server owns a small absolute-lifetime RefreshSession, one per login. Tokens retain only random-token SHA-256 hashes and bind to the family; SQL unique indexes enforce hash uniqueness, one child and one unconsumed token per family. Token rowversion provides conditional consumption, with User ? Session ? Token lock ordering for refresh, logout, suspension and new-session creation. Family/session rowversions remain database concurrency metadata; shared locks, not timestamps or a per-process mutex, provide revocation ordering.

An initial read defines overlap. If both calls observed active, one commits and the other gets 409 without any Set-Cookie or family revocation. If a new call first observes a consumed unexpired token, commit family revocation and return 401. Expiry is checked before replay handling. No grace credential, predecessor cookie recovery or automatic retry of an unknown commit outcome is allowed.

JWTs include sid and every bearer authentication checks current indexed SQL session/account state. Sensitive hub methods repeat session/expiry checks plus the existing F3 resource policy. Local connection metadata lets private pushes filter individual current sessions and JWT expirations; it is not an authorization cache. Authentication expiration closes connections. Already authorized/in-flight work cannot be recalled; the promise applies at each subsequent authorization/delivery eligibility boundary.

All cookie-mutating authentication POSTs require an explicit trusted Origin and a non-simple CSRF header. Logout can therefore safely identify a family through its HttpOnly cookie even if access has expired. It revokes that family and returns generic success. Suspension revokes every family and prevents concurrent new issuance using the shared Identity lock.

The browser keeps in-tab single flight and uses Web Locks to serialize all auth cookie mutations across same-origin tabs. Only generation/signed-out metadata goes to localStorage/BroadcastChannel. Old-account requests/results are invalidated; a lost success requires reauthentication. Missing coordination support fails closed.

The sole forward migration is canonical SQL 008, with read-only preflight and explicit apply/reset acknowledgement. Legacy rows are retired with no fabricated family relationship; old JWTs without sid fail. No independent EF migration, automatic startup DDL or production data rewrite is permitted.

## Alternatives and consequences

- Grace replay and returning an old cookie are rejected because they violate strict consumption and response-order safety.
- Revoke on every failed overlapping consume is rejected because it needlessly kills a winner that raced from an active observation.
- Stateless JWT expiry alone is rejected because logout/suspension would leave the old JWT authorized until expiry.
- Per-process refresh locks are rejected as SQL correctness authority; separate API instances would not share them. Browser Web Locks solve a different problem: response/cookie ordering.
- Redis or cached allow records are deferred until measured SQL cost justifies a reviewed change to revocation latency/failure semantics.
- User groups alone are insufficient for private session isolation. A small local connection registry is sufficient for the current single-process SignalR topology; scale-out needs explicit follow-up.
- Absolute expiry, strict lost-response behavior, a planned forced sign-in reset and required browser coordination trade availability/convenience for simpler authority.
- Auth requests and private delivery now depend on SQL availability; outage fails closed. Ordinary role-claim changes, session-management UI, cleanup jobs, durable push and broad identity-provider redesign remain outside this decision.

## Verification / rollout

The suite uses controlled TimeProvider, SQL command barriers, actual row/index assertions, HTTP cookies, hosted WebSockets including timed closure, and real Chrome multi-tab fixtures. Full Phase 1 regression evidence is reported separately rather than inferred from F6. Deploy only after a writer outage and explicit schema reset; old binaries or restored backups cannot be treated as a safe transparent rollback. No deployment or production modification is authorized by this ADR.
