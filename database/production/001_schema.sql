-- =============================================================================
-- database/production/001_schema.sql
-- Karigor — Production Database Schema (ASP.NET Core Identity + Domain)
--
-- Production Safe:
-- 1. NO "CREATE DATABASE" or "USE [KarigorDev]".
--    Runs directly within the target database context assigned by MonsterASP.
-- 2. Fully Idempotent: all CREATE TABLE statements are guarded with IF OBJECT_ID checks.
-- 3. Schema includes all domain tables up to the latest features:
--    - Full ASP.NET Core Identity 8.x/10.x schema + RefreshTokens
--    - ServiceCategories, CustomerProfiles, WorkerProfiles, WorkerDocuments,
--      WorkerSkills, WorkerAvailability
--    - ServiceRequests, Quotations, Bookings (with OTP & Check-In verification fields)
--    - Reviews, Messages, Notifications, and SosAlerts (emergency response)
--    - All foreign keys, constraints, and performance indexes
-- =============================================================================

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- -----------------------------------------------------------------------------
-- 1. ASP.NET Core Identity Tables
-- -----------------------------------------------------------------------------

IF OBJECT_ID(N'[dbo].[AspNetRoles]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetRoles] (
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
    CREATE TABLE [dbo].[AspNetUsers] (
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
    CREATE TABLE [dbo].[AspNetUserClaims] (
        [Id]         int           NOT NULL IDENTITY,
        [UserId]     nvarchar(450) NOT NULL,
        [ClaimType]  nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created AspNetUserClaims';
END
GO

IF OBJECT_ID(N'[dbo].[AspNetUserLogins]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetUserLogins] (
        [LoginProvider]       nvarchar(450) NOT NULL,
        [ProviderKey]         nvarchar(450) NOT NULL,
        [ProviderDisplayName] nvarchar(max) NULL,
        [UserId]              nvarchar(450) NOT NULL,
        CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
        CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created AspNetUserLogins';
END
GO

IF OBJECT_ID(N'[dbo].[AspNetUserTokens]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetUserTokens] (
        [UserId]        nvarchar(450) NOT NULL,
        [LoginProvider] nvarchar(450) NOT NULL,
        [Name]          nvarchar(450) NOT NULL,
        [Value]         nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
        CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created AspNetUserTokens';
END
GO

IF OBJECT_ID(N'[dbo].[RefreshTokens]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RefreshTokens] (
        [Id]              int           NOT NULL IDENTITY,
        [TokenHash]       nvarchar(max) NOT NULL,
        [UserId]          nvarchar(450) NOT NULL,
        [ExpiresAt]       datetime2     NOT NULL,
        [RevokedAt]       datetime2     NULL,
        [ReplacedByToken] nvarchar(max) NULL,
        [CreatedAt]       datetime2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_RefreshTokens] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RefreshTokens_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created RefreshTokens';
END
GO

IF OBJECT_ID(N'[dbo].[AspNetUserRoles]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetUserRoles] (
        [UserId] nvarchar(450) NOT NULL,
        [RoleId] nvarchar(450) NOT NULL,
        CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
        CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId]
            FOREIGN KEY ([RoleId]) REFERENCES [dbo].[AspNetRoles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created AspNetUserRoles';
END
GO

IF OBJECT_ID(N'[dbo].[AspNetRoleClaims]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AspNetRoleClaims] (
        [Id]         int           NOT NULL IDENTITY,
        [RoleId]     nvarchar(450) NOT NULL,
        [ClaimType]  nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId]
            FOREIGN KEY ([RoleId]) REFERENCES [dbo].[AspNetRoles] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created AspNetRoleClaims';
END
GO

-- -----------------------------------------------------------------------------
-- 2. Domain Tables
-- -----------------------------------------------------------------------------

IF OBJECT_ID(N'[dbo].[ServiceCategories]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ServiceCategories] (
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
    CREATE TABLE [dbo].[CustomerProfiles] (
        [Id]              int           NOT NULL IDENTITY,
        [UserId]          nvarchar(450) NOT NULL,
        [FullName]        nvarchar(100) NOT NULL,
        [Address]         nvarchar(200) NULL,
        [ProfileImageUrl] nvarchar(max) NULL,
        CONSTRAINT [PK_CustomerProfiles] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_CustomerProfiles_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [UQ_CustomerProfiles_UserId] UNIQUE ([UserId])
    );
    PRINT 'Created CustomerProfiles';
END
GO

IF OBJECT_ID(N'[dbo].[WorkerProfiles]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[WorkerProfiles] (
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
            FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [UQ_WorkerProfiles_UserId] UNIQUE ([UserId])
    );
    PRINT 'Created WorkerProfiles';
END
GO

IF OBJECT_ID(N'[dbo].[WorkerDocuments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[WorkerDocuments] (
        [Id]           int           NOT NULL IDENTITY,
        [WorkerId]     int           NOT NULL,
        [DocumentType] nvarchar(50)  NOT NULL,
        [FileUrl]      nvarchar(max) NOT NULL,
        [Status]       nvarchar(50)  NOT NULL DEFAULT 'Pending',
        CONSTRAINT [PK_WorkerDocuments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_WorkerDocuments_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [dbo].[WorkerProfiles] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created WorkerDocuments';
END
GO

IF OBJECT_ID(N'[dbo].[WorkerSkills]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[WorkerSkills] (
        [WorkerId]   int NOT NULL,
        [CategoryId] int NOT NULL,
        CONSTRAINT [PK_WorkerSkills] PRIMARY KEY ([WorkerId], [CategoryId]),
        CONSTRAINT [FK_WorkerSkills_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [dbo].[WorkerProfiles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_WorkerSkills_ServiceCategories_CategoryId]
            FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[ServiceCategories] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created WorkerSkills';
END
GO

IF OBJECT_ID(N'[dbo].[WorkerAvailability]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[WorkerAvailability] (
        [Id]        int  NOT NULL IDENTITY,
        [WorkerId]  int  NOT NULL,
        [DayOfWeek] int  NOT NULL,  -- 0=Sunday … 6=Saturday
        [StartTime] time NOT NULL,
        [EndTime]   time NOT NULL,
        CONSTRAINT [PK_WorkerAvailability] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_WorkerAvailability_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [dbo].[WorkerProfiles] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created WorkerAvailability';
END
GO

IF OBJECT_ID(N'[dbo].[ServiceRequests]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ServiceRequests] (
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
            FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[CustomerProfiles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ServiceRequests_ServiceCategories_CategoryId]
            FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[ServiceCategories] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Created ServiceRequests';
END
GO

IF OBJECT_ID(N'[dbo].[Quotations]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Quotations] (
        [Id]                int           NOT NULL IDENTITY,
        [ServiceRequestId]  int           NOT NULL,
        [WorkerId]          int           NOT NULL,
        [ProposedPrice]     decimal(18,2) NOT NULL,
        [Message]           nvarchar(max) NULL,
        [Status]            nvarchar(50)  NOT NULL DEFAULT 'Pending',
        [ParentQuotationId] int           NULL,
        CONSTRAINT [PK_Quotations] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Quotations_ServiceRequests_ServiceRequestId]
            FOREIGN KEY ([ServiceRequestId]) REFERENCES [dbo].[ServiceRequests] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_Quotations_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [dbo].[WorkerProfiles] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Quotations_Quotations_ParentQuotationId]
            FOREIGN KEY ([ParentQuotationId]) REFERENCES [dbo].[Quotations] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Created Quotations';
END
GO

IF OBJECT_ID(N'[dbo].[Bookings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Bookings] (
        [Id]                        int           NOT NULL IDENTITY,
        [ServiceRequestId]          int           NOT NULL,
        [WorkerId]                  int           NOT NULL,
        [CustomerId]                int           NOT NULL,
        [AgreedPrice]               decimal(18,2) NOT NULL,
        [ScheduledDate]             datetime2     NOT NULL,
        [Status]                    nvarchar(50)  NOT NULL DEFAULT 'Scheduled',
        [VerificationCodeHash]      nvarchar(256) NULL,
        [VerificationCodeExpiresAt] datetime2     NULL,
        [VerificationAttempts]      int           NOT NULL DEFAULT 0,
        [CheckedInAt]               datetime2     NULL,
        CONSTRAINT [PK_Bookings] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Bookings_ServiceRequests_ServiceRequestId]
            FOREIGN KEY ([ServiceRequestId]) REFERENCES [dbo].[ServiceRequests] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_Bookings_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [dbo].[WorkerProfiles] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Bookings_CustomerProfiles_CustomerId]
            FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[CustomerProfiles] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Created Bookings';
END
ELSE
BEGIN
    -- Ensure columns exist if table was already created by an earlier schema version
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'VerificationCodeHash' AND Object_ID = Object_ID(N'dbo.Bookings'))
        ALTER TABLE [dbo].[Bookings] ADD [VerificationCodeHash] nvarchar(256) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'VerificationCodeExpiresAt' AND Object_ID = Object_ID(N'dbo.Bookings'))
        ALTER TABLE [dbo].[Bookings] ADD [VerificationCodeExpiresAt] datetime2 NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'VerificationAttempts' AND Object_ID = Object_ID(N'dbo.Bookings'))
        ALTER TABLE [dbo].[Bookings] ADD [VerificationAttempts] int NOT NULL DEFAULT 0;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'CheckedInAt' AND Object_ID = Object_ID(N'dbo.Bookings'))
        ALTER TABLE [dbo].[Bookings] ADD [CheckedInAt] datetime2 NULL;
END
GO

IF OBJECT_ID(N'[dbo].[Reviews]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Reviews] (
        [Id]             int           NOT NULL IDENTITY,
        [BookingId]      int           NOT NULL,
        [Rating]         int           NOT NULL,
        [Comment]        nvarchar(max) NULL,
        [WorkerResponse] nvarchar(max) NULL,
        CONSTRAINT [PK_Reviews] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Reviews_Bookings_BookingId]
            FOREIGN KEY ([BookingId]) REFERENCES [dbo].[Bookings] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [CHK_Reviews_Rating] CHECK ([Rating] BETWEEN 1 AND 5),
        CONSTRAINT [UQ_Reviews_BookingId] UNIQUE ([BookingId])
    );
    PRINT 'Created Reviews';
END
GO

IF OBJECT_ID(N'[dbo].[Messages]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Messages] (
        [Id]         int           NOT NULL IDENTITY,
        [SenderId]   nvarchar(450) NOT NULL,
        [ReceiverId] nvarchar(450) NOT NULL,
        [BookingId]  int           NULL,
        [Content]    nvarchar(max) NOT NULL,
        [SentAt]     datetime2     NOT NULL DEFAULT SYSUTCDATETIME(),
        [IsRead]     bit           NOT NULL DEFAULT 0,
        CONSTRAINT [PK_Messages] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Messages_AspNetUsers_SenderId]
            FOREIGN KEY ([SenderId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Messages_AspNetUsers_ReceiverId]
            FOREIGN KEY ([ReceiverId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Messages_Bookings_BookingId]
            FOREIGN KEY ([BookingId]) REFERENCES [dbo].[Bookings] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Created Messages';
END
GO

IF OBJECT_ID(N'[dbo].[Notifications]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Notifications] (
        [Id]              int           NOT NULL IDENTITY,
        [UserId]          nvarchar(450) NOT NULL,
        [Type]            nvarchar(50)  NOT NULL,
        [Message]         nvarchar(max) NOT NULL,
        [IsRead]          bit           NOT NULL DEFAULT 0,
        [RelatedEntityId] int           NULL,
        [CreatedAt]       datetime2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_Notifications] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Notifications_AspNetUsers_UserId]
            FOREIGN KEY ([UserId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created Notifications';
END
GO

IF OBJECT_ID(N'[dbo].[SosAlerts]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SosAlerts] (
        [Id]                int           NOT NULL IDENTITY,
        [BookingId]         int           NOT NULL,
        [CustomerId]        int           NOT NULL,
        [WorkerId]          int           NOT NULL,
        [TriggeredAt]       datetime2     NOT NULL DEFAULT SYSUTCDATETIME(),
        [Status]            nvarchar(50)  NOT NULL DEFAULT 'Open',
        [AdminNotes]        nvarchar(max) NULL,
        [ResolvedAt]        datetime2     NULL,
        [ResolvedByAdminId] nvarchar(450) NULL,
        CONSTRAINT [PK_SosAlerts] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_SosAlerts_Bookings_BookingId]
            FOREIGN KEY ([BookingId]) REFERENCES [dbo].[Bookings] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_SosAlerts_CustomerProfiles_CustomerId]
            FOREIGN KEY ([CustomerId]) REFERENCES [dbo].[CustomerProfiles] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_SosAlerts_WorkerProfiles_WorkerId]
            FOREIGN KEY ([WorkerId]) REFERENCES [dbo].[WorkerProfiles] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_SosAlerts_AspNetUsers_ResolvedByAdminId]
            FOREIGN KEY ([ResolvedByAdminId]) REFERENCES [dbo].[AspNetUsers] ([Id]) ON DELETE SET NULL
    );
    PRINT 'Created SosAlerts';
END
GO

-- -----------------------------------------------------------------------------
-- 3. Indexes
-- -----------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WorkerProfiles_VerificationStatus'
               AND object_id = OBJECT_ID(N'[dbo].[WorkerProfiles]'))
BEGIN
    CREATE INDEX [IX_WorkerProfiles_VerificationStatus]
        ON [dbo].[WorkerProfiles] ([VerificationStatus]);
    PRINT 'Created IX_WorkerProfiles_VerificationStatus';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ServiceRequests_Status'
               AND object_id = OBJECT_ID(N'[dbo].[ServiceRequests]'))
BEGIN
    CREATE INDEX [IX_ServiceRequests_Status]
        ON [dbo].[ServiceRequests] ([Status]);
    PRINT 'Created IX_ServiceRequests_Status';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ServiceRequests_CategoryId'
               AND object_id = OBJECT_ID(N'[dbo].[ServiceRequests]'))
BEGIN
    CREATE INDEX [IX_ServiceRequests_CategoryId]
        ON [dbo].[ServiceRequests] ([CategoryId]);
    PRINT 'Created IX_ServiceRequests_CategoryId';
END
GO

-- Identity secondary indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUsers_NormalizedEmail'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetUsers]'))
    CREATE INDEX [IX_AspNetUsers_NormalizedEmail] ON [dbo].[AspNetUsers] ([NormalizedEmail]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUsers_NormalizedUserName'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetUsers]'))
    CREATE UNIQUE INDEX [IX_AspNetUsers_NormalizedUserName]
        ON [dbo].[AspNetUsers] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetRoles_NormalizedName'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetRoles]'))
    CREATE INDEX [IX_AspNetRoles_NormalizedName] ON [dbo].[AspNetRoles] ([NormalizedName]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUserClaims_UserId'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetUserClaims]'))
    CREATE INDEX [IX_AspNetUserClaims_UserId] ON [dbo].[AspNetUserClaims] ([UserId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetRoleClaims_RoleId'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetRoleClaims]'))
    CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [dbo].[AspNetRoleClaims] ([RoleId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUserRoles_RoleId'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetUserRoles]'))
    CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [dbo].[AspNetUserRoles] ([RoleId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspNetUserLogins_UserId'
               AND object_id = OBJECT_ID(N'[dbo].[AspNetUserLogins]'))
    CREATE INDEX [IX_AspNetUserLogins_UserId] ON [dbo].[AspNetUserLogins] ([UserId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RefreshTokens_UserId'
               AND object_id = OBJECT_ID(N'[dbo].[RefreshTokens]'))
    CREATE INDEX [IX_RefreshTokens_UserId] ON [dbo].[RefreshTokens] ([UserId]);
GO

-- SosAlerts indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SosAlerts_BookingId'
               AND object_id = OBJECT_ID(N'[dbo].[SosAlerts]'))
    CREATE INDEX [IX_SosAlerts_BookingId] ON [dbo].[SosAlerts] ([BookingId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SosAlerts_CustomerId'
               AND object_id = OBJECT_ID(N'[dbo].[SosAlerts]'))
    CREATE INDEX [IX_SosAlerts_CustomerId] ON [dbo].[SosAlerts] ([CustomerId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SosAlerts_WorkerId'
               AND object_id = OBJECT_ID(N'[dbo].[SosAlerts]'))
    CREATE INDEX [IX_SosAlerts_WorkerId] ON [dbo].[SosAlerts] ([WorkerId]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SosAlerts_ResolvedByAdminId'
               AND object_id = OBJECT_ID(N'[dbo].[SosAlerts]'))
    CREATE INDEX [IX_SosAlerts_ResolvedByAdminId] ON [dbo].[SosAlerts] ([ResolvedByAdminId]);
GO

PRINT '=============================================';
PRINT '001_schema.sql executed successfully.';
PRINT '=============================================';
GO
