\# Karigor — Team Development Plan


| Milestone | Components |

|-----------|------------|

| \*\*Milestone 1\*\* | Database schema (20 tables), EF Core scaffolding, API foundation, Swagger, CORS, Serilog, Categories API | 

| \*\*Milestone 2\*\* | JWT Authentication, Role-based Authorization, Registration/Login, Refresh Token rotation, Frontend Auth Context, Protected Routes | 

| \*\*Milestone 3 (Partial)\*\* | Worker Backend (10 endpoints: profile, skills, availability, documents, dashboard), Worker Frontend (Overview, Profile, Skills, Availability, Documents tabs) | 



\---



\# 📋 Detailed Milestone Plan


\---



\## MILESTONE 4 — Customer Module \& Service Requests



\### Backend Tasks



| # | Task | Description |

|---|------|-------------|

| 4.1 | `CustomerController` | Create controller with `\[Authorize(Roles="Customer")]` |

| 4.2 | `GET /api/customer/profile` | Fetch customer profile |

| 4.3 | `PUT /api/customer/profile` | Update customer profile (FullName, Address, ProfileImageUrl) |

| 4.4 | `POST /api/customer/requests` | Create a service request |

| 4.5 | `GET /api/customer/requests` | List customer's requests with filtering |

| 4.6 | `GET /api/customer/requests/{id}` | Get single request with details |

| 4.7 | `GET /api/customer/workers/search` | Search workers by category/location/rating |

| 4.8 | `GET /api/customer/workers/{id}` | View worker profile (public view) |



\### Frontend Tasks



| # | Task | Description |

|---|------|-------------|

| 4.9 | Customer Dashboard | Overview page with stats |

| 4.10 | Customer Profile Tab | Edit profile form |

| 4.11 | Create Request Page | Form with category, description, address, preferred date, photo upload |

| 4.12 | My Requests List | View all requests with status |

| 4.13 | Request Detail Page | View single request with quotations |

| 4.14 | Search Workers Page | Search with filters, display results |

| 4.15 | Worker Profile Page | Public view with skills, reviews, availability |



\### Database Requirements (already exist)

\- `CustomerProfiles` ✅

\- `ServiceRequests` ✅

\- `ServiceCategories` ✅

\- `WorkerProfiles` ✅

\- `WorkerSkills` ✅

\- `WorkerAvailability` ✅



\### Definition of Done

\- \[ ] Customer can register → login → view dashboard

\- \[ ] Customer can update profile

\- \[ ] Customer can create service request with photo upload

\- \[ ] Customer can view own requests

\- \[ ] Customer can search workers by category

\- \[ ] Customer can view worker profile



\---



\## MILESTONE 5 — Quotation, Negotiation \& Booking



\### Backend Tasks



| # | Task | Description |

|---|------|-------------|

| 5.1 | `QuotationController` | Create controller |

| 5.2 | `POST /api/quotations` | Worker submits quotation for a request |

| 5.3 | `GET /api/quotations/request/{requestId}` | List all quotations for a request |

| 5.4 | `POST /api/quotations/{id}/accept` | Customer accepts a quotation |

| 5.5 | `POST /api/quotations/{id}/counter` | Customer submits counter-offer |

| 5.6 | `BookingController` | Create booking controller |

| 5.7 | `POST /api/bookings` | Create booking from accepted quotation |

| 5.8 | `GET /api/bookings/customer` | Customer booking history |

| 5.9 | `GET /api/bookings/worker` | Worker booking history |

| 5.10 | `PUT /api/bookings/{id}/status` | Update booking status (Scheduled → InProgress → Completed) |

| 5.11 | `GET /api/bookings/{id}` | Get booking details |



\### Frontend Tasks



| # | Task | Description |

|---|------|-------------|

| 5.12 | Request Detail with Quotations | View quotations, accept/reject/counter |

| 5.13 | Worker Quotation Form | Submit quotation with price and message |

| 5.14 | Customer Bookings Tab | View all bookings with status |

| 5.15 | Worker Bookings Tab | View all bookings with status |

