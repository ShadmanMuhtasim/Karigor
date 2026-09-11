You are the deployment engineer responsible for taking my existing KARIGOR project from its current repository state all the way to a working production deployment on MonsterASP.NET.

Repository:

https://github.com/ShadmanMuhtasim/Karigor

MonsterASP dashboard:

https://admin.monsterasp.net/app/dashboard

You have permission to inspect and modify the repository files required for this deployment.

Your goal is NOT simply to write a deployment workflow.

Your goal is to:

AUDIT â†’ PREPARE â†’ CONFIGURE â†’ BUILD â†’ DATABASE PREPARE â†’ CREATE CD â†’ CONFIGURE DEPLOYMENT â†’ DEPLOY â†’ VERIFY â†’ FIX DEPLOYMENT ISSUES

and leave KARIGOR in a working, repeatable production deployment state.

==================================================
0. PROJECT CONTEXT
==================

KARIGOR is currently:

* ASP.NET Core Web API
* React + Vite + TypeScript frontend
* SQL Server / MSSQL
* Entity Framework Core
* Database-First architecture
* ASP.NET Core Identity
* JWT authentication
* Refresh-token authentication using httpOnly cookies
* SignalR / real-time functionality
* Service-request images and worker-document uploads
* GitHub Actions CI already exists
* Separate backend and frontend CI workflows already exist
* Local development currently uses SQL Server Express and localhost URLs

Current local architecture is approximately:

React/Vite
â†“
localhost:5253 ASP.NET Core API
â†“
.\SQLEXPRESS / KarigorDev

Target architecture:

```
                GitHub
                   â”‚
                   â–¼
             GitHub Actions
                   â”‚
         Build + Test + Publish
                   â”‚
                   â–¼
              WebDeploy
                   â”‚
                   â–¼
            MonsterASP IIS
                   â”‚
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚              â”‚              â”‚
  React         ASP.NET        SignalR
  SPA             API             â”‚
    â”‚              â”‚              â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                   â”‚
                   â–¼
            MonsterASP MSSQL
```

IMPORTANT:
Prefer hosting the React/Vite production build from the ASP.NET Core application's published site so that the frontend, API, Swagger and SignalR use one production origin.

Do NOT migrate the database to PostgreSQL.

Do NOT introduce Docker unless MonsterASP absolutely requires it.

Do NOT replace ASP.NET Core.

Do NOT replace React/Vite.

Do NOT convert Database-First into Code First.

Do NOT redesign application functionality.

Do NOT rewrite working business logic unnecessarily.

Do NOT remove existing features merely to make deployment easier.

==================================================

1. FIRST: INSPECT THE ACTUAL REPOSITORY
   ==================================================

Before changing anything, inspect the repository comprehensively.

Do not rely on assumptions from this prompt if the repository says otherwise.

Determine:

A. Actual .NET target framework from every relevant .csproj.

B. Actual solution structure.

C. ASP.NET Core startup configuration.

D. Program.cs.

E. Dependency injection configuration.

F. appsettings.json.

G. appsettings.Development.json.

H. Any appsettings.Production.json.

I. Connection-string configuration.

J. JWT configuration.

K. CORS configuration.

L. authentication and authorization configuration.

M. refresh-token cookie implementation.

N. SameSite/Secure/HttpOnly settings.

O. SignalR hubs.

P. SignalR frontend clients.

Q. React API configuration.

R. Axios configuration.

S. Vite configuration.

T. frontend environment variables.

U. React Router configuration.

V. existing wwwroot.

W. static-file configuration.

X. current file-upload implementation.

Y. upload directories.

Z. database scripts.

AA. EF Core DbContext and models.

AB. Identity schema.

AC. seed scripts.

AD. existing GitHub Actions workflows.

AE. all localhost references.

AF. hard-coded URLs.

AG. hard-coded production-sensitive configuration.

AH. existing tests.

AI. existing build commands.

AJ. existing deployment-related files.

AK. existing web.config.

AL. any IIS-specific configuration.

==================================================
2. CHECK MONSTERASP COMPATIBILITY
=================================

The repository currently may target .NET 10.

DO NOT assume MonsterASP's available runtime matches the repository.

Determine the application's actual target framework first.

Then determine the deployment strategy appropriate for MonsterASP.

You must explicitly account for both possibilities:

OPTION A:
MonsterASP provides a compatible .NET runtime/hosting bundle.

Then prefer framework-dependent deployment when reliable.

OPTION B:
MonsterASP does NOT provide a compatible runtime.

