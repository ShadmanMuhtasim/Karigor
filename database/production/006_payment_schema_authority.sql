-- Sole Payment schema owner, version 1. Default: persistent-data read-only preflight.
-- Explicit future apply on the SAME operator-selected connection, with all writers stopped:
-- EXEC sys.sp_set_session_context @key=N'KarigorPaymentSchemaApply', @value=1;
-- Execute this entire file, then clear that session-context key.
-- No USE/database targeting, history repair, concurrency or idempotency features.
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Apply bit=ISNULL(TRY_CAST(SESSION_CONTEXT(N'KarigorPaymentSchemaApply') AS bit),0);
DECLARE @HasPayments bit=CASE WHEN OBJECT_ID(N'dbo.Payments',N'U') IS NULL THEN 0 ELSE 1 END;
DECLARE @HasPaymentStatus bit=CASE WHEN COL_LENGTH(N'dbo.Bookings',N'PaymentStatus') IS NULL THEN 0 ELSE 1 END;
DECLARE @CanReadPaymentStatus bit=CASE WHEN EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Bookings') AND name=N'PaymentStatus' AND system_type_id=231) THEN 1 ELSE 0 END;
DECLARE @HasCharge bit=CASE WHEN COL_LENGTH(N'dbo.Payments',N'ServiceCharge') IS NULL THEN 0 ELSE 1 END;
BEGIN TRY
    IF @Apply=1
    BEGIN
        BEGIN TRANSACTION;
        DECLARE @Locked bigint;
        IF OBJECT_ID(N'dbo.Bookings',N'U') IS NOT NULL
            SELECT @Locked=COUNT_BIG(*) FROM dbo.Bookings WITH(TABLOCKX,HOLDLOCK);
        IF @HasPayments=1 EXEC(N'SELECT COUNT_BIG(*) AS LockedPayments FROM dbo.Payments WITH(TABLOCKX,HOLDLOCK);');
    END;
    DROP TABLE IF EXISTS #PaymentIssues;
    CREATE TABLE #PaymentIssues(Severity nvarchar(10),Issue nvarchar(90),EntityId int NULL);
    DROP TABLE IF EXISTS #PaymentColumns;
    CREATE TABLE #PaymentColumns(Name sysname,TypeId int,Length int,Precision int,Scale int,Nullable bit,IdentityColumn bit);
    INSERT #PaymentColumns VALUES
        (N'Id',56,4,10,0,0,1),(N'BookingId',56,4,10,0,0,0),
        (N'TransactionId',231,200,0,0,0,0),(N'ValId',231,200,0,0,1,0),
        (N'BankTranId',231,200,0,0,1,0),(N'CardType',231,200,0,0,1,0),
        (N'Currency',231,20,0,0,0,0),
        (N'TotalAmount',106,9,18,2,0,0),(N'PlatformFee',106,9,18,2,0,0),
        (N'ServiceCharge',106,9,18,2,0,0),(N'WorkerAmount',106,9,18,2,0,0),
        (N'Status',231,100,0,0,0,0),(N'CreatedAt',42,8,27,7,0,0),
        (N'PaidAt',42,8,27,7,1,0),(N'GatewayResponse',231,-1,0,0,1,0);

    IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.Payments') AND minor_id=0
        AND name=N'KarigorPaymentSchemaVersion' AND (TRY_CAST(value AS int) IS NULL OR TRY_CAST(value AS int)<>1))
        INSERT #PaymentIssues VALUES(N'Blocker',N'unrecognized-payment-schema-version',NULL);

    IF OBJECT_ID(N'dbo.Bookings',N'U') IS NULL
        INSERT #PaymentIssues VALUES(N'Blocker',N'bookings-prerequisite-missing',NULL);
    IF @HasPaymentStatus=0
    BEGIN
        INSERT #PaymentIssues VALUES(N'Info',N'booking-paymentstatus-column-missing',NULL);
        IF EXISTS(SELECT 1 FROM dbo.Bookings)
            INSERT #PaymentIssues SELECT N'Review',N'missing-booking-paymentstatus-history',Id FROM dbo.Bookings;
    END
    ELSE
    BEGIN
        IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Bookings') AND name=N'PaymentStatus'
            AND system_type_id=231 AND max_length=100 AND is_nullable=0)
            INSERT #PaymentIssues VALUES(N'Blocker',N'booking-paymentstatus-column-shape',NULL);
        IF @CanReadPaymentStatus=1 EXEC(N'INSERT #PaymentIssues SELECT N''Review'',N''suspicious-booking-paymentstatus'',Id FROM dbo.Bookings
            WHERE PaymentStatus IS NULL OR PaymentStatus COLLATE Latin1_General_100_BIN2 NOT IN(N''Unpaid'',N''Paid'')
                OR DATALENGTH(PaymentStatus)<>DATALENGTH(LTRIM(RTRIM(PaymentStatus)));');
    END;
    IF @HasPayments=0
        INSERT #PaymentIssues VALUES(N'Info',N'payments-table-missing',NULL);
    ELSE
    BEGIN
        INSERT #PaymentIssues SELECT N'Blocker',N'payment-column-missing:'+e.Name,NULL FROM #PaymentColumns e
            LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.Payments') AND c.name=e.Name
            WHERE c.column_id IS NULL AND e.Name<>N'ServiceCharge';
        INSERT #PaymentIssues SELECT N'Blocker',N'payment-column-type:'+e.Name,NULL FROM #PaymentColumns e
            JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.Payments') AND c.name=e.Name
            WHERE c.system_type_id<>e.TypeId OR c.max_length<>e.Length OR c.precision<>e.Precision OR c.scale<>e.Scale;
        INSERT #PaymentIssues SELECT N'Blocker',N'payment-column-nullability:'+e.Name,NULL FROM #PaymentColumns e
            JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.Payments') AND c.name=e.Name WHERE c.is_nullable<>e.Nullable;
        INSERT #PaymentIssues SELECT N'Blocker',N'payment-column-identity:'+e.Name,NULL FROM #PaymentColumns e
            JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.Payments') AND c.name=e.Name WHERE c.is_identity<>e.IdentityColumn;
        INSERT #PaymentIssues SELECT N'Blocker',N'unrecognized-payment-column:'+c.Name,NULL FROM sys.columns c
            WHERE c.object_id=OBJECT_ID(N'dbo.Payments') AND NOT EXISTS(SELECT 1 FROM #PaymentColumns e WHERE e.Name=c.Name);
        IF @HasCharge=0
        BEGIN
            INSERT #PaymentIssues VALUES(N'Info',N'payment-servicecharge-column-missing',NULL);
            EXEC(N'INSERT #PaymentIssues SELECT N''Review'',N''missing-servicecharge-history'',Id FROM dbo.Payments;');
        END;
        -- Audit values when expected types/columns are readable; nullable drift is still diagnosable.
        IF NOT EXISTS(SELECT 1 FROM #PaymentIssues WHERE Issue LIKE N'payment-column-type:%' OR Issue LIKE N'payment-column-missing:%')
        BEGIN
            EXEC(N'
                INSERT #PaymentIssues SELECT N''Review'',N''duplicate-transaction-id'',MIN(Id) FROM dbo.Payments GROUP BY TransactionId HAVING COUNT(*)>1;
                INSERT #PaymentIssues SELECT N''Review'',N''malformed-transaction-id'',Id FROM dbo.Payments
                    WHERE TransactionId IS NULL OR LEN(LTRIM(RTRIM(TransactionId)))=0 OR
                        DATALENGTH(TransactionId)<>DATALENGTH(LTRIM(RTRIM(TransactionId))) OR
                        TransactionId LIKE N''%''+NCHAR(9)+N''%'' OR TransactionId LIKE N''%''+NCHAR(10)+N''%'' OR TransactionId LIKE N''%''+NCHAR(13)+N''%'';
                INSERT #PaymentIssues SELECT N''Review'',N''apparent-duplicate-validation-id'',MIN(Id) FROM dbo.Payments
                    WHERE NULLIF(LTRIM(RTRIM(ValId)),N'''') IS NOT NULL
                    GROUP BY ValId COLLATE Latin1_General_100_BIN2,DATALENGTH(ValId) HAVING COUNT(*)>1;
                INSERT #PaymentIssues SELECT N''Review'',N''apparent-duplicate-bank-transaction-id'',MIN(Id) FROM dbo.Payments
                    WHERE NULLIF(LTRIM(RTRIM(BankTranId)),N'''') IS NOT NULL
                    GROUP BY BankTranId COLLATE Latin1_General_100_BIN2,DATALENGTH(BankTranId) HAVING COUNT(*)>1;
                INSERT #PaymentIssues SELECT N''Review'',N''multiple-completed-attempts'',BookingId FROM dbo.Payments
                    WHERE Status=N''Completed'' GROUP BY BookingId HAVING COUNT(*)>1;
                INSERT #PaymentIssues SELECT N''Review'',N''orphan-payment'',p.Id FROM dbo.Payments p LEFT JOIN dbo.Bookings b ON b.Id=p.BookingId WHERE b.Id IS NULL;
                INSERT #PaymentIssues SELECT N''Review'',N''invalid-payment-amount'',Id FROM dbo.Payments
                    WHERE TotalAmount IS NULL OR TotalAmount<=0 OR PlatformFee IS NULL OR PlatformFee<0 OR WorkerAmount IS NULL OR WorkerAmount<0;
                INSERT #PaymentIssues SELECT N''Review'',N''unsupported-payment-currency'',Id FROM dbo.Payments
                    WHERE Currency IS NULL OR Currency COLLATE Latin1_General_100_BIN2<>N''BDT'' OR DATALENGTH(Currency)<>6;
                INSERT #PaymentIssues SELECT N''Review'',N''suspicious-payment-status'',Id FROM dbo.Payments
                    WHERE Status IS NULL OR Status COLLATE Latin1_General_100_BIN2 NOT IN(N''Initiated'',N''Completed'',N''Failed'',N''Cancelled'')
                        OR DATALENGTH(Status)<>DATALENGTH(LTRIM(RTRIM(Status)));
                INSERT #PaymentIssues SELECT N''Review'',N''completed-receipt-incomplete'',Id FROM dbo.Payments
                    WHERE Status=N''Completed'' AND (PaidAt IS NULL OR NULLIF(LTRIM(RTRIM(ValId)),N'''') IS NULL);
                INSERT #PaymentIssues SELECT N''Review'',N''missing-payment-creation-time'',Id FROM dbo.Payments WHERE CreatedAt IS NULL;
                INSERT #PaymentIssues SELECT N''Review'',N''payment-booking-amount-mismatch'',p.Id FROM dbo.Payments p JOIN dbo.Bookings b ON b.Id=p.BookingId
                    WHERE p.TotalAmount<>b.AgreedPrice;
            ');
            IF @HasCharge=1 EXEC(N'INSERT #PaymentIssues SELECT N''Review'',N''invalid-fee-breakdown'',Id FROM dbo.Payments
                WHERE ServiceCharge IS NULL OR ServiceCharge<0 OR TotalAmount<>PlatformFee+ServiceCharge+WorkerAmount;');
            IF @CanReadPaymentStatus=1 EXEC(N'
                INSERT #PaymentIssues SELECT N''Review'',N''completed-payment-booking-not-paid'',p.Id FROM dbo.Payments p JOIN dbo.Bookings b ON b.Id=p.BookingId
                    WHERE p.Status=N''Completed'' AND (b.PaymentStatus IS NULL OR b.PaymentStatus<>N''Paid'');
                INSERT #PaymentIssues SELECT N''Review'',N''paid-booking-without-completion'',b.Id FROM dbo.Bookings b
                    WHERE b.PaymentStatus=N''Paid'' AND NOT EXISTS(SELECT 1 FROM dbo.Payments p WHERE p.BookingId=b.Id AND p.Status=N''Completed'');');
        END;
        -- Named indexes may be absent, but conflicting definitions are never silently replaced.
        INSERT #PaymentIssues SELECT N'Blocker',N'conflicting-payment-index:'+i.name,NULL FROM sys.indexes i
            OUTER APPLY(SELECT STRING_AGG(CONVERT(nvarchar(max),c.name),N',') WITHIN GROUP(ORDER BY ic.key_ordinal) AS Keys
                FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
                WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0) k
            WHERE i.object_id=OBJECT_ID(N'dbo.Payments') AND (
                (i.name=N'PK_Payments' AND (i.is_primary_key<>1 OR k.Keys<>N'Id')) OR
                (i.name=N'UQ_Payments_TransactionId' AND (i.is_unique<>1 OR k.Keys<>N'TransactionId' OR i.has_filter=1)) OR
                (i.name=N'IX_Payments_BookingId' AND (i.is_unique=1 OR k.Keys<>N'BookingId' OR i.has_filter=1)) OR
                (i.name=N'IX_Payments_Status' AND (i.is_unique=1 OR k.Keys<>N'Status' OR i.has_filter=1)) OR
                i.is_disabled=1 OR (i.is_unique=1 AND i.name NOT IN(N'PK_Payments',N'UQ_Payments_TransactionId')));
        INSERT #PaymentIssues SELECT N'Blocker',N'conflicting-payment-fk',NULL FROM sys.foreign_keys f
            WHERE f.parent_object_id=OBJECT_ID(N'dbo.Payments') AND
                (f.name<>N'FK_Payments_Bookings_BookingId' OR f.referenced_object_id<>OBJECT_ID(N'dbo.Bookings') OR f.delete_referential_action<>1 OR
                 (SELECT COUNT(*) FROM sys.foreign_key_columns c WHERE c.constraint_object_id=f.object_id)<>1 OR
                 NOT EXISTS(SELECT 1 FROM sys.foreign_key_columns c WHERE c.constraint_object_id=f.object_id
                    AND COL_NAME(c.parent_object_id,c.parent_column_id)=N'BookingId' AND COL_NAME(c.referenced_object_id,c.referenced_column_id)=N'Id'));
    END;
    IF @HasPayments=0 AND @CanReadPaymentStatus=1
        EXEC(N'INSERT #PaymentIssues SELECT N''Review'',N''paid-booking-without-completion'',Id FROM dbo.Bookings WHERE PaymentStatus=N''Paid'';');
    SELECT Severity,Issue,EntityId FROM #PaymentIssues ORDER BY Severity,Issue,EntityId;
    IF @Apply=0 RETURN;
    IF EXISTS(SELECT 1 FROM #PaymentIssues WHERE Severity<>N'Info')
        THROW 51060,'Payment preflight requires review. No financial history or unsupported schema was rewritten.',1;
    IF @HasPaymentStatus=0
        ALTER TABLE dbo.Bookings ADD PaymentStatus nvarchar(50) NOT NULL CONSTRAINT DF_Bookings_PaymentStatus DEFAULT N'Unpaid';
    IF @HasPayments=0
        EXEC(N'CREATE TABLE dbo.Payments(
            Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Payments PRIMARY KEY,
            BookingId int NOT NULL,TransactionId nvarchar(100) NOT NULL,
            ValId nvarchar(100) NULL,BankTranId nvarchar(100) NULL,CardType nvarchar(100) NULL,
            Currency nvarchar(10) NOT NULL CONSTRAINT DF_Payments_Currency DEFAULT N''BDT'',
            TotalAmount decimal(18,2) NOT NULL,PlatformFee decimal(18,2) NOT NULL,
            ServiceCharge decimal(18,2) NOT NULL CONSTRAINT DF_Payments_ServiceCharge DEFAULT 0,
            WorkerAmount decimal(18,2) NOT NULL,
            Status nvarchar(50) NOT NULL CONSTRAINT DF_Payments_Status DEFAULT N''Initiated'',
            CreatedAt datetime2 NOT NULL CONSTRAINT DF_Payments_CreatedAt DEFAULT SYSUTCDATETIME(),
            PaidAt datetime2 NULL,GatewayResponse nvarchar(max) NULL);');
    ELSE IF @HasCharge=0
        EXEC(N'ALTER TABLE dbo.Payments ADD ServiceCharge decimal(18,2) NOT NULL CONSTRAINT DF_Payments_ServiceCharge DEFAULT 0;');

    -- Normalize defaults without UPDATE/backfill. Missing columns were allowed only on empty tables.
    DECLARE @Defaults TABLE(TableName sysname,ColumnName sysname,ConstraintName sysname,Expression nvarchar(100));
    INSERT @Defaults VALUES(N'Bookings',N'PaymentStatus',N'DF_Bookings_PaymentStatus',N'N''Unpaid'''),
        (N'Payments',N'Currency',N'DF_Payments_Currency',N'N''BDT'''),
        (N'Payments',N'ServiceCharge',N'DF_Payments_ServiceCharge',N'0'),
        (N'Payments',N'Status',N'DF_Payments_Status',N'N''Initiated'''),
        (N'Payments',N'CreatedAt',N'DF_Payments_CreatedAt',N'SYSUTCDATETIME()');
    DECLARE @Table sysname,@Column sysname,@Constraint sysname,@Expression nvarchar(100),@Old sysname,@Sql nvarchar(max);
    DECLARE DefaultsCursor CURSOR LOCAL FAST_FORWARD FOR SELECT * FROM @Defaults;
    OPEN DefaultsCursor; FETCH NEXT FROM DefaultsCursor INTO @Table,@Column,@Constraint,@Expression;
    WHILE @@FETCH_STATUS=0
    BEGIN
        SET @Old=NULL;
        SELECT @Old=d.name FROM sys.default_constraints d JOIN sys.columns c ON c.default_object_id=d.object_id
            WHERE c.object_id=OBJECT_ID(N'dbo.'+@Table) AND c.name=@Column;
        IF @Old IS NOT NULL
        BEGIN
            SET @Sql=N'ALTER TABLE dbo.'+QUOTENAME(@Table)+N' DROP CONSTRAINT '+QUOTENAME(@Old);
            EXEC(@Sql);
        END;
        SET @Sql=N'ALTER TABLE dbo.'+QUOTENAME(@Table)+N' ADD CONSTRAINT '+QUOTENAME(@Constraint)+N' DEFAULT '+@Expression+N' FOR '+QUOTENAME(@Column);
        EXEC(@Sql);
        FETCH NEXT FROM DefaultsCursor INTO @Table,@Column,@Constraint,@Expression;
    END;
    CLOSE DefaultsCursor; DEALLOCATE DefaultsCursor;
    IF NOT EXISTS(SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.Payments') AND name=N'PK_Payments')
        EXEC(N'ALTER TABLE dbo.Payments ADD CONSTRAINT PK_Payments PRIMARY KEY(Id);');
    -- A matching EF-created unique index is adopted as the existing SQL unique constraint.
    IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Payments') AND name=N'UQ_Payments_TransactionId' AND is_unique_constraint=0)
        EXEC(N'DROP INDEX UQ_Payments_TransactionId ON dbo.Payments;');
    IF NOT EXISTS(SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.Payments') AND name=N'UQ_Payments_TransactionId')
        EXEC(N'ALTER TABLE dbo.Payments ADD CONSTRAINT UQ_Payments_TransactionId UNIQUE(TransactionId);');
    IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Payments') AND name=N'IX_Payments_BookingId')
        EXEC(N'CREATE INDEX IX_Payments_BookingId ON dbo.Payments(BookingId);');
    IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Payments') AND name=N'IX_Payments_Status')
        EXEC(N'CREATE INDEX IX_Payments_Status ON dbo.Payments(Status);');
    IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(N'dbo.Payments') AND name=N'FK_Payments_Bookings_BookingId')
        EXEC(N'ALTER TABLE dbo.Payments WITH CHECK ADD CONSTRAINT FK_Payments_Bookings_BookingId FOREIGN KEY(BookingId) REFERENCES dbo.Bookings(Id) ON DELETE CASCADE;');
    EXEC(N'ALTER TABLE dbo.Payments WITH CHECK CHECK CONSTRAINT FK_Payments_Bookings_BookingId;');
    IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.Payments') AND minor_id=0 AND name=N'KarigorPaymentSchemaVersion')
        EXEC sys.sp_updateextendedproperty @name=N'KarigorPaymentSchemaVersion',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'Payments';
    ELSE
        EXEC sys.sp_addextendedproperty @name=N'KarigorPaymentSchemaVersion',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'Payments';
    COMMIT;
END TRY
BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    THROW;
END CATCH;
