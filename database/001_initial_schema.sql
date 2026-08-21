-- =============================================================================
-- 001_initial_schema.sql
-- Karigor — Full database schema (Identity + Domain)
-- Re-runnable: all CREATE TABLE statements are guarded with IF OBJECT_ID checks.
-- Run against: master (script switches to KarigorDev itself)
-- Instance:    localhost\SQLEXPRESS  (Windows Authentication)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Create the database if it does not exist, then switch into it
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'KarigorDev')
BEGIN
    CREATE DATABASE [KarigorDev];
    PRINT 'Database KarigorDev created.';
END
GO

USE [KarigorDev];
GO

-- ---------------------------------------------------------------------------
-- 1. ASP.NET Core Identity tables
--    Column definitions match Identity 8.x / EF Core 8+ scaffolded output.
-- ---------------------------------------------------------------------------

IF OBJECT_ID(N'[dbo].[AspNetRoles]', N'U') IS NULL
BEGIN
    CREATE TABLE [AspNetRoles] (
        [Id]               nvarchar(450) NOT NULL,
        [Name]             nvarchar(256) NULL,
        [NormalizedName]   nvarchar(256) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
    );
    PRINT 'Created AspNetRoles';
END
GO

IF OBJECT_ID(N'[dbo].[AspNetUsers]', N'U') IS NULL
BEGIN
    CREATE TABLE [AspNetUsers] (
        [Id]                   nvarchar(450)   NOT NULL,
        [UserName]             nvarchar(256)   NULL,
        [NormalizedUserName]   nvarchar(256)   NULL,
        [Email]                nvarchar(256)   NULL,
        [NormalizedEmail]      nvarchar(256)   NULL,
        [EmailConfirmed]       bit             NOT NULL DEFAULT 0,
        [PasswordHash]         nvarchar(max)   NULL,
        [SecurityStamp]        nvarchar(max)   NULL,
        [ConcurrencyStamp]     nvarchar(max)   NULL,
        [PhoneNumber]          nvarchar(max)   NULL,
        [PhoneNumberConfirmed] bit             NOT NULL DEFAULT 0,
        [TwoFactorEnabled]     bit             NOT NULL DEFAULT 0,
        [LockoutEnd]           datetimeoffset  NULL,
        [LockoutEnabled]       bit             NOT NULL DEFAULT 1,
        [AccessFailedCount]    int             NOT NULL DEFAULT 0,
        CONSTRAINT [PK_AspNetUsers] PRIMARY KEY ([Id])
    );
    PRINT 'Created AspNetUsers';
END
GO

