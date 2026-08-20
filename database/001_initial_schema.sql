CREATE TABLE [ServiceCategories] (
    [Id] int NOT NULL IDENTITY,
    [Name] nvarchar(100) NOT NULL,
    [IconUrl] nvarchar(max) NULL,
    CONSTRAINT [PK_ServiceCategories] PRIMARY KEY ([Id])
);
GO

CREATE TABLE [AspNetUsers] (
    [Id] nvarchar(450) NOT NULL,
    [UserName] nvarchar(256) NULL,
    [NormalizedUserName] nvarchar(256) NULL,
    [Email] nvarchar(256) NULL,
    [NormalizedEmail] nvarchar(256) NULL,
    [EmailConfirmed] bit NOT NULL,
    [PasswordHash] nvarchar(max) NULL,
    [SecurityStamp] nvarchar(max) NULL,
    [ConcurrencyStamp] nvarchar(max) NULL,
    [PhoneNumber] nvarchar(max) NULL,
    [PhoneNumberConfirmed] bit NOT NULL,
    [TwoFactorEnabled] bit NOT NULL,
    [LockoutEnd] datetimeoffset NULL,
    [LockoutEnabled] bit NOT NULL,
    [AccessFailedCount] int NOT NULL,
    CONSTRAINT [PK_AspNetUsers] PRIMARY KEY ([Id])
);
GO

CREATE TABLE [AspNetRoles] (
    [Id] nvarchar(450) NOT NULL,
    [Name] nvarchar(256) NULL,
    [NormalizedName] nvarchar(256) NULL,
    [ConcurrencyStamp] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
);
GO

