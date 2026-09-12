-- =============================================================================
-- 004_add_payments.sql
-- Karigor — SSLCommerz Payments & Booking Payment Status Migration
-- Re-runnable: idempotent column and table checks.
-- =============================================================================

USE [KarigorDev];
GO

-- 1. Add PaymentStatus column to Bookings table if not present
IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'PaymentStatus' AND Object_ID = Object_ID(N'dbo.Bookings'))
BEGIN
    ALTER TABLE [dbo].[Bookings]
    ADD [PaymentStatus] nvarchar(50) NOT NULL DEFAULT 'Unpaid';
    
    PRINT 'Added PaymentStatus column to Bookings';
END
GO

-- 2. Create Payments table if not exists
IF OBJECT_ID(N'[dbo].[Payments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Payments] (
        [Id]              int            NOT NULL IDENTITY,
        [BookingId]       int            NOT NULL,
        [TransactionId]   nvarchar(100)  NOT NULL,
        [ValId]           nvarchar(100)  NULL,
        [BankTranId]      nvarchar(100)  NULL,
        [CardType]        nvarchar(100)  NULL,
        [Currency]        nvarchar(10)   NOT NULL DEFAULT 'BDT',
        [TotalAmount]     decimal(18, 2) NOT NULL,
        [PlatformFee]     decimal(18, 2) NOT NULL, -- 1% platform facilitation fee
        [WorkerAmount]    decimal(18, 2) NOT NULL, -- 99% worker payout
        [Status]          nvarchar(50)   NOT NULL DEFAULT 'Initiated', -- Initiated, Completed, Failed, Cancelled
        [CreatedAt]       datetime2      NOT NULL DEFAULT SYSUTCDATETIME(),
        [PaidAt]          datetime2      NULL,
        [GatewayResponse] nvarchar(max)  NULL,
        CONSTRAINT [PK_Payments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Payments_Bookings_BookingId]
            FOREIGN KEY ([BookingId]) REFERENCES [dbo].[Bookings] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [UQ_Payments_TransactionId] UNIQUE ([TransactionId])
    );

    CREATE INDEX [IX_Payments_BookingId] ON [dbo].[Payments] ([BookingId]);
    CREATE INDEX [IX_Payments_Status] ON [dbo].[Payments] ([Status]);

    PRINT 'Created Payments table and indexes.';
END
GO
