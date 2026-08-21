-- =============================================================================
-- 002_seed_categories.sql
-- Karigor — Seed starter ServiceCategories
-- Idempotent: uses MERGE so re-running does not create duplicates.
-- Run against: KarigorDev
-- Instance:    localhost\SQLEXPRESS  (Windows Authentication)
-- =============================================================================

USE [KarigorDev];
GO

MERGE INTO [ServiceCategories] AS target
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

PRINT 'ServiceCategories seeded.';
GO
