Milestone 2 Plan — Authentication & Authorization (Execution Run 4)

Overview
- Goal: Implement and verify Customer and Worker authentication flows using ASP.NET Core Identity with JWT access tokens and secure refresh tokens, along with role-based authorization.
- Prerequisites: Local SQL Server instance accessible (KarigorDev) with Identity schema in place. Resolve any connectivity issues before runtime verification.

1) Preflight checks (read-only)
- Confirm ApplicationUser inherits IdentityUser (codebase) and KarigorDbContext inherits IdentityDbContext<ApplicationUser> (codebase).
- Confirm ApplicationUser maps to AspNetUsers and that FK relationships reference Identity user (CustomerProfile.UserId, WorkerProfile.UserId, RefreshToken.UserId).
- Confirm Identity tables exist in KarigorDev (AspNetUsers, AspNetRoles, AspNetUserClaims, AspNetUserLogins, AspNetUserTokens, AspNetRoleClaims) and domain tables (CustomerProfiles, WorkerProfiles, ServiceCategories, etc.).
- Confirm backend builds clean (dotnet build Karigor.slnx).
- Confirm front-end category API endpoint exists and works (GET /api/categories).

2) Backend design and data model adjustments
- Ensure Identity integration is in place: ApplicationUser inherits IdentityUser; KarigorDbContext extends IdentityDbContext<ApplicationUser>.
- Ensure mappings for 3 key domain entities reference Identity user: CustomerProfile, WorkerProfile, RefreshToken.
- Seed/create roles if not existing: Customer, Worker, Admin (idempotent).

3) Authentication endpoints (backend)
- POST /api/auth/register/customer
  - Validate input; create Identity user; assign Customer role; create CustomerProfile; enforce transactional integrity.
- POST /api/auth/register/worker
  - Validate input (including skills and initial category), create Identity user; assign Worker role; create WorkerProfile; create WorkerSkills entries connecting to ServiceCategories; enforce transactional integrity.

4) Login and tokens
- POST /api/auth/login
  - Validate credentials; issue short-lived access token (JWT) with required claims including Role; issue long-lived refresh token; store RefreshToken in DB as hash with expiration; link to user.

5) Refresh and logout
- POST /api/auth/refresh
  - Validate refresh token (hash compare); enforce rotation; issue new access token and new refresh token; revoke and replace old token; link replacements.
- POST /api/auth/logout
  - Revoke current refresh token for the user.

6) Protected endpoints and tests
- Create sample endpoints protected with [Authorize(Roles = "...")], testing Negative (Customer token on Worker-only) and Positive (Worker token on Worker-only).
- Verify by making actual HTTP requests and validate responses (403 vs 200).

7) Frontend scaffolding (optional for initial pass)
- Set up basic login/registration forms; manage authentication state; ensure HttpOnly cookies for refresh tokens; wire API base URL to local backend; provide protected-route wrapper and role-based dashboards.

8) Verification suite (WORK_DONE.md)
- Execute test cases and log evidence for each milestone test:
  - Customer registration -> user + AspNetUsers + CustomerProfiles
  - Worker registration -> user + AspNetUsers + WorkerProfiles + WorkerSkills
  - Login -> access token + refresh token handling
  - JWT verification -> correct Role claim
  - Negative authorization test
  - Positive authorization test
  - Refresh token rotation and reuse tests
  - Logout -> refresh token revoked
  - Frontend customer/worker flows
  - Page refresh -> session restoration via refresh flow
  - Backend build -> zero errors
  - Warnings check
  - WORK_DONE.md evidence sections for each test

9) Final gates
- Milestone 2 final gate will re-run the verification suite against the exact requirements and log the results in WORK_DONE.md.

Notes
- Do not store signing secrets in source control; keep secrets in user secrets or vaults.
- Do not store plaintext refresh tokens; hash them and store only hashed values with rotation.
- Use constant-time comparisons for token checks where applicable.
- Do not create a parallel authentication system; use ASP.NET Core Identity.

Next steps
- Await confirmation to proceed with the implementation plan above.
