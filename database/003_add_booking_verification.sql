-- Add OTP and check-in fields to Bookings table
IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'VerificationCodeHash' AND Object_ID = Object_ID(N'dbo.Bookings'))
BEGIN
    ALTER TABLE [dbo].[Bookings]
    ADD 
        [VerificationCodeHash]      nvarchar(256) NULL,
        [VerificationCodeExpiresAt] datetime2     NULL,
        [VerificationAttempts]      int           NOT NULL DEFAULT 0,
        [CheckedInAt]               datetime2     NULL;
        
    PRINT 'Added verification fields to Bookings';
END
GO
