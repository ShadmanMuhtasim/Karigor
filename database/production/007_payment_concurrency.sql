-- Sole version-2 Payment schema owner, following 006. Default: read-only preflight.
-- Explicit apply: EXEC sys.sp_set_session_context @key=N'KarigorPaymentConcurrencyApply',@value=1;
-- Never backfill provider facts, select historical settlements, or repair financial data.
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Apply bit=CASE WHEN TRY_CAST(SESSION_CONTEXT(N'KarigorPaymentConcurrencyApply') AS int)=1 THEN 1 ELSE 0 END;
DECLARE @Version int=(SELECT TRY_CAST(value AS int) FROM sys.extended_properties
    WHERE major_id=OBJECT_ID(N'dbo.Payments') AND minor_id=0 AND name=N'KarigorPaymentSchemaVersion');
DECLARE @Issues TABLE(Severity nvarchar(10),Code nvarchar(100),EntityId int NULL,Detail nvarchar(400));
IF @Version IS NULL OR @Version NOT IN(1,2)
    INSERT @Issues VALUES(N'Blocker',N'payment-schema-prerequisite',NULL,N'Explicitly audit/apply 006 first; only versions 1 and 2 are recognized.');
IF @Apply=1 BEGIN TRANSACTION;
BEGIN TRY
    IF @Version=1
    BEGIN

        DECLARE @Columns TABLE(Name sysname,TypeId int,Length int,Precision int,Scale int,Nullable bit,IdentityColumn bit);
        INSERT @Columns VALUES
            (N'Id',56,4,10,0,0,1),(N'BookingId',56,4,10,0,0,0),
            (N'TransactionId',231,200,0,0,0,0),(N'ValId',231,200,0,0,1,0),
            (N'BankTranId',231,200,0,0,1,0),(N'CardType',231,200,0,0,1,0),
            (N'Currency',231,20,0,0,0,0),(N'TotalAmount',106,9,18,2,0,0),
            (N'PlatformFee',106,9,18,2,0,0),(N'ServiceCharge',106,9,18,2,0,0),
            (N'WorkerAmount',106,9,18,2,0,0),(N'Status',231,100,0,0,0,0),
            (N'CreatedAt',42,8,27,7,0,0),(N'PaidAt',42,8,27,7,1,0),(N'GatewayResponse',231,-1,0,0,1,0);
        DECLARE @Defaults TABLE(TableName sysname,ColumnName sysname,ConstraintName sysname,Definition nvarchar(100));
        INSERT @Defaults VALUES(N'Bookings',N'PaymentStatus',N'DF_Bookings_PaymentStatus',N'N''Unpaid'''),
            (N'Payments',N'Currency',N'DF_Payments_Currency',N'N''BDT'''),
            (N'Payments',N'ServiceCharge',N'DF_Payments_ServiceCharge',N'0'),
            (N'Payments',N'Status',N'DF_Payments_Status',N'N''Initiated'''),
            (N'Payments',N'CreatedAt',N'DF_Payments_CreatedAt',N'SYSUTCDATETIME');
        DECLARE @Indexes TABLE(Name sysname,Keys nvarchar(100),IsUnique bit,IsPrimary bit,IsConstraint bit);
        INSERT @Indexes VALUES(N'PK_Payments',N'Id',1,1,0),(N'UQ_Payments_TransactionId',N'TransactionId',1,0,1),
            (N'IX_Payments_BookingId',N'BookingId',0,0,0),(N'IX_Payments_Status',N'Status',0,0,0);
        IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.Payments') AND minor_id=0
            AND name=N'KarigorPaymentSchemaVersion' AND TRY_CAST(value AS int)=1)
            OR (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Payments'))<>15
            OR EXISTS(SELECT 1 FROM @Columns e LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.Payments') AND c.name=e.Name
                WHERE c.column_id IS NULL OR c.system_type_id<>e.TypeId OR c.max_length<>e.Length OR c.precision<>e.Precision
                    OR c.scale<>e.Scale OR c.is_nullable<>e.Nullable OR c.is_identity<>e.IdentityColumn)
            OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Bookings') AND name=N'PaymentStatus'
                AND system_type_id=231 AND max_length=100 AND is_nullable=0)
            OR EXISTS(SELECT 1 FROM @Defaults e LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.'+e.TableName) AND c.name=e.ColumnName
                LEFT JOIN sys.default_constraints d ON d.object_id=c.default_object_id
                WHERE d.name IS NULL OR d.name<>e.ConstraintName OR
                    CASE WHEN e.ColumnName=N'CreatedAt' THEN UPPER(REPLACE(REPLACE(d.definition,N'(',N''),N')',N''))
                         ELSE REPLACE(REPLACE(d.definition,N'(',N''),N')',N'') END COLLATE Latin1_General_100_BIN2<>e.Definition)
            OR EXISTS(SELECT 1 FROM @Indexes e LEFT JOIN sys.indexes i ON i.object_id=OBJECT_ID(N'dbo.Payments') AND i.name=e.Name
                OUTER APPLY(SELECT STRING_AGG(CONVERT(nvarchar(max),c.name),N',') WITHIN GROUP(ORDER BY ic.key_ordinal) AS Keys
                    FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
                    WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0) k
                WHERE k.Keys IS NULL OR k.Keys<>e.Keys OR i.is_unique<>e.IsUnique OR i.is_primary_key<>e.IsPrimary
                    OR i.is_unique_constraint<>e.IsConstraint OR i.is_disabled=1 OR i.has_filter=1)
            OR EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Payments') AND is_unique=1
                AND name NOT IN(N'PK_Payments',N'UQ_Payments_TransactionId'))
            OR (SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(N'dbo.Payments'))<>1
            OR NOT EXISTS(SELECT 1 FROM sys.foreign_keys f WHERE f.parent_object_id=OBJECT_ID(N'dbo.Payments')
                AND f.name=N'FK_Payments_Bookings_BookingId' AND f.referenced_object_id=OBJECT_ID(N'dbo.Bookings')
                AND f.delete_referential_action=1 AND f.is_disabled=0 AND f.is_not_trusted=0
                AND (SELECT COUNT(*) FROM sys.foreign_key_columns c WHERE c.constraint_object_id=f.object_id)=1
                AND EXISTS(SELECT 1 FROM sys.foreign_key_columns c WHERE c.constraint_object_id=f.object_id
                    AND COL_NAME(c.parent_object_id,c.parent_column_id)=N'BookingId' AND COL_NAME(c.referenced_object_id,c.referenced_column_id)=N'Id'))
            INSERT @Issues VALUES(N'Blocker',N'version-one-schema-drift',NULL,N'The exact 006 metadata contract is required before upgrade.');
        
        -- Application writers are excluded for the whole apply/preflight-to-DDL decision.
        IF @Apply=1
        BEGIN
            DECLARE @LockCount bigint;
            SELECT @LockCount=COUNT_BIG(*) FROM dbo.Bookings WITH(TABLOCKX,HOLDLOCK);
            SELECT @LockCount=COUNT_BIG(*) FROM dbo.Payments WITH(TABLOCKX,HOLDLOCK);
        END;
        INSERT @Issues SELECT N'Review',N'legacy-payment-outcome',Id,
            N'Existing attempt has no authenticated merchant/environment or selected allocation provenance. Review externally; no automatic adoption.' FROM dbo.Payments;
        INSERT @Issues SELECT N'Review',N'legacy-booking-payment-provenance',Id,
            N'PaymentStatus is not a known Unpaid state; historical allocation must not be invented.'
            FROM dbo.Bookings WHERE PaymentStatus COLLATE Latin1_General_100_BIN2<>N'Unpaid';
        IF COL_LENGTH(N'dbo.Payments',N'RowVersion') IS NOT NULL OR COL_LENGTH(N'dbo.Bookings',N'SelectedPaymentId') IS NOT NULL
            INSERT @Issues VALUES(N'Blocker',N'partial-concurrency-schema',NULL,N'Unexpected partial upgrade; investigate rather than reinterpret it.');
    END;
    IF @Version=2
        INSERT @Issues VALUES(N'Info',N'already-version-two',NULL,N'No schema or financial rows changed. Run the application metadata gate to detect drift.');
    SELECT * FROM @Issues ORDER BY Severity,Code,EntityId;
    IF @Apply=0 RETURN;
    IF EXISTS(SELECT 1 FROM @Issues WHERE Severity<>N'Info')
        THROW 51070,'Payment concurrency preflight requires review. No financial data or schema changed.',1;
    IF @Version=1
    BEGIN
        -- Dynamic batch compiles only after prerequisites have been checked. Atomic DDL.
        EXEC sys.sp_executesql N'
            ALTER TABLE dbo.Payments ADD RowVersion rowversion NOT NULL,
                InitiationFingerprint nvarchar(64) NULL,InitiationState nvarchar(20) NULL,
                InitiationDispatchedAt datetime2 NULL,InitiationMerchantId nvarchar(100) NULL,
                InitiationEnvironment nvarchar(10) NULL,ProviderSessionKey nvarchar(100) NULL,
                ProviderGatewayUrl nvarchar(2048) NULL,VerifiedMerchantId nvarchar(100) NULL,
                VerifiedEnvironment nvarchar(10) NULL,VerifiedTransactionId nvarchar(100) NULL,
                RequiresReview bit NOT NULL CONSTRAINT DF_Payments_RequiresReview DEFAULT 0;
            ALTER TABLE dbo.Bookings ADD RowVersion rowversion NOT NULL,SelectedPaymentId int NULL;';
        EXEC sys.sp_executesql N'
            ALTER TABLE dbo.Payments ADD CONSTRAINT UQ_Payments_Id_BookingId UNIQUE(Id,BookingId);
            CREATE UNIQUE INDEX UX_Payment_InitiationIntent ON dbo.Payments(BookingId) WHERE InitiationFingerprint IS NOT NULL;
            CREATE UNIQUE INDEX UX_Payment_VerifiedIdentity ON dbo.Payments(VerifiedMerchantId,VerifiedEnvironment,VerifiedTransactionId) WHERE VerifiedTransactionId IS NOT NULL;
            ALTER TABLE dbo.Bookings ADD CONSTRAINT FK_PaymentAllocation_Booking FOREIGN KEY(SelectedPaymentId,Id)
                REFERENCES dbo.Payments(Id,BookingId);
            ALTER TABLE dbo.Payments ADD CONSTRAINT CK_Payment_Initiation CHECK (
                (InitiationFingerprint IS NULL AND InitiationState IS NULL AND InitiationMerchantId IS NULL AND InitiationEnvironment IS NULL)
                OR (InitiationFingerprint IS NOT NULL AND InitiationState IS NOT NULL AND InitiationMerchantId IS NOT NULL AND InitiationEnvironment IS NOT NULL AND LEN(InitiationFingerprint)=64 AND InitiationState IN(N''Reserved'',N''Dispatching'',N''Ready'',N''Unknown'')
                    AND LEN(InitiationMerchantId)>0 AND InitiationEnvironment IN(N''Sandbox'',N''Live'')));
            ALTER TABLE dbo.Payments ADD CONSTRAINT CK_Payment_Verified CHECK (
                (VerifiedTransactionId IS NULL AND VerifiedMerchantId IS NULL AND VerifiedEnvironment IS NULL AND RequiresReview=0 AND Status<>N''Completed'')
                OR (VerifiedTransactionId IS NOT NULL AND VerifiedMerchantId IS NOT NULL AND VerifiedEnvironment IS NOT NULL AND LEN(VerifiedMerchantId)>0 AND VerifiedEnvironment IN(N''Sandbox'',N''Live'')
                    AND VerifiedTransactionId=TransactionId AND Status=N''Completed'' AND PaidAt IS NOT NULL AND ValId IS NOT NULL));';
        EXEC sys.sp_executesql N'CREATE TRIGGER dbo.TR_Payment_Facts_Immutable ON dbo.Payments AFTER UPDATE,DELETE AS
        BEGIN
            SET NOCOUNT ON;
            IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.Id=d.Id WHERE d.Status=N''Completed'' AND
                (i.Id IS NULL OR EXISTS(SELECT d.BookingId,d.TransactionId,d.TotalAmount,d.PlatformFee,d.ServiceCharge,d.WorkerAmount,d.Currency,
                    d.Status,d.ValId,d.BankTranId,d.CardType,d.PaidAt,d.GatewayResponse,d.VerifiedMerchantId,d.VerifiedEnvironment,d.VerifiedTransactionId,d.RequiresReview
                    EXCEPT SELECT i.BookingId,i.TransactionId,i.TotalAmount,i.PlatformFee,i.ServiceCharge,i.WorkerAmount,i.Currency,
                    i.Status,i.ValId,i.BankTranId,i.CardType,i.PaidAt,i.GatewayResponse,i.VerifiedMerchantId,i.VerifiedEnvironment,i.VerifiedTransactionId,i.RequiresReview)))
                THROW 51072,''Verified payment facts are immutable.'',1;
            IF EXISTS(SELECT 1 FROM deleted d JOIN inserted i ON i.Id=d.Id WHERE d.InitiationFingerprint IS NOT NULL AND
                EXISTS(SELECT d.BookingId,d.TransactionId,d.TotalAmount,d.PlatformFee,d.ServiceCharge,d.WorkerAmount,d.Currency,
                    d.InitiationFingerprint,d.InitiationMerchantId,d.InitiationEnvironment
                    EXCEPT SELECT i.BookingId,i.TransactionId,i.TotalAmount,i.PlatformFee,i.ServiceCharge,i.WorkerAmount,i.Currency,
                    i.InitiationFingerprint,i.InitiationMerchantId,i.InitiationEnvironment))
                THROW 51072,''Payment initiation terms are immutable.'',1;
            IF EXISTS(SELECT 1 FROM deleted d JOIN inserted i ON i.Id=d.Id WHERE
                (d.InitiationState IN(N''Dispatching'',N''Unknown'',N''Ready'') AND i.InitiationState=N''Reserved'')
                OR (d.InitiationState IN(N''Unknown'',N''Ready'') AND i.InitiationState=N''Dispatching''))
                THROW 51072,''A dispatched initiation cannot be dispatched again.'',1;
        END;';
        EXEC sys.sp_executesql N'CREATE TRIGGER dbo.TR_Booking_PaymentAllocation ON dbo.Bookings AFTER INSERT,UPDATE AS
        BEGIN
            SET NOCOUNT ON;
            IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN dbo.Payments p ON p.Id=i.SelectedPaymentId AND p.BookingId=i.Id WHERE
                (i.SelectedPaymentId IS NOT NULL AND (p.Status<>N''Completed'' OR i.PaymentStatus<>N''Paid'' OR p.RequiresReview=1))
                OR (i.PaymentStatus=N''Paid'' AND i.SelectedPaymentId IS NULL))
                THROW 51073,''Booking allocation must reference its own verified successful settlement.'',1;
            IF EXISTS(SELECT 1 FROM deleted d JOIN inserted i ON i.Id=d.Id WHERE d.SelectedPaymentId IS NOT NULL AND
                (i.SelectedPaymentId IS NULL OR i.SelectedPaymentId<>d.SelectedPaymentId OR i.PaymentStatus<>N''Paid''))
                THROW 51073,''A selected booking settlement cannot be replaced or downgraded.'',1;
        END;';
        EXEC sys.sp_updateextendedproperty @name=N'KarigorPaymentSchemaVersion',@value=2,
            @level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'Payments';
    END;
    COMMIT;
END TRY
BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    THROW;
END CATCH;