CREATE TABLE [AspNetUserClaims] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [ClaimType] nvarchar(max) NULL,
    [ClaimValue] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [AspNetUserLogins] (
    [LoginProvider] nvarchar(450) NOT NULL,
    [ProviderKey] nvarchar(450) NOT NULL,
    [ProviderDisplayName] nvarchar(max) NULL,
    [UserId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
    CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [AspNetUserRoles] (
    [UserId] nvarchar(450) NOT NULL,
    [RoleId] nvarchar(450) NOT NULL,
    CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
    CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [AspNetUserTokens] (
    [UserId] nvarchar(450) NOT NULL,
    [LoginProvider] nvarchar(450) NOT NULL,
    [Name] nvarchar(450) NOT NULL,
    [Value] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
    CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [AspNetRoleClaims] (
    [Id] int NOT NULL IDENTITY,
    [RoleId] nvarchar(450) NOT NULL,
    [ClaimType] nvarchar(max) NULL,
    [ClaimValue] nvarchar(max) NULL,
    CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [CustomerProfiles] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [FullName] nvarchar(100) NOT NULL,
    [Address] nvarchar(200) NULL,
    [ProfileImageUrl] nvarchar(max) NULL,
    CONSTRAINT [PK_CustomerProfiles] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_CustomerProfiles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [WorkerProfiles] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [Bio] nvarchar(max) NULL,
    [HourlyRate] decimal(18,2) NOT NULL,
    [Latitude] float NULL,
    [Longitude] float NULL,
    [ServiceRadiusKm] float NOT NULL,
    [VerificationStatus] nvarchar(50) NOT NULL,
    [AverageRating] float NOT NULL,
    CONSTRAINT [PK_WorkerProfiles] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_WorkerProfiles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [WorkerDocuments] (
    [Id] int NOT NULL IDENTITY,
    [WorkerId] int NOT NULL,
    [DocumentType] nvarchar(50) NOT NULL,
    [FileUrl] nvarchar(max) NOT NULL,
    [Status] nvarchar(50) NOT NULL,
    CONSTRAINT [PK_WorkerDocuments] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_WorkerDocuments_WorkerProfiles_WorkerId] FOREIGN KEY ([WorkerId]) REFERENCES [WorkerProfiles] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [WorkerSkills] (
    [WorkerId] int NOT NULL,
    [CategoryId] int NOT NULL,
    CONSTRAINT [PK_WorkerSkills] PRIMARY KEY ([WorkerId], [CategoryId]),
    CONSTRAINT [FK_WorkerSkills_WorkerProfiles_WorkerId] FOREIGN KEY ([WorkerId]) REFERENCES [WorkerProfiles] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_WorkerSkills_ServiceCategories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [ServiceCategories] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [WorkerAvailability] (
    [Id] int NOT NULL IDENTITY,
    [WorkerId] int NOT NULL,
    [DayOfWeek] int NOT NULL,
    [StartTime] time NOT NULL,
    [EndTime] time NOT NULL,
    CONSTRAINT [PK_WorkerAvailability] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_WorkerAvailability_WorkerProfiles_WorkerId] FOREIGN KEY ([WorkerId]) REFERENCES [WorkerProfiles] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [ServiceRequests] (
    [Id] int NOT NULL IDENTITY,
    [CustomerId] int NOT NULL,
    [CategoryId] int NOT NULL,
    [Description] nvarchar(max) NOT NULL,
    [Address] nvarchar(200) NOT NULL,
    [Latitude] float NULL,
    [Longitude] float NULL,
    [PreferredDate] datetime NOT NULL,
    [Status] nvarchar(50) NOT NULL,
    [PhotoUrls] nvarchar(max) NULL,
    CONSTRAINT [PK_ServiceRequests] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_ServiceRequests_CustomerProfiles_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [CustomerProfiles] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ServiceRequests_ServiceCategories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [ServiceCategories] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [Quotations] (
    [Id] int NOT NULL IDENTITY,
    [ServiceRequestId] int NOT NULL,
    [WorkerId] int NOT NULL,
    [ProposedPrice] decimal(18,2) NOT NULL,
    [Message] nvarchar(max) NULL,
    [Status] nvarchar(50) NOT NULL,
    [ParentQuotationId] int NULL,
    CONSTRAINT [PK_Quotations] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Quotations_ServiceRequests_ServiceRequestId] FOREIGN KEY ([ServiceRequestId]) REFERENCES [ServiceRequests] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Quotations_WorkerProfiles_WorkerId] FOREIGN KEY ([WorkerId]) REFERENCES [WorkerProfiles] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Quotations_Quotations_ParentQuotationId] FOREIGN KEY ([ParentQuotationId]) REFERENCES [Quotations] ([Id]) ON DELETE NO ACTION
);
GO

CREATE TABLE [Bookings] (
    [Id] int NOT NULL IDENTITY,
    [ServiceRequestId] int NOT NULL,
    [WorkerId] int NOT NULL,
    [CustomerId] int NOT NULL,
    [AgreedPrice] decimal(18,2) NOT NULL,
    [ScheduledDate] datetime NOT NULL,
    [Status] nvarchar(50) NOT NULL,
    CONSTRAINT [PK_Bookings] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Bookings_ServiceRequests_ServiceRequestId] FOREIGN KEY ([ServiceRequestId]) REFERENCES [ServiceRequests] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Bookings_WorkerProfiles_WorkerId] FOREIGN KEY ([WorkerId]) REFERENCES [WorkerProfiles] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Bookings_CustomerProfiles_CustomerId] FOREIGN KEY ([CustomerId]) REFERENCES [CustomerProfiles] ([Id]) ON DELETE NO ACTION
);
GO

CREATE TABLE [Reviews] (
    [Id] int NOT NULL IDENTITY,
    [BookingId] int NOT NULL,
    [Rating] int NOT NULL,
    [Comment] nvarchar(max) NULL,
    [WorkerResponse] nvarchar(max) NULL,
    CONSTRAINT [PK_Reviews] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Reviews_Bookings_BookingId] FOREIGN KEY ([BookingId]) REFERENCES [Bookings] ([Id]) ON DELETE CASCADE
);
GO

CREATE TABLE [Messages] (
    [Id] int NOT NULL IDENTITY,
    [SenderId] nvarchar(450) NOT NULL,
    [ReceiverId] nvarchar(450) NOT NULL,
    [BookingId] int NULL,
    [Content] nvarchar(max) NOT NULL,
    [SentAt] datetime NOT NULL,
    [IsRead] bit NOT NULL,
    CONSTRAINT [PK_Messages] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Messages_AspNetUsers_SenderId] FOREIGN KEY ([SenderId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Messages_AspNetUsers_ReceiverId] FOREIGN KEY ([ReceiverId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_Messages_Bookings_BookingId] FOREIGN KEY ([BookingId]) REFERENCES [Bookings] ([Id]) ON DELETE NO ACTION
);
GO

CREATE TABLE [Notifications] (
    [Id] int NOT NULL IDENTITY,
    [UserId] nvarchar(450) NOT NULL,
    [Type] nvarchar(50) NOT NULL,
    [Message] nvarchar(max) NOT NULL,
    [IsRead] bit NOT NULL,
    [RelatedEntityId] int NOT NULL,
    CONSTRAINT [PK_Notifications] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Notifications_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
);
GO

CREATE INDEX [IX_WorkerProfiles_VerificationStatus] ON [WorkerProfiles] ([VerificationStatus]);
CREATE INDEX [IX_ServiceRequests_Status] ON [ServiceRequests] ([Status]);
CREATE INDEX [IX_ServiceRequests_CategoryId] ON [ServiceRequests] ([CategoryId]);
GO