| 5.16 | Booking Detail Page | Full booking details with status updates |

| 5.17 | Customer Accept/Confirm UI | Accept quotation → confirm booking |



\### Database Requirements (already exist)

\- `Quotations` ✅

\- `Bookings` ✅



\### Definition of Done

\- \[ ] Worker can submit quotation for a request

\- \[ ] Customer can view quotations

\- \[ ] Customer can accept quotation → booking created

\- \[ ] Customer can counter-offer

\- \[ ] Worker can view own bookings

\- \[ ] Customer can view own bookings

\- \[ ] Worker can update booking status



\---



\## MILESTONE 6 — Location-Based Matching (Maps)



\### Backend Tasks



| # | Task | Description |

|---|------|-------------|

| 6.1 | `GET /api/workers/nearby` | Find workers within radius (lat/lng + ServiceRadiusKm) |

| 6.2 | `PUT /api/worker/location` | Worker updates lat/lng |

| 6.3 | `GET /api/requests/nearby` | Find nearby requests for worker |



\### Frontend Tasks



| # | Task | Description |

|---|------|-------------|

| 6.4 | Leaflet/OpenStreetMap Integration | Add map component |

| 6.5 | Customer Search Map | Show nearby workers on map |

| 6.6 | Worker View Nearby Requests | Show requests on map |

| 6.7 | Location Permission | Browser geolocation API |



\### Database Requirements (already exist)

\- `WorkerProfiles` (Latitude, Longitude, ServiceRadiusKm) ✅

\- `ServiceRequests` (Latitude, Longitude) ✅



\### Definition of Done

\- \[ ] Customer sees nearby workers on map

\- \[ ] Worker sees nearby requests on map

\- \[ ] Worker can update location

\- \[ ] Search filters by distance



\---



\## MILESTONE 7 — Messaging \& Notifications



\### Backend Tasks



| # | Task | Description |

|---|------|-------------|

| 7.1 | SignalR Hub Setup | Configure real-time messaging |

| 7.2 | `MessageController` | Create message controller |

| 7.3 | `POST /api/messages` | Send message (persist to DB) |

| 7.4 | `GET /api/messages/booking/{bookingId}` | Get chat history |

| 7.5 | `GET /api/messages/conversations` | List user's conversations |

| 7.6 | Notification Service | In-app notifications |

| 7.7 | `GET /api/notifications` | List user notifications |

| 7.8 | `PUT /api/notifications/{id}/read` | Mark notification read |



\### Frontend Tasks



| # | Task | Description |

|---|------|-------------|

| 7.9 | SignalR Client Setup | Connect to hub |

| 7.10 | Chat UI Component | Message list + input |

| 7.11 | Chat List | Show conversations per booking |

| 7.12 | Notification Bell | Unread count + dropdown |

| 7.13 | Real-time Updates | New message appears instantly |



\### Database Requirements (already exist)

\- `Messages` ✅

\- `Notifications` ✅



\### Definition of Done

\- \[ ] Customer and Worker can chat

\- \[ ] Messages persist and load history

\- \[ ] Real-time delivery via SignalR

\- \[ ] Notifications for bookings, messages, quotes

\- \[ ] Notification bell with unread count



\---



\## MILESTONE 8 — Reviews \& Ratings



\### Backend Tasks



| # | Task | Description |

|---|------|-------------|

| 8.1 | `ReviewController` | Create review controller |

| 8.2 | `POST /api/reviews` | Customer submits review (only if booking completed) |

| 8.3 | `GET /api/reviews/worker/{workerId}` | Get all reviews for a worker |

| 8.4 | `GET /api/reviews/booking/{bookingId}` | Get review for a booking |

| 8.5 | `PUT /api/reviews/{id}/response` | Worker responds to review |

| 8.6 | Update WorkerProfile.AverageRating | Recalculate after new review |

| 8.7 | `GET /api/customer/bookings/completed` | List completed bookings (eligible for review) |



\### Frontend Tasks



| # | Task | Description |

|---|------|-------------|

| 8.8 | Review Form | Rating stars + comment |