Then evaluate:

dotnet publish -r win-x64 --self-contained true

and determine whether self-contained deployment is practical given:

* hosting plan storage limits
* memory limits
* deployment size
* IIS compatibility
* MonsterASP limitations
* application runtime requirements

Do not blindly downgrade the project.

If .NET 8/9 is materially safer than .NET 10 and a downgrade is genuinely necessary, first inspect how large and invasive that change would be.

Prefer the smallest change that produces a reliable production deployment.

Do not change the target framework merely because an old tutorial uses .NET 8.

Document the final decision and why it was chosen.

==================================================
3. AUDIT AND FIX DEVELOPMENT/PRODUCTION CONFIGURATION
=====================================================

Prepare clean environment separation.

LOCAL DEVELOPMENT must continue working.

PRODUCTION must not depend on:

.\SQLEXPRESS
KarigorDev
Windows Authentication
localhost:5253
localhost:5173
development JWT secrets

Production connection configuration must come from external configuration, preferably:

ConnectionStrings__DefaultConnection

Production JWT configuration must come from external configuration:

Jwt__Key
Jwt__Issuer
Jwt__Audience

Never put actual production secrets in:

* Git
* appsettings.json
* appsettings.Production.json
* source code
* README
* workflow YAML
* documentation

Keep existing User Secrets / development configuration for local development.

==================================================
4. PRODUCTION FRONTEND ARCHITECTURE
===================================

Configure the React/Vite application so that production uses same-origin API requests wherever practical.

Instead of:

http://localhost:5253/api/...

prefer production:

/api/...

Likewise, SignalR should use the deployed production origin rather than localhost.

Do NOT break local development.

The frontend must still function with:

localhost:5173
â†’
localhost:5253

during development.

Build the frontend using the repository's actual Node version.

Current CI is expected to use Node 20, but verify the repository before changing anything.

Use:

npm ci
npm run build

Do not use npm install for the production CI build when package-lock.json is available.

==================================================
5. SPA ROUTING / IIS
====================

React Router routes MUST survive direct browser navigation and refreshes under IIS.

Do NOT rely only on:

app.MapFallbackToFile("index.html")

Because IIS may intercept missing physical paths before the ASP.NET Core pipeline handles them.

Explicitly inspect whether a web.config is required.

Create or modify the deployed web.config as necessary to support SPA fallback under IIS.

The configuration must:

* allow ASP.NET Core requests to reach the application
* serve static files correctly
* support React client-side routing
* avoid rewriting /api/*
* avoid breaking SignalR endpoints
* avoid interfering with /swagger
* avoid rewriting actual static files

Examples of frontend routes that must work after a direct refresh include:

/login
/register
/customer/...
/worker/...
/admin/...

Do not create a rewrite rule that accidentally forwards every request, including /api or SignalR, to index.html.

Verify the final routing behavior locally before deployment.

==================================================
6. ASP.NET STATIC FILES
=======================

Ensure the ASP.NET Core application correctly serves:

* React production assets
* favicon/assets
* uploaded public files where applicable

Use appropriate:

UseStaticFiles()
MapFallbackToFile("index.html")

or the equivalent configuration compatible with the actual application.

The API and SignalR endpoints must remain functional.

==================================================
7. FILE UPLOADS â€” CRITICAL
==========================

Inspect how KARIGOR currently stores:

* worker documents
* service-request images
* other uploaded files

Do NOT simply place persistent user uploads in a directory that WebDeploy will overwrite or delete on every deployment.

This is a production data-integrity requirement.

Design the upload storage so deployment of the application does NOT wipe existing user-uploaded files.

Prefer an application-data/storage directory outside the publish artifact and outside files that are replaced by WebDeploy.

If MonsterASP supports a persistent site-level storage directory appropriate for this purpose, use that.

If uploads must exist under the site directory, configure WebDeploy/MSDeploy skip rules or deployment exclusions so the upload directory is preserved.

Do NOT assume files under wwwroot/uploads are automatically safe.

Determine the actual deployment behavior and choose a robust approach.

Make upload paths configurable through application configuration.

Do not hard-code local Windows paths such as:

C:...
J:...
D:...

The application must not depend on the developer's computer.

Make sure the application can create/access the storage directory in the MonsterASP IIS identity context.

If uploaded files are exposed through HTTP, configure a safe static-file mapping or controller-based download endpoint as appropriate.

Do not expose private worker documents publicly unless the existing application explicitly requires public access.

Preserve current application behavior where possible, but prioritize preventing deployment from deleting user data.

==================================================
8. CORS
=======

Because the preferred architecture is same-origin:

React
+
ASP.NET Core
â†’
same HTTPS hostname

minimize unnecessary CORS requirements.

Do not use:

AllowAnyOrigin()

with credentials.

Do not create a permissive production CORS policy.

Keep localhost origins for Development where required.

Production should allow only the actual production frontend origin if cross-origin requests are genuinely required.

Verify cookies and authentication under the final architecture.

==================================================
9. REFRESH-TOKEN COOKIE CONFIGURATION
=====================================

Inspect the existing refresh-token cookie implementation rather than blindly replacing it.

For same-origin HTTPS production, configure the cookie appropriately.

At minimum evaluate:

HttpOnly = true
Secure = always in Production
SameSite = Lax or an equivalent safe same-origin configuration
Path = appropriate refresh-token path

Use:

CookieSecurePolicy.Always

or the equivalent production-safe behavior where appropriate.

Do not blindly use SameSite=None.

Only use SameSite=None when there is a genuine cross-site requirement.

Keep local Development behavior working.

Verify that:

* login succeeds
* refresh-token cookie is created
* refresh endpoint can read it
* logout clears it
* authenticated requests remain valid after token refresh

==================================================
10. SIGNALR
===========

Inspect all current SignalR hubs and clients.

Do NOT disable SignalR.

Do NOT replace SignalR with polling.

Production SignalR URLs must use the deployed HTTPS origin.

The frontend should use a pattern equivalent to the same-origin hub path rather than localhost.

Configure SignalR client reconnect behavior using the actual current library/API in the project.

Use automatic reconnect where compatible.

Explicitly account for environments where IIS/MonsterASP WebSockets may be unavailable or restricted.

Where practical, configure Long Polling as a fallback transport.

Do not assume WebSockets are automatically available.

Check whether MonsterASP provides a WebSocket/WebSockets setting in the dashboard.

If such a setting exists, document/configure it.

If it does not, ensure SignalR remains usable through its supported fallback transport.

Do not make unsupported IIS changes.

Verify SignalR connectivity after deployment.

==================================================
11. SWAGGER
===========

Keep Swagger available for this academic project unless there is a specific deployment/security reason not to.

Ensure:

/swagger

works in Production.

Do not expose sensitive secrets through Swagger configuration.

==================================================
12. PRODUCTION ERROR HANDLING / LOGGING
=======================================

Production must NOT use developer exception pages.

Configure appropriate production error handling.

Keep useful application logging.

Do not log:

* passwords
* JWT secrets
* refresh tokens
* database passwords

Make sure application errors can be diagnosed on MonsterASP.

Determine how MonsterASP exposes application logs and document the method.

==================================================
13. DATABASE-FIRST PRODUCTION PREPARATION
=========================================

Inspect:

database/001_initial_schema.sql
database/002_seed_categories.sql

and all relevant database scripts.

Determine exactly what they do.

Pay attention to:

* CREATE DATABASE
* USE KarigorDev
* DROP DATABASE
* DROP TABLE
* local SQL Server assumptions
* Windows Authentication
* SQL Express dependencies
* development-only database names
* hard-coded local paths

Preserve the existing development scripts.

If needed, create separate production-safe scripts such as:

database/production/001_schema.sql
database/production/002_seed.sql

The production scripts must operate against an already-created MonsterASP database.

DO NOT:

* delete the production database
* recreate the production database on application startup
* add destructive automatic database initialization
* run EnsureDeleted()
* blindly reset production data
* convert to Code First

The production database must contain the complete required schema and seed data.

Verify compatibility between:

SQL scripts
â†”
EF Core model
â†”
ASP.NET Identity
â†”
application queries

==================================================
14. MONSTERASP DATABASE
=======================

The production database is a hosted MSSQL database.

Document what must be created manually in MonsterASP:

* database
* database username
* database password
* server/host
* database name
* connection string

Use the exact provider-supplied values.

Do not invent database connection details.

Do not store real credentials in Git.

If SSMS remote access must be enabled, document the required MonsterASP dashboard setting.

Do not assume the local:

.\SQLEXPRESS

connection string can be used on MonsterASP.

==================================================
15. GITHUB ACTIONS â€” KEEP EXISTING CI
=====================================

Existing backend CI and frontend CI already exist.

Inspect both workflows.

Do not unnecessarily replace them.

Create a dedicated deployment workflow, preferably:

.github/workflows/deploy-monsterasp.yml

The preferred trigger is:

push:
branches:
- main

Also consider:

workflow_dispatch:

so I can manually deploy from GitHub Actions.

Deployment must NOT run when validation fails.

==================================================
16. CD PIPELINE
===============

The deployment workflow must:

1. checkout repository

2. install the actual required .NET SDK

3. install the required Node.js version

4. restore backend

5. build backend Release

6. run backend tests if tests exist

7. install frontend dependencies using:

npm ci

8. run the frontend's existing validation/typecheck/test commands

9. build frontend:

npm run build

10. copy the Vite production output from:

karigor-client/dist

into the backend application's appropriate wwwroot location

BEFORE:

dotnet publish

11. publish the backend

12. ensure the generated deployment artifact contains:

* ASP.NET Core application
* React frontend
* web.config
* required static assets

13. deploy with MonsterASP WebDeploy

Use the provider's documented GitHub Actions WebDeploy mechanism.

The currently documented MonsterASP GitHub Actions method uses:

rasmusbuchholdt/simply-web-deploy

and the following deployment values/secrets:

WEBSITE_NAME
SERVER_COMPUTER_NAME
SERVER_USERNAME
SERVER_PASSWORD

Use GitHub Secrets.

Never hard-code those values.

==================================================
17. DOTNET PUBLISH STRATEGY
===========================

Determine whether framework-dependent or self-contained deployment is required.

For framework-dependent:

use the appropriate release publish configuration.

For example:

dotnet publish <actual-project> -c Release -o ./publish /p:UseAppHost=false

But do not blindly use a solution path if the repository structure requires publishing the actual web project.

Determine the correct ASP.NET Core project.

If MonsterASP does not provide the required .NET runtime:

evaluate:

dotnet publish <project> -c Release -r win-x64 --self-contained true -o ./publish

Then assess:

* artifact size
* MonsterASP storage
* memory limits
* startup performance
* IIS compatibility

Do not choose self-contained blindly.

Document the final choice.

==================================================
18. WEBDEPLOY / USER UPLOAD PRESERVATION
========================================

Deployment MUST NOT delete persistent user uploads.

Inspect the behavior of the chosen WebDeploy action.

If uploads are outside the deployment artifact, verify this.

If uploads reside in a deployable directory, configure an appropriate skip/exclude rule.

Do not claim uploads are protected unless the implementation actually protects them.

The CD workflow should be safe to run repeatedly.

Multiple deployments must not:

* wipe uploads
* wipe the database
* overwrite environment secrets
* reset application data

==================================================
19. PRODUCTION ENVIRONMENT VARIABLES
====================================

Use MonsterASP application/environment configuration where supported.

At minimum support:

ASPNETCORE_ENVIRONMENT=Production

ConnectionStrings__DefaultConnection

Jwt__Key

Jwt__Issuer

Jwt__Audience

Also identify any additional production configuration required by the real repository, such as:

* allowed origins
* file storage path
* upload base URL
* SignalR options
* external API keys
* email configuration

Do not invent variables that are not needed.

Never put secret values into workflow YAML.

==================================================
20. GITHUB SECRETS
==================

Document the exact GitHub Secrets needed.

At minimum:

WEBSITE_NAME
SERVER_COMPUTER_NAME
SERVER_USERNAME
SERVER_PASSWORD

Also identify whether the deployment architecture requires additional secrets.

Do NOT create fake secret values.

Do NOT print real secret values in logs.

Use GitHub's secret references.

If production configuration needs secrets, use the appropriate secure configuration method rather than placing them in source control.

==================================================
21. MONSTERASP DASHBOARD CONFIGURATION
======================================

I will manually operate my MonsterASP dashboard.

Do not ask me for my MonsterASP password.

Determine from the actual current MonsterASP interface/documentation what I need to configure.

The final documentation must cover:

A. website creation
B. domain/subdomain
C. ASP.NET Core runtime
D. WebDeploy activation
E. WebDeploy credentials
F. MSSQL database creation
G. database credentials
H. connection string
I. remote SSMS access if necessary
J. environment/application configuration
K. ASPNETCORE_ENVIRONMENT
L. WebSockets setting if available
M. application restart
N. logs/errors
O. storage/upload directories

Do NOT fabricate dashboard labels.

If a label cannot be confirmed, say:

"Check current MonsterASP dashboard wording."

==================================================
22. DEPLOYMENT VERIFICATION / HEALTH CHECK
==========================================

After deployment, do not immediately declare success.

Create a verification step.

First wait for IIS/application startup.

Use a retry loop rather than checking only once.

For example:

* wait
* HTTP request
* retry if startup returns 500/502/503
* stop after a reasonable number of attempts

Check:

/

/swagger

and, if currently unauthenticated:

/api/categories

Do not execute destructive endpoints.

==================================================
23. FUNCTIONAL PRODUCTION TEST
==============================

After the first successful deployment, test as much as safely possible.

Verify:

1. landing page loads

2. React static assets load

3. React Router direct navigation works

4. Swagger loads

5. GET /api/categories works

6. customer registration

7. worker registration

8. login

9. refresh-token behavior

10. logout

11. authenticated API requests

12. customer dashboard

13. worker dashboard

14. worker profile

15. service request creation

16. quotation workflow where implemented

17. booking workflow where implemented

18. OTP/check-in workflow where implemented

19. SignalR/chat where implemented

20. file upload where implemented

21. review/rating where implemented

22. HTTPS authentication cookies

23. no localhost production API calls

24. no localhost SignalR calls

25. no mixed HTTP/HTTPS problems

Do not perform destructive cleanup operations on production.

Use only safe test data/actions.

==================================================
24. SECURITY AUDIT BEFORE DEPLOYMENT
====================================

Before pushing/deploying, search the repository for:

localhost
127.0.0.1
.\SQLEXPRESS
KarigorDev
password
Jwt:Key
ConnectionStrings
API keys
hard-coded secrets

Distinguish legitimate development configuration from accidental production configuration.

Make sure production secrets are not committed.

Check .gitignore.

Ensure it excludes at minimum where appropriate:

.env
.env.*
node_modules/
bin/
obj/
local secrets
local database files
uploaded user content

Do not delete legitimate development configuration just because it contains localhost.

==================================================
25. DOCUMENTATION
=================

Create/update:

docs/MONSTERASP_DEPLOYMENT.md

It must contain a complete operational guide covering:

1. Architecture
2. Prerequisites
3. MonsterASP website setup
4. .NET runtime requirements
5. WebDeploy setup
6. MSSQL setup
7. Database schema deployment
8. seed deployment
9. production environment variables
10. GitHub Secrets
11. CD workflow
12. deployment procedure
13. post-deployment verification
14. SignalR/WebSockets
15. upload persistence
16. logs
17. common HTTP 500/502/503 problems
18. rollback/redeployment
19. local development versus production configuration
20. security notes

Never put real credentials in documentation.

==================================================
26. DO NOT USE DESTRUCTIVE AUTOMATION
=====================================

This is extremely important.

NEVER add automatic production startup behavior that:

* drops database
* recreates database
* deletes uploads
* resets application data
* seeds by deleting/recreating existing data
* runs EnsureDeleted()
* blindly runs destructive migrations

Database provisioning remains a controlled/manual task unless the existing project already has a safe, non-destructive migration mechanism and there is a compelling reason to use it.

==================================================
27. MAKE THE DEPLOYMENT REPEATABLE
==================================

The finished solution must support:

git push origin main

â†’ CI validation

â†’ CD

â†’ MonsterASP deployment

without manually copying frontend files.

The deployment must be repeatable.

A second deployment should not destroy:

* uploaded files
* database records
* authentication data
* user-generated content

==================================================
28. WHAT YOU MAY MODIFY
=======================

You may modify/create only files necessary for:

* production configuration
* frontend production configuration
* IIS/web.config
* static-file handling
* upload persistence
* SignalR production support
* database production scripts
* GitHub Actions CD
* deployment documentation
* deployment-related .gitignore changes

Do not make unrelated application refactors.

==================================================
29. VALIDATION BEFORE PUSH
==========================

Before committing:

Run the project's real commands.

At minimum:

dotnet restore

dotnet build --configuration Release

dotnet test --configuration Release

frontend:

npm ci

npm run build

Run the correct commands according to the actual repository.

If tests don't exist, do not fabricate them.

Verify the production publish output.

Verify web.config.

Verify frontend assets are inside the deployable application.

Verify SPA routing configuration.

Verify production configuration does not contain local database settings.

==================================================
30. COMMIT AND PUSH
===================

After all repository changes have been locally validated:

Create a clean deployment-focused commit.

Do not include unrelated modifications.

Push the deployment changes to:

main

Only push after the repository is in a coherent buildable state.

==================================================
31. DEPLOY TO MONSTERASP
========================

After the repository is pushed:

Monitor the GitHub Actions CD workflow.

If the workflow fails:

diagnose the actual failure.

Do NOT randomly rewrite application code.

Classify the failure as one of:

A. build failure
B. test failure
C. frontend build failure
D. publish failure
E. WebDeploy credential failure
F. WebDeploy server/website mismatch
G. MonsterASP runtime mismatch
H. IIS configuration failure
I. database connection failure
J. application startup failure
K. SignalR/WebSocket issue
L. static-file issue
M. upload-path issue

Fix the appropriate layer.

Retry deployment.

==================================================
32. IF MONSTERASP RUNTIME DOES NOT SUPPORT .NET 10
==================================================

This specific situation must be handled intelligently.

If MonsterASP supports the exact runtime:

continue normally.

If it does NOT:

First test whether self-contained win-x64 deployment is viable.

If viable:

use it.

If it is not viable because of MonsterASP resource/runtime limitations:

evaluate the safest supported .NET version for this application.

Do NOT automatically downgrade.

If a downgrade is necessary:

* determine all package compatibility issues
* determine whether code changes are required
* make the smallest possible targeted changes
* rebuild/test
* document exactly why

Do not sacrifice application functionality simply to force deployment.

==================================================
33. AFTER SUCCESSFUL DEPLOYMENT
===============================

Produce a final deployment report containing:

A. Repository state
B. deployed commit SHA
C. .NET version
D. deployment mode:
framework-dependent or self-contained
E. MonsterASP website
F. production URL
G. API URL
H. Swagger URL
I. database status
J. authentication status
K. refresh-token status
L. SignalR status
M. WebSocket status
N. Long Polling fallback status
O. SPA routing status
P. file upload status
Q. upload persistence/deployment-safety status
R. GitHub Actions status
S. health-check status
T. functional-test status
U. remaining warnings/issues

Clearly separate:

PASS
WARNING
BLOCKED

Do not claim something passed unless it was actually verified.

==================================================
34. IMPORTANT â€” WORK AUTONOMOUSLY
=================================

Do not stop after merely giving me recommendations.

Do not stop after creating the YAML.

Do not stop after creating documentation.

Do not stop after modifying local code.

Actually perform the full implementation, validation, commit, push, deployment, and verification process as far as your available tools and access allow.

For things requiring my manual interaction with the MonsterASP/GitHub UI, do not request passwords or credentials from me.

Instead:

1. identify the exact manual action
2. clearly explain what value I need to obtain
3. explain where that value goes
4. continue with every other task you can perform
5. resume deployment after the required manual configuration is available

Do not ask unnecessary questions.

Make reasonable assumptions based on the actual repository and document them.

==================================================
35. FINAL ARCHITECTURAL CONSTRAINTS
===================================

The finished production architecture should preferably be:

```
                MonsterASP
                   â”‚
          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”
          â”‚                 â”‚
    ASP.NET Core        MSSQL
          â”‚
   â”Œâ”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”
   â”‚      â”‚      â”‚
 React   API   SignalR
   â”‚
wwwroot
```

The frontend must preferably be same-origin with the API.

The production system must use HTTPS.

The production system must not depend on localhost.

The production system must not depend on .\SQLEXPRESS.

The production system must not contain development secrets.

The database must remain SQL Server.

The project must remain Database-First.

The existing application functionality must remain intact.

==================================================
36. FINAL DELIVERABLES
======================

At the end, I expect all of the following:

1. Production-ready KARIGOR code/configuration.

2. Production-safe database scripts where necessary.

3. IIS/web.config configuration for React SPA routing.

4. Persistent upload strategy that survives WebDeploy.

5. SignalR production configuration with reconnect/fallback considerations.

6. GitHub Actions CD workflow:

.github/workflows/deploy-monsterasp.yml

7. Existing CI preserved unless a concrete compatibility fix is required.

8. MonsterASP deployment documentation:

docs/MONSTERASP_DEPLOYMENT.md

9. Required GitHub Secrets list.

10. Required MonsterASP configuration list.

11. Production environment variable list.

12. Successful Release build.

13. Successful tests where tests exist.

14. Successful frontend production build.

15. Successful publish.

16. Successful MonsterASP deployment, to the extent credentials/configuration permit.

17. Production health-check results.

18. Functional verification results.

19. Clear list of anything that remains manual or blocked.

MOST IMPORTANT:

Do not merely tell me how to do this.

Actually implement the deployment solution in the repository, validate it, push it, deploy it, and verify it.

Do not claim deployment success without evidence from the actual deployment/health checks.
