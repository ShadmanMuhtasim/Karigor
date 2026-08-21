# Karigor — Entity Relationship Diagram

## Mermaid Diagram

```mermaid
erDiagram
    %% Identity tables
    AspNetUsers ||--o{ AspNetUserClaims   : "has claims"
    AspNetUsers ||--o{ AspNetUserLogins   : "has logins"
    AspNetUsers ||--o{ AspNetUserTokens   : "has tokens"
    AspNetUsers ||--o{ AspNetUserRoles    : "assigned to"
    AspNetRoles ||--o{ AspNetUserRoles    : "has members"
    AspNetRoles ||--o{ AspNetRoleClaims   : "has claims"

    %% Domain tables anchored to users
    AspNetUsers ||--o| CustomerProfiles   : "has profile"
    AspNetUsers ||--o| WorkerProfiles     : "has profile"
    AspNetUsers ||--o{ Notifications      : "receives"
    AspNetUsers ||--o{ Messages           : "sends"
    AspNetUsers ||--o{ Messages           : "receives"

    %% Worker sub-entities
    WorkerProfiles ||--o{ WorkerDocuments    : "submits"
    WorkerProfiles ||--o{ WorkerSkills       : "has skills"
    WorkerProfiles ||--o{ WorkerAvailability : "sets availability"
    ServiceCategories ||--o{ WorkerSkills    : "categorises"

    %% Service request flow
    CustomerProfiles  ||--o{ ServiceRequests : "creates"
    ServiceCategories ||--o{ ServiceRequests : "classifies"

    %% Quotation / booking / review
    ServiceRequests ||--o{ Quotations  : "receives"
    WorkerProfiles  ||--o{ Quotations  : "submits"
    Quotations      ||--o{ Quotations  : "counter-offers (self-ref)"
    ServiceRequests ||--o| Bookings    : "converts to"
    WorkerProfiles  ||--o{ Bookings    : "fulfils"
    CustomerProfiles||--o{ Bookings    : "placed by"
    Bookings        ||--o| Reviews     : "gets"
    Bookings        ||--o{ Messages    : "thread for"

    %% --- Column definitions ---

    AspNetUsers {
        nvarchar(450)        Id                  PK
        nvarchar(256)        UserName
        nvarchar(256)        NormalizedUserName
        nvarchar(256)        Email
        nvarchar(256)        NormalizedEmail
        bit                  EmailConfirmed
        nvarchar(max)        PasswordHash
        nvarchar(max)        SecurityStamp
        nvarchar(max)        ConcurrencyStamp
        nvarchar(max)        PhoneNumber
        bit                  PhoneNumberConfirmed
        bit                  TwoFactorEnabled
        datetimeoffset       LockoutEnd
        bit                  LockoutEnabled
        int                  AccessFailedCount
    }

    AspNetRoles {
        nvarchar(450)  Id               PK
        nvarchar(256)  Name
        nvarchar(256)  NormalizedName
        nvarchar(max)  ConcurrencyStamp
    }

    AspNetUserRoles {
        nvarchar(450)  UserId  PK,FK
        nvarchar(450)  RoleId  PK,FK
    }

    AspNetUserClaims {
        int            Id          PK
        nvarchar(450)  UserId      FK
        nvarchar(max)  ClaimType
        nvarchar(max)  ClaimValue
    }

    AspNetRoleClaims {
        int            Id          PK
        nvarchar(450)  RoleId      FK
        nvarchar(max)  ClaimType
        nvarchar(max)  ClaimValue
    }

    AspNetUserLogins {
        nvarchar(450)  LoginProvider       PK
        nvarchar(450)  ProviderKey         PK
        nvarchar(max)  ProviderDisplayName
        nvarchar(450)  UserId              FK
    }

    AspNetUserTokens {
        nvarchar(450)  UserId        PK,FK
        nvarchar(450)  LoginProvider PK
        nvarchar(450)  Name          PK
        nvarchar(max)  Value
    }

    CustomerProfiles {
        int            Id              PK
        nvarchar(450)  UserId          FK
        nvarchar(100)  FullName
        nvarchar(200)  Address
        nvarchar(max)  ProfileImageUrl
    }

    WorkerProfiles {
        int            Id                 PK
        nvarchar(450)  UserId             FK
        nvarchar(max)  Bio
        decimal(18-2)  HourlyRate
        float          Latitude
        float          Longitude
        float          ServiceRadiusKm
        nvarchar(50)   VerificationStatus
        float          AverageRating
    }

    WorkerDocuments {
        int            Id           PK
        int            WorkerId     FK
        nvarchar(50)   DocumentType
        nvarchar(max)  FileUrl
        nvarchar(50)   Status
    }

    ServiceCategories {
        int            Id      PK
        nvarchar(100)  Name
        nvarchar(max)  IconUrl
    }

    WorkerSkills {
        int  WorkerId    PK,FK
        int  CategoryId  PK,FK
    }

    WorkerAvailability {
        int   Id        PK
        int   WorkerId  FK
        int   DayOfWeek
        time  StartTime
        time  EndTime
    }

    ServiceRequests {
        int            Id            PK
        int            CustomerId    FK
        int            CategoryId    FK
        nvarchar(max)  Description
        nvarchar(200)  Address
        float          Latitude
        float          Longitude
        datetime2      PreferredDate
        nvarchar(50)   Status
        nvarchar(max)  PhotoUrls
    }

    Quotations {
        int            Id               PK
        int            ServiceRequestId FK
        int            WorkerId         FK
        decimal(18-2)  ProposedPrice
        nvarchar(max)  Message
        nvarchar(50)   Status
        int            ParentQuotationId FK
    }

    Bookings {
        int            Id               PK
        int            ServiceRequestId FK
        int            WorkerId         FK
        int            CustomerId       FK
        decimal(18-2)  AgreedPrice
        datetime2      ScheduledDate
        nvarchar(50)   Status
    }

    Reviews {
        int            Id             PK
        int            BookingId      FK
        int            Rating
        nvarchar(max)  Comment
        nvarchar(max)  WorkerResponse
    }

    Messages {
        int            Id        PK
        nvarchar(450)  SenderId  FK
        nvarchar(450)  ReceiverId FK
        int            BookingId  FK
        nvarchar(max)  Content
        datetime2      SentAt
        bit            IsRead
    }

    Notifications {
        int            Id              PK
        nvarchar(450)  UserId          FK
        nvarchar(50)   Type
        nvarchar(max)  Message
        bit            IsRead
        int            RelatedEntityId
    }
```

---

## Relationship Descriptions

### Identity Layer (ASP.NET Core Identity — 7 tables)

These tables are owned by ASP.NET Core Identity and managed via `IdentityDbContext<ApplicationUser>`.
They are scripted manually in `001_initial_schema.sql` rather than generated by EF migrations.

| Table | Role |
|-------|------|
| `AspNetUsers` | Central user store — every app user (customer, worker, admin) has one row |
| `AspNetRoles` | Role definitions: `Customer`, `Worker`, `Admin` |
| `AspNetUserRoles` | Many-to-many join between users and roles |
| `AspNetUserClaims` | Per-user custom claims (e.g., profile completion flags) |
| `AspNetRoleClaims` | Per-role claims attached to all members of that role |
| `AspNetUserLogins` | External login providers (OAuth) — one login per user per provider |
| `AspNetUserTokens` | Stored tokens (e.g., password reset, 2FA codes) |

### Profile Layer

Each `AspNetUsers` row has **at most one** `CustomerProfiles` row and **at most one** `WorkerProfiles` row.
A user registered as a customer will have a `CustomerProfiles` row; as a worker, a `WorkerProfiles` row.
(An admin will have neither profile row by default.)

### Worker Sub-entities

- `WorkerDocuments`: verification documents uploaded by a worker (e.g., NID, trade certificate).
- `WorkerSkills`: junction table connecting `WorkerProfiles` to `ServiceCategories` — a worker may offer multiple service types.
- `WorkerAvailability`: weekly schedule entries (by `DayOfWeek` 0–6) indicating when a worker is available.

### Service Request & Transaction Flow

1. A **customer** creates a `ServiceRequests` row, selecting a `ServiceCategories` entry and providing location/description.
2. **Workers** respond with `Quotations`. A `Quotation` can counter-offer another via the self-referencing `ParentQuotationId` FK.
3. When a quotation is accepted, a `Bookings` row is created linking the service request, the worker, and the customer.
4. After service completion, a `Reviews` row (one per booking, `||--o|` cardinality) captures rating and comments.
5. `Messages` threads may be attached to a booking or be standalone direct messages between users.
6. `Notifications` are user-scoped and reference an optional related entity by ID.

### Required Indexes

| Index | Rationale |
|-------|-----------|
| `IX_WorkerProfiles_VerificationStatus` | Admin panel filtering of pending/verified/rejected workers |
| `IX_ServiceRequests_Status` | Customer/worker dashboards filtering open/assigned/completed requests |
| `IX_ServiceRequests_CategoryId` | Worker discovery filtered by service category |