| 8.9 | Worker Reviews Tab | Display reviews on worker profile |

| 8.10 | Customer Review Reminder | Show after booking completion |

| 8.11 | Worker Response Form | Respond to review |

| 8.12 | Average Rating Display | Show on worker cards/profiles |



\### Database Requirements (already exist)

\- `Reviews` ✅

\- `WorkerProfiles.AverageRating` ✅



\### Definition of Done

\- \[ ] Customer can rate completed booking

\- \[ ] Worker can respond to reviews

\- \[ ] Average rating updates automatically

\- \[ ] Reviews display on worker profile

\- \[ ] Only completed bookings can be reviewed



\---



\## MILESTONE 9 — Admin Module



\### Backend Tasks



| # | Task | Description |

|---|------|-------------|

| 9.1 | `AdminController` | Create with `\[Authorize(Roles="Admin")]` |

| 9.2 | `GET /api/admin/workers/pending` | List workers pending verification |

| 9.3 | `PUT /api/admin/workers/{id}/verify` | Approve/reject worker verification |

| 9.4 | `GET /api/admin/users` | List all users |

| 9.5 | `PUT /api/admin/users/{id}/suspend` | Suspend user account |

| 9.6 | `GET /api/admin/bookings` | Monitor all bookings |

| 9.7 | `GET /api/admin/reviews/reported` | List reported reviews |

| 9.8 | `PUT /api/admin/reviews/{id}/moderate` | Moderate a review |

| 9.9 | `GET /api/admin/stats` | Platform analytics (users, bookings, revenue) |

| 9.10 | `GET /api/admin/service-categories` | List categories |

| 9.11 | `POST /api/admin/service-categories` | Create category |

| 9.12 | `PUT /api/admin/service-categories/{id}` | Update category |

| 9.13 | `DELETE /api/admin/service-categories/{id}` | Delete category |



\### Frontend Tasks



| # | Task | Description |

|---|------|-------------|

| 9.14 | Admin Login | Separate admin login (or role-based) |

| 9.15 | Admin Dashboard | Stats overview |

| 9.16 | Worker Verification Queue | List pending, approve/reject |

| 9.17 | User Management | View, suspend users |

| 9.18 | Booking Monitoring | View all bookings |

| 9.19 | Review Moderation | Flagged reviews |

| 9.20 | Category Management | CRUD for service categories |

| 9.21 | Admin Navigation | Sidebar with sections |



\### Database Requirements (already exist)

\- `WorkerProfiles.VerificationStatus` ✅

\- `WorkerDocuments` ✅

\- `ServiceCategories` ✅



\### Definition of Done

\- \[ ] Admin can view pending worker verifications

\- \[ ] Admin can approve/reject verification

\- \[ ] Admin can manage service categories

\- \[ ] Admin can view platform stats

\- \[ ] Admin can suspend users

\- \[ ] Admin can moderate reviews



\---



\## MILESTONE 10 — Testing, Hardening \& Deployment


\### Tasks



| # | Task | Description |

|---|------|-------------|

| 10.1 | Integration Testing | Test all API endpoints |

| 10.2 | Security Audit | JWT, refresh tokens, authorization |

| 10.3 | IDOR Testing | Ensure user isolation |

| 10.4 | Error Handling | Consistent error responses |

| 10.5 | Performance Testing | Load testing basics |

| 10.6 | Database Optimization | Indexes, query optimization |

| 10.7 | Frontend Build | Production build, minification |

| 10.8 | Environment Variables | Configure for production |

| 10.9 | Azure SQL Setup | Deploy database to Azure |

| 10.10 | Deployment | Deploy to Render/Azure App Service |

| 10.11 | Documentation | API docs, user guide |

| 10.12 | Final Presentation Prep | Slides, demo |


## Milestone 10 — Testing, Hardening & Deployment

### Part 1 — Backend & API Testing
- All endpoint integration tests
- Validation and error handling
- Swagger documentation review

### Part 2 — Security & Performance
- Security audit (JWT, IDOR, authorization)
- Database indexing and query optimization
- Load testing basics

### Part 3 — Deployment Preparation
- Azure SQL Database setup
- CI/CD pipeline (GitHub Actions + Azure/Render)
- Environment configuration
- Health check endpoint

### Part 4 — Documentation & Final Delivery
- API documentation (Swagger)
- User guides (Customer, Worker, Admin)
- Final presentation and demo
- Deployment guide


\### Definition of Done

\- \[ ] All endpoints tested and working

\- \[ ] Security vulnerabilities addressed

\- \[ ] Production build successful

\- \[ ] Deployed to cloud

\- \[ ] Documentation complete



\---



\# 📊 Project Timeline Summary



| Week | Milestone | Lead |

|------|-----------|------|

| \*\*Week 1-2\*\* | Milestone 1-2 — Authentication and Databse setup | Shadman |

| \*\*Week 3\*\* | Milestone 3 — Authentication and Worker Module | Shadman |

| \*\*Week 4\*\* | Milestone 4 — Customer Module | Mustakim |

| \*\*Week 5\*\* | Milestone 4 + 5 (start) |  Ahbab |

| \*\*Week 6\*\* | Milestone 5 — Quotation \& Booking | Ahbab |

| \*\*Week 7\*\* | Milestone 6 — Location Matching | Saiman |

| \*\*Week 8\*\* | Milestone 7 — Messaging \& Notifications | Saiman |

| \*\*Week 9\*\* | Milestone 8 — Reviews | Mustakim |

| \*\*Week 10\*\* | Milestone 9 — Admin Module | Ahbab |

| \*\*Week 11\*\* | Milestone 10 — Testing \& Deployment | All |

| \*\*Week 12\*\* | Buffer \& Finalization | All |



\---



\# 🔧 Setup Instructions for Team Members



Since you just cloned the repo, each team member should:



```bash

\# Navigate to project

cd Karigor



\# Restore backend dependencies

cd backend

dotnet restore



\# Build solution

cd ..

dotnet build Karigor.slnx



\# Set up user secrets (each dev)

cd backend/Karigor.Api

dotnet user-secrets init

dotnet user-secrets set "Jwt:Key" "your-secret-key-here"

dotnet user-secrets set "Jwt:Issuer" "https://localhost:7000"

dotnet user-secrets set "Jwt:Audience" "https://localhost:5173"



\# Update appsettings.Development.json with local SQL Server

\# ConnectionString: "Server=.\\SQLEXPRESS;Database=KarigorDev;Trusted\_Connection=True;TrustServerCertificate=True;"



\# Run backend

dotnet run --project backend/Karigor.Api



\# Frontend setup (new terminal)

cd karigor-client

npm install

npm run dev

```



\---



\## 🔍 Files to Check for Better Understanding



| File | Purpose |

|------|---------|

| `OVERALL\_PLAN.md` | basic plan for whole project |

| `WORK\_DONE.md` | Detailed work log |

| `001\_initial\_schema.sql` | Full database schema |

| `backend/Karigor.Api/Controllers/` | API controllers |

| `backend/Karigor.Application/Worker/` | Worker service layer |

| `karigor-client/src/pages/worker/` | Worker frontend pages |

| `karigor-client/src/context/AuthContext.tsx` | Auth state management |



\---



\## ⚠️ Things That May Need Attention



| Issue | Recommendation |

|-------|----------------|

| \*\*`Karigor.Domain` contains `Class1.cs`\*\* | Remove placeholder file |

| \*\*`Karigor.Shared` contains `Class1.cs`\*\* | Remove placeholder file |

| \*\*Identity DbContext inheritance\*\* | The scaffolded `KarigorDbContext` needs to extend `IdentityDbContext<ApplicationUser>` — verify this is still correct |

| \*\*Connection string\*\* | Each dev needs their own `appsettings.Development.json` with local DB path |

| \*\*JWT Secret\*\* | Each dev must set their own `Jwt:Key` via user secrets |

| \*\*Frontend API URL\*\* | Check `vite.config.ts` proxy or `client.ts` base URL |



\---
