-- =============================================================================
-- database/production/002_seed.sql
-- Karigor — Production Seed Data
--
-- Production Safe:
-- 1. NO "USE [KarigorDev]".
--    Runs directly within the target database context.
-- 2. Fully Idempotent:
--    - Uses MERGE / IF NOT EXISTS so re-running does not create duplicate rows.
--    - Seeds standard AspNetRoles ('Customer', 'Worker', 'Admin').
--    - Seeds standard ServiceCategories (10 core trade categories with CDN icons).
--
-- Note on Admin Account:
-- The default administrator account (admin@karigor.com) is provisioned automatically
-- by the ASP.NET Core application runtime on first startup using ASP.NET Core Identity
-- (RoleManager/UserManager) to ensure proper cryptographic password hashing.
-- =============================================================================

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- -----------------------------------------------------------------------------
-- 1. Seed Core Identity Roles (Idempotent)
-- -----------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetRoles] WHERE [NormalizedName] = N'CUSTOMER')
BEGIN
    INSERT INTO [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [ConcurrencyStamp])
    VALUES (N'role-customer-id', N'Customer', N'CUSTOMER', NEWID());
    PRINT 'Seeded role: Customer';
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetRoles] WHERE [NormalizedName] = N'WORKER')
BEGIN
    INSERT INTO [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [ConcurrencyStamp])
    VALUES (N'role-worker-id', N'Worker', N'WORKER', NEWID());
    PRINT 'Seeded role: Worker';
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[AspNetRoles] WHERE [NormalizedName] = N'ADMIN')
BEGIN
    INSERT INTO [dbo].[AspNetRoles] ([Id], [Name], [NormalizedName], [ConcurrencyStamp])
    VALUES (N'role-admin-id', N'Admin', N'ADMIN', NEWID());
    PRINT 'Seeded role: Admin';
END
GO

-- -----------------------------------------------------------------------------
-- 2. Seed Service Categories (Idempotent via MERGE)
-- -----------------------------------------------------------------------------

MERGE INTO [dbo].[ServiceCategories] AS target
USING (VALUES
    (N'Electrician',   N'https://cdn.karigor.app/icons/electrician.svg'),
    (N'Plumber',       N'https://cdn.karigor.app/icons/plumber.svg'),
    (N'Carpenter',     N'https://cdn.karigor.app/icons/carpenter.svg'),
    (N'Mechanic',      N'https://cdn.karigor.app/icons/mechanic.svg'),
    (N'AC Technician', N'https://cdn.karigor.app/icons/ac-technician.svg'),
    (N'Painter',       N'https://cdn.karigor.app/icons/painter.svg'),
    (N'Cleaner',       N'https://cdn.karigor.app/icons/cleaner.svg'),
    (N'Welder',        N'https://cdn.karigor.app/icons/welder.svg'),
    (N'Mason',         N'https://cdn.karigor.app/icons/mason.svg'),
    (N'Driver',        N'https://cdn.karigor.app/icons/driver.svg')
) AS source ([Name], [IconUrl])
ON target.[Name] = source.[Name]
WHEN NOT MATCHED THEN
    INSERT ([Name], [IconUrl]) VALUES (source.[Name], source.[IconUrl]);
GO

PRINT '=============================================';
PRINT '002_seed.sql executed successfully.';
PRINT '=============================================';
GO
