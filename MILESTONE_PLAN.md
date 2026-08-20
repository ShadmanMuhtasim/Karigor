# KARIGOR — Development Plan & Milestone Roadmap
**Stack:** ASP.NET Core Web API (C#) · React + Vite (TypeScript) · MS SQL Server (Database-First) · Entity Framework Core

---

## 0. Final Configuration (confirmed with the team)

| Area | Decision | Why |
|------|----------|------|
| **Database approach** | **Database-First** — schema is designed and owned directly in SQL Server (T-SQL scripts / SSMS), then EF Core models are **scaffolded from the database**, not the other way around | You confirmed this explicitly — the DB is the single source of truth, C# entities are generated artifacts, not hand-authored |
| DB engine & hosting | **MS SQL Server**, hosted on **Azure SQL Database** (free/student tier) | Confirmed MS SQL; Azure SQL is the simplest managed host that's actually MS SQL Server (Render doesn't offer it) — swap for a self-hosted SQL Server Express VPS if you'd rather |
| Maps | **Leaflet + OpenStreetMap** (free, no billing account needed) | Confirmed — matches your report's "mostly free technologies" cost claim |
| Styling | **Tailwind CSS + shadcn/ui** | You asked for what's best suited: Bootstrap/react-bootstrap is built for server-rendered apps and tends to look generic; Tailwind + shadcn/ui is the standard modern React/Vite pairing, gives you full control over a distinctive UI, and better supports the "portfolio-worthy, real-world engineering" goal from your slides. **One consequence:** your existing NFR doc says "responsive design using Bootstrap" — update that line to Tailwind CSS for consistency with your actual report. |
| Auth | ASP.NET Core Identity (user store) + **JWT bearer tokens** (access + refresh) | Identity's cookie/session model doesn't fit a decoupled SPA cleanly; JWT does |
| Real-time chat | SignalR | Matches your original slide 12 stack |
| Image hosting | Cloudinary | Matches your original slide 12 stack |
| Payments | **Excluded from V1.0** — bookings marked "Paid" manually/admin-confirmed | Your own cost breakdown lists payment gateway under *Future Costs*, and your Future Scope slide lists "Online Payments" separately |

**Team:** Shadman Muhtasim, Md. Saiman Ullah, Ahbab Hasan, Mustakim Musa — work split is in Section 12.

---

## 1. What Database-First Actually Changes For You

Since you're Database-First, it pays to draft the *entire* schema now rather than growing it piecemeal — later milestones should mostly just consume tables that already exist. Draw the ERD (draw.io or dbdiagram.io) before writing SQL.