IF OBJECT_ID(N'[dbo].[AspNetUserClaims]', N'U') IS NULL
BEGIN
    CREATE TABLE [AspNetUserClaims] (
        [Id]         int           NOT NULL IDENTITY,
        [UserId]     nvarchar(450) NOT NULL,
        [ClaimType]  nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created AspNetUserClaims';
END
GO

IF OBJECT_ID(N'[dbo].[AspNetUserLogins]', N'U') IS NULL
BEGIN
    CREATE TABLE [AspNetUserLogins] (
        [LoginProvider]       nvarchar(450) NOT NULL,
        [ProviderKey]         nvarchar(450) NOT NULL,
        [ProviderDisplayName] nvarchar(max) NULL,
        [UserId]              nvarchar(450) NOT NULL,
        CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
        CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created AspNetUserLogins';
END
GO

IF OBJECT_ID(N'[dbo].[AspNetUserTokens]', N'U') IS NULL
BEGIN
    CREATE TABLE [AspNetUserTokens] (
        [UserId]        nvarchar(450) NOT NULL,
        [LoginProvider] nvarchar(450) NOT NULL,
        [Name]          nvarchar(450) NOT NULL,
        [Value]         nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
        CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created AspNetUserTokens';
END
GO

IF OBJECT_ID(N'[dbo].[RefreshTokens]', N'U') IS NULL
BEGIN
    CREATE TABLE [RefreshTokens] (
        [Id]              int           NOT NULL IDENTITY,
        [TokenHash]       nvarchar(max) NOT NULL,
        [UserId]          nvarchar(450) NOT NULL,
        [ExpiresAt]       datetime2     NOT NULL,
        [RevokedAt]       datetime2     NULL,
        [ReplacedByToken] nvarchar(max) NULL,
        [CreatedAt]       datetime2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_RefreshTokens] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RefreshTokens_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created RefreshTokens';
END
GO

IF OBJECT_ID(N'[dbo].[AspNetUserRoles]', N'U') IS NULL
BEGIN
    CREATE TABLE [AspNetUserRoles] (
        [UserId] nvarchar(450) NOT NULL,
        [RoleId] nvarchar(450) NOT NULL,
        CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
        CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId]
            FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created AspNetUserRoles';
END
GO

IF OBJECT_ID(N'[dbo].[AspNetRoleClaims]', N'U') IS NULL
BEGIN
    CREATE TABLE [AspNetRoleClaims] (
        [Id]         int           NOT NULL IDENTITY,
        [RoleId]     nvarchar(450) NOT NULL,
        [ClaimType]  nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId]
            FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created AspNetRoleClaims';
END
GO

-- ---------------------------------------------------------------------------
-- 2. Domain tables
-- ---------------------------------------------------------------------------

IF OBJECT_ID(N'[dbo].[ServiceCategories]', N'U') IS NULL
BEGIN
    CREATE TABLE [ServiceCategories] (
        [Id]      int           NOT NULL IDENTITY,
        [Name]    nvarchar(100) NOT NULL,
        [IconUrl] nvarchar(max) NULL,
        CONSTRAINT [PK_ServiceCategories] PRIMARY KEY ([Id])
    );
    PRINT 'Created ServiceCategories';
END
GO

IF OBJECT_ID(N'[dbo].[CustomerProfiles]', N'U') IS NULL
BEGIN
    CREATE TABLE [CustomerProfiles] (
        [Id]              int           NOT NULL IDENTITY,
        [UserId]          nvarchar(450) NOT NULL,
        [FullName]        nvarchar(100) NOT NULL,
        [Address]         nvarchar(200) NULL,
        [ProfileImageUrl] nvarchar(max) NULL,
        CONSTRAINT [PK_CustomerProfiles] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_CustomerProfiles_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [UQ_CustomerProfiles_UserId] UNIQUE ([UserId])
    );
    PRINT 'Created CustomerProfiles';
END
GO

IF OBJECT_ID(N'[dbo].[WorkerProfiles]', N'U') IS NULL
BEGIN
    CREATE TABLE [WorkerProfiles] (
        [Id]                 int           NOT NULL IDENTITY,
        [UserId]             nvarchar(450) NOT NULL,
        [Bio]                nvarchar(max) NULL,
        [HourlyRate]         decimal(18,2) NOT NULL DEFAULT 0,
        [Latitude]           float         NULL,
        [Longitude]          float         NULL,
        [ServiceRadiusKm]    float         NOT NULL DEFAULT 10,
        [VerificationStatus] nvarchar(50)  NOT NULL DEFAULT 'Pending',
        [AverageRating]      float         NOT NULL DEFAULT 0,
        CONSTRAINT [PK_WorkerProfiles] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_WorkerProfiles_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [UQ_WorkerProfiles_UserId] UNIQUE ([UserId])
    );
    PRINT 'Created WorkerProfiles';
END
GO

IF OBJECT_ID(N'[dbo].[WorkerDocuments]', N'U') IS NULL
BEGIN
    CREATE TABLE [WorkerDocuments] (
        [Id]           int           NOT NULL IDENTITY,
        [WorkerId]     int           NOT NULL,
        [DocumentType] nvarchar(50)  NOT NULL,
        [FileUrl]      nvarchar(max) NOT NULL,
        [Status]       nvarchar(50)  NOT NULL DEFAULT 'Pending',
        CONSTRAINT [PK_WorkerDocuments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_WorkerDocuments_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [WorkerProfiles] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created WorkerDocuments';
END
GO

IF OBJECT_ID(N'[dbo].[WorkerSkills]', N'U') IS NULL
BEGIN
    CREATE TABLE [WorkerSkills] (
        [WorkerId]   int NOT NULL,
        [CategoryId] int NOT NULL,
        CONSTRAINT [PK_WorkerSkills] PRIMARY KEY ([WorkerId], [CategoryId]),
        CONSTRAINT [FK_WorkerSkills_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [WorkerProfiles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_WorkerSkills_ServiceCategories_CategoryId]
            FOREIGN KEY ([CategoryId]) REFERENCES [ServiceCategories] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created WorkerSkills';
END
GO

IF OBJECT_ID(N'[dbo].[WorkerAvailability]', N'U') IS NULL
BEGIN
    CREATE TABLE [WorkerAvailability] (
        [Id]        int  NOT NULL IDENTITY,
        [WorkerId]  int  NOT NULL,
        [DayOfWeek] int  NOT NULL,  -- 0=Sunday … 6=Saturday
        [StartTime] time NOT NULL,
        [EndTime]   time NOT NULL,
        CONSTRAINT [PK_WorkerAvailability] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_WorkerAvailability_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [WorkerProfiles] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created WorkerAvailability';
END
GO

IF OBJECT_ID(N'[dbo].[ServiceRequests]', N'U') IS NULL
BEGIN
    CREATE TABLE [ServiceRequests] (
        [Id]            int           NOT NULL IDENTITY,
        [CustomerId]    int           NOT NULL,
        [CategoryId]    int           NOT NULL,
        [Description]   nvarchar(max) NOT NULL,
        [Address]       nvarchar(200) NOT NULL,
        [Latitude]      float         NULL,
        [Longitude]     float         NULL,
        [PreferredDate] datetime2     NOT NULL,
        [Status]        nvarchar(50)  NOT NULL DEFAULT 'Open',
        [PhotoUrls]     nvarchar(max) NULL,
        CONSTRAINT [PK_ServiceRequests] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ServiceRequests_CustomerProfiles_CustomerId]
            FOREIGN KEY ([CustomerId]) REFERENCES [CustomerProfiles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ServiceRequests_ServiceCategories_CategoryId]
            FOREIGN KEY ([CategoryId]) REFERENCES [ServiceCategories] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Created ServiceRequests';
END
GO

IF OBJECT_ID(N'[dbo].[Quotations]', N'U') IS NULL
BEGIN
    CREATE TABLE [Quotations] (
        [Id]               int           NOT NULL IDENTITY,
        [ServiceRequestId] int           NOT NULL,
        [WorkerId]         int           NOT NULL,
        [ProposedPrice]    decimal(18,2) NOT NULL,
        [Message]          nvarchar(max) NULL,
        [Status]           nvarchar(50)  NOT NULL DEFAULT 'Pending',
        [ParentQuotationId] int          NULL,
        CONSTRAINT [PK_Quotations] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Quotations_ServiceRequests_ServiceRequestId]
            FOREIGN KEY ([ServiceRequestId]) REFERENCES [ServiceRequests] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_Quotations_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [WorkerProfiles] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Quotations_Quotations_ParentQuotationId]
            FOREIGN KEY ([ParentQuotationId]) REFERENCES [Quotations] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Created Quotations';
END
GO

IF OBJECT_ID(N'[dbo].[Bookings]', N'U') IS NULL
BEGIN
    CREATE TABLE [Bookings] (
        [Id]               int           NOT NULL IDENTITY,
        [ServiceRequestId] int           NOT NULL,
        [WorkerId]         int           NOT NULL,
        [CustomerId]       int           NOT NULL,
        [AgreedPrice]      decimal(18,2) NOT NULL,
        [ScheduledDate]    datetime2     NOT NULL,
        [Status]           nvarchar(50)  NOT NULL DEFAULT 'Scheduled',
        CONSTRAINT [PK_Bookings] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Bookings_ServiceRequests_ServiceRequestId]
            FOREIGN KEY ([ServiceRequestId]) REFERENCES [ServiceRequests] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_Bookings_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [WorkerProfiles] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Bookings_CustomerProfiles_CustomerId]
            FOREIGN KEY ([CustomerId]) REFERENCES [CustomerProfiles] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Created Bookings';
END
GO

IF OBJECT_ID(N'[dbo].[Reviews]', N'U') IS NULL
BEGIN
    CREATE TABLE [Reviews] (
        [Id]             int           NOT NULL IDENTITY,
        [BookingId]      int           NOT NULL,
        [Rating]         int           NOT NULL,
        [Comment]        nvarchar(max) NULL,
        [WorkerResponse] nvarchar(max) NULL,
        CONSTRAINT [PK_Reviews] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Reviews_Bookings_BookingId]
            FOREIGN KEY ([BookingId]) REFERENCES [Bookings] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [CHK_Reviews_Rating] CHECK ([Rating] BETWEEN 1 AND 5),
        CONSTRAINT [UQ_Reviews_BookingId] UNIQUE ([BookingId])
    );
    PRINT 'Created Reviews';
END
GO

IF OBJECT_ID(N'[dbo].[Messages]', N'U') IS NULL
BEGIN
    CREATE TABLE [Messages] (
        [Id]         int           NOT NULL IDENTITY,
        [SenderId]   nvarchar(450) NOT NULL,
        [ReceiverId] nvarchar(450) NOT NULL,
        [BookingId]  int           NULL,
        [Content]    nvarchar(max) NOT NULL,
        [SentAt]     datetime2     NOT NULL DEFAULT SYSUTCDATETIME(),
        [IsRead]     bit           NOT NULL DEFAULT 0,
        CONSTRAINT [PK_Messages] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Messages_AspNetUsers_SenderId]
            FOREIGN KEY ([SenderId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Messages_AspNetUsers_ReceiverId]
            FOREIGN KEY ([ReceiverId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Messages_Bookings_BookingId]
            FOREIGN KEY ([BookingId]) REFERENCES [Bookings] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Created Messages';
END
GO

IF OBJECT_ID(N'[dbo].[Notifications]', N'U') IS NULL
BEGIN
    CREATE TABLE [Notifications] (
        [Id]              int           NOT NULL IDENTITY,
        [UserId]          nvarchar(450) NOT NULL,
        [Type]            nvarchar(50)  NOT NULL,
        [Message]         nvarchar(max) NOT NULL,
        [IsRead]          bit           NOT NULL DEFAULT 0,
        [RelatedEntityId] int           NULL,
        [CreatedAt]       datetime2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_Notifications] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Notifications_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created Notifications';
END
GO

-- ---------------------------------------------------------------------------
-- 3. Indexes (re-runnable guard)
-- ---------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WorkerProfiles_VerificationStatus'
               AND object_id = OBJECT_ID(N'[dbo].[WorkerProfiles]'))
BEGIN
    CREATE INDEX [IX_WorkerProfiles_VerificationStatus]
        ON [WorkerProfiles] ([VerificationStatus]);
    PRINT 'Created IX_WorkerProfiles_VerificationStatus';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ServiceRequests_Status'
               AND object_id = OBJECT_ID(N'[dbo].[ServiceRequests]'))
BEGIN
    CREATE INDEX [IX_ServiceRequests_Status]
        ON [ServiceRequests] ([Status]);
    PRINT 'Created IX_ServiceRequests_Status';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ServiceRequests_CategoryId'
               AND object_id = OBJECT_ID(N'[dbo].[ServiceRequests]'))
BEGIN
    CREATE INDEX [IX_ServiceRequests_CategoryId]
        ON [ServiceRequests] ([CategoryId]);
    PRINT 'Created IX_ServiceRequests_CategoryId';
END
GO

-- Useful secondary indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUsers_NormalizedEmail'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetUsers]'))
    CREATE INDEX [IX_AspNetUsers_NormalizedEmail]  ON [AspNetUsers] ([NormalizedEmail]);
GO

-- Filtered index requires QUOTED_IDENTIFIER ON
SET QUOTED_IDENTIFIER ON;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUsers_NormalizedUserName'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetUsers]'))
    CREATE UNIQUE INDEX [IX_AspNetUsers_NormalizedUserName]
        ON [AspNetUsers] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetRoles_NormalizedName'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetRoles]'))
    CREATE INDEX [IX_AspNetRoles_NormalizedName] ON [AspNetRoles] ([NormalizedName]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUserClaims_UserId'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetUserClaims]'))
    CREATE INDEX [IX_AspNetUserClaims_UserId] ON [AspNetUserClaims] ([UserId]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetRoleClaims_RoleId'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetRoleClaims]'))
    CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [AspNetRoleClaims] ([RoleId]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUserRoles_RoleId'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetUserRoles]'))
    CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [AspNetUserRoles] ([RoleId]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUserLogins_UserId'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetUserLogins]'))
    CREATE INDEX [IX_AspNetUserLogins_UserId] ON [AspNetUserLogins] ([UserId]);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RefreshTokens_UserId'
               AND object_id = OBJECT_ID(N'[dbo].[RefreshTokens]'))
    CREATE INDEX [IX_RefreshTokens_UserId] ON [RefreshTokens] ([UserId]);
GO
PRINT 'Created Identity secondary indexes';

PRINT 'Schema script complete.';
GO