**Core tables to script in `001_initial_schema.sql`:**
- `AspNetUsers`, `AspNetRoles`, `AspNetUserRoles`, `AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserTokens`, `AspNetRoleClaims` — the standard Identity schema (grab the exact column definitions from Microsoft's documented Identity schema, or generate them once in a disposable Code-First scratch project via `dotnet ef migrations script` and copy the resulting SQL into your own script — either way, you write/own the final `.sql`)
- `CustomerProfiles` (UserId FK → AspNetUsers.Id, FullName, Address, ProfileImageUrl)
- `WorkerProfiles` (UserId FK, Bio, HourlyRate, Latitude, Longitude, ServiceRadiusKm, VerificationStatus, AverageRating)
- `WorkerDocuments` (WorkerId FK, DocumentType, FileUrl, Status)
- `ServiceCategories` (Id, Name, IconUrl)
- `WorkerSkills` (WorkerId FK, CategoryId FK) — many-to-many junction table
- `WorkerAvailability` (WorkerId FK, DayOfWeek, StartTime, EndTime)
- `ServiceRequests` (CustomerId FK, CategoryId FK, Description, Address, Latitude, Longitude, PreferredDate, Status, PhotoUrls)
- `Quotations` (ServiceRequestId FK, WorkerId FK, ProposedPrice, Message, Status, ParentQuotationId nullable FK to itself — for counter-offer threads)
- `Bookings` (ServiceRequestId FK, WorkerId FK, CustomerId FK, AgreedPrice, ScheduledDate, Status)
- `Reviews` (BookingId FK, Rating, Comment, WorkerResponse)
- `Messages` (SenderId FK, ReceiverId FK, BookingId FK nullable, Content, SentAt, IsRead)
- `Notifications` (UserId FK, Type, Message, IsRead, RelatedEntityId)

Use proper `FOREIGN KEY` constraints and sensible indexes (at minimum: `WorkerProfiles.VerificationStatus`, `ServiceRequests.Status`, `ServiceRequests.CategoryId`, and a composite/spatial index once you add lat/long in Milestone 6) — since EF Core is just reading this schema, all your data-integrity rules need to live in the SQL itself, not in C# attributes.

**One manual bridge you'll need:** ASP.NET Core Identity's `UserManager`/`SignInManager` expect your `DbContext` to inherit from `IdentityDbContext<ApplicationUser>`, but the scaffolder generates a plain `DbContext`. After each scaffold, open the generated context and change:
```csharp
public partial class KarigorDbContext : DbContext
```
to:
```csharp
public partial class KarigorDbContext : IdentityDbContext<ApplicationUser>
```

This is the one recurring manual step in an otherwise fully DB-first workflow — document it so whoever runs the scaffold command remembers it.

---

## 2. Milestone Timeline (13-week plan, adjust to your semester calendar)

| # | Milestone | Weeks | Focus |
|---|-----------|-------|-------|
| 1 | Foundation: Architecture, Repo & Database Schema | 1–2 | Setup |
| 2 | Authentication & Authorization | 3 | Auth |
| 3 | Worker Module | 4–5 | Worker-side profile |
| 4 | Customer Module & Worker Discovery | 5–6 | Customer-side search |
| 5 | Quotation, Negotiation & Booking Workflow | 6–8 | Core transaction flow |
| 6 | Location-Based Matching (Maps) | 8–9 | Geo features |
| 7 | Messaging & Notifications | 9–10 | Real-time layer |
| 8 | Reviews & Ratings + Admin Module | 10–11 | Trust loop + oversight |
| 9 | Security, Testing & Hardening | 11–12 | Non-functional reqs |
| 10 | Deployment & Demo Prep | 12–13 | Ship it |

Milestones 3–4 and 6–8 have some overlap by design — different team members can work them in parallel once Milestone 2 (auth) is done, since they all depend on auth but not much on each other.

---

## 3. Milestone 1 — Foundation: Architecture, Repo & Database Schema
**Goal:** A complete, hand-authored SQL Server schema, scaffolded into a running (empty) full-stack skeleton.

### Database Schema — design and script this FIRST, in full, before any C# code
Because you're Database-First, it pays to draft the *entire* schema now rather than growing it piecemeal — later milestones should mostly just consume tables that already exist. Draw the ERD (draw.io or dbdiagram.io) before writing SQL.

**Core tables to script in `001_initial_schema.sql`:**
- `AspNetUsers`, `AspNetRoles`, `AspNetUserRoles`, `AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserTokens`, `AspNetRoleClaims` — the standard Identity schema (grab the exact column definitions from Microsoft's documented Identity schema, or generate them once in a disposable Code-First scratch project via `dotnet ef migrations script` and copy the resulting SQL into your own script — either way, you write/own the final `.sql`)
- `CustomerProfiles` (UserId FK → AspNetUsers.Id, FullName, Address, ProfileImageUrl)
- `WorkerProfiles` (UserId FK, Bio, HourlyRate, Latitude, Longitude, ServiceRadiusKm, VerificationStatus, AverageRating)
- `WorkerDocuments` (WorkerId FK, DocumentType, FileUrl, Status)
- `ServiceCategories` (Id, Name, IconUrl)
- `WorkerSkills` (WorkerId FK, CategoryId FK) — many-to-many junction table
- `WorkerAvailability` (WorkerId FK, DayOfWeek, StartTime, EndTime)
- `ServiceRequests` (CustomerId FK, CategoryId FK, Description, Address, Latitude, Longitude, PreferredDate, Status, PhotoUrls)
- `Quotations` (ServiceRequestId FK, WorkerId FK, ProposedPrice, Message, Status, ParentQuotationId nullable FK to itself — for counter-offer threads)
- `Bookings` (ServiceRequestId FK, WorkerId FK, CustomerId FK, AgreedPrice, ScheduledDate, Status)
- `Reviews` (BookingId FK, Rating, Comment, WorkerResponse)
- `Messages` (SenderId FK, ReceiverId FK, BookingId FK nullable, Content, SentAt, IsRead)
- `Notifications` (UserId FK, Type, Message, IsRead, RelatedEntityId)

Use proper `FOREIGN KEY` constraints and sensible indexes (at minimum: `WorkerProfiles.VerificationStatus`, `ServiceRequests.Status`, `ServiceRequests.CategoryId`, and a composite/spatial index once you add lat/long in Milestone 6) — since EF Core is just reading this schema, all your data-integrity rules need to live in the SQL itself, not in C# attributes.

**Backend**
- Create solution: `Karigor.Api` (Web API project), `Karigor.Domain` (holds the scaffolded entities), `Karigor.Infrastructure` (the scaffolded `KarigorDbContext`, repositories), `Karigor.Application` (services/DTOs) — a clean 4-project layout keeps business logic out of controllers.
- Install: `Microsoft.EntityFrameworkCore.SqlServer`, `Microsoft.EntityFrameworkCore.Design` (needed for the scaffold command), `Microsoft.AspNetCore.Identity.EntityFrameworkCore`, `Microsoft.AspNetCore.Authentication.JwtBearer`, `Swashbuckle.AspNetCore` (Swagger).
- Apply `001_initial_schema.sql` and `002_seed_categories.sql` to your local SQL Server instance, then run the scaffold command from Section 1.
- Make the `IdentityDbContext` inheritance edit described in Section 1.
- Configure `appsettings.Development.json` with your local connection string; **never commit real secrets** — use `dotnet user-secrets` locally, and Azure App Service's configuration blade in production.
- Set up global exception-handling middleware (consistent JSON error shape) and Serilog for logging from day one.
- Enable CORS explicitly for `http://localhost:5173` (Vite's default dev port).

### Frontend
- Scaffold with `npm create vite@latest karigor-client -- --template react-ts`.
- Set up folder structure: `src/pages`, `src/components`, `src/api` (axios instance + typed API calls), `src/hooks`, `src/context` or a state library (Zustand is lighter than Redux for a project this size).
- Install `react-router-dom`, `axios`, `@tanstack/react-query` (strongly recommend — it handles server-state caching/loading/error states for you, saving a huge amount of boilerplate across every module below), Tailwind CSS, and `shadcn/ui`.
- Run `npx shadcn@latest init` and pull in the base components you'll reuse constantly: Button, Input, Card, Dialog, Badge, Avatar, Table.
- Set up a base layout (navbar, protected-route wrapper placeholder, 404 page).
- Point axios's base URL at your local API.

### Definition of Done
- `001_initial_schema.sql` is applied to a real SQL Server instance and every table exists with correct FKs.
- The scaffold command runs cleanly and produces a full `Models/` folder + `KarigorDbContext` (with the Identity inheritance fix applied).
- `dotnet run` starts the API, Swagger UI loads at `/swagger`, and a test endpoint returns seeded category data from SQL Server.
- `npm run dev` starts the React app, Tailwind classes render correctly, and it successfully calls that test endpoint.
- All four team members have reviewed the final ERD before moving on.

---

## 4. Milestone 2 — Authentication & Authorization
**Goal:** Customers and Workers can register, log in, and land on a role-specific (empty) dashboard.

### Backend
- Configure ASP.NET Core Identity against the scaffolded `AspNetUsers`/`AspNetRoles` tables, with a `Role` claim (`Customer`, `Worker`, `Admin`).
- Build `POST /api/auth/register/customer` and `POST /api/auth/register/worker` (separate endpoints since workers need extra fields — skills, initial category — captured at signup, writing into `WorkerProfiles`/`WorkerSkills`).
- Build `POST /api/auth/login` returning a short-lived JWT access token + a longer-lived refresh token (store refresh tokens hashed in a `RefreshTokens` table — add this to your schema script if you didn't include it in Milestone 1, then re-scaffold).
- Build `POST /api/auth/refresh` and `POST /api/auth/logout` (revokes refresh token).
- Add `[Authorize(Roles = 