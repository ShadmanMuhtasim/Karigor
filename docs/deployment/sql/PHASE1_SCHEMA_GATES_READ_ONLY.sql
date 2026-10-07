-- Read-only current runtime metadata gates. Generated from the sources below.
-- Payment BaseSql is rendered for current marker 2. No web startup/seeding.
-- Recheck source hashes on a different release; regenerate if they change.
-- F5SchemaGate.cs SHA-256: 130944e7c9e6187ff14e898e165a26a264a473280f5fe3e2c19ee9f6708f01ab
-- PaymentSchemaGate.cs SHA-256: 9a3ce8c6f08b55928df4deb7e2051958b249ddaef786b68c99375606d432500b
-- RefreshSessionSchemaGate.cs SHA-256: bfb02602ab762fdef6c4d3f3fa023c5e22037c66d92b7c9a5addd13dd18ee9b7
SET NOCOUNT ON;
SET LOCK_TIMEOUT 5000;
SET DEADLOCK_PRIORITY LOW;
DECLARE @ExpectedDatabase sysname=N'<TARGET_DATABASE>';
IF @ExpectedDatabase=N'<TARGET_DATABASE>' OR DB_NAME()<>@ExpectedDatabase
    THROW 51100,'Select and explicitly confirm the intended database before running preflight.',1;
IF SESSION_CONTEXT(N'KarigorF5Apply') IS NOT NULL
 OR SESSION_CONTEXT(N'KarigorPaymentSchemaApply') IS NOT NULL
 OR SESSION_CONTEXT(N'KarigorPaymentConcurrencyApply') IS NOT NULL
 OR SESSION_CONTEXT(N'KarigorF6Apply') IS NOT NULL
 OR SESSION_CONTEXT(N'KarigorF6ForceSignInReset') IS NOT NULL
    THROW 51101,'Use a new read-only connection with no migration flags.',1;
IF ISNULL(HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'VIEW DEFINITION'),0)<>1
    THROW 51102,'Metadata visibility is required; hidden objects cannot be treated as absent.',1;


-- Exact F5SchemaGate SQL, isolated local-variable scope.
EXEC sys.sp_executesql N'DECLARE @ExpectedIndexes TABLE(TableName sysname,IndexName sysname,Keys nvarchar(100),Filter nvarchar(100));
INSERT @ExpectedIndexes VALUES
    (N''Quotations'',N''UX_F5_Quotations_Pending'',N''ServiceRequestId,WorkerId'',N''[Status]=N''''Pending''''''),
    (N''Quotations'',N''UX_F5_Quotations_Child'',N''ParentQuotationId'',N''[ParentQuotationId]ISNOTNULL''),
    (N''Bookings'',N''UX_F5_Bookings_Request'',N''ServiceRequestId'',NULL);
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N''dbo.Quotations'')
    AND minor_id=0 AND name=N''KarigorF5Version'' AND TRY_CAST(value AS int)=1)
    OR COL_LENGTH(N''dbo.Quotations'',N''ProposedByUserId'') IS NULL
    OR COL_LENGTH(N''dbo.Quotations'',N''CreatedAt'') IS NULL
    OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N''dbo.Quotations'') AND name=N''RowVersion'' AND system_type_id=189)
    OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N''dbo.ServiceRequests'') AND name=N''RowVersion'' AND system_type_id=189)
    OR NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N''dbo.Quotations'') AND name=N''UX_F5_Quotations_Pending'' AND is_unique=1 AND is_disabled=0 AND has_filter=1)
    OR NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N''dbo.Quotations'') AND name=N''UX_F5_Quotations_Child'' AND is_unique=1 AND is_disabled=0 AND has_filter=1)
    OR NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N''dbo.Bookings'') AND name=N''UX_F5_Bookings_Request'' AND is_unique=1 AND is_disabled=0)
    OR EXISTS(SELECT 1 FROM @ExpectedIndexes e
        LEFT JOIN sys.indexes i ON i.object_id=OBJECT_ID(N''dbo.''+e.TableName) AND i.name=e.IndexName
        OUTER APPLY(SELECT STRING_AGG(CONVERT(nvarchar(max),c.name),N'','') WITHIN GROUP(ORDER BY ic.key_ordinal) AS Keys
            FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
            WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0) k
        WHERE k.Keys<>e.Keys OR k.Keys IS NULL OR
            EXISTS(SELECT REPLACE(REPLACE(REPLACE(i.filter_definition,N''('',N''''),N'')'',N''''),N'' '',N'''') EXCEPT SELECT e.Filter))
    OR NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=N''FK_F5_Quotation_Proposer'' AND is_disabled=0 AND is_not_trusted=0)
    OR NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=N''CK_F5_Quotation_Status'' AND is_disabled=0 AND is_not_trusted=0)
    OR NOT EXISTS(SELECT 1 FROM sys.triggers WHERE parent_id=OBJECT_ID(N''dbo.Quotations'') AND name=N''TR_F5_Quotation_Immutable'' AND is_disabled=0)
    THROW 51010,''F5 schema missing/incomplete. Apply database/production/005_f5_negotiation_integrity.sql during an authorized writer outage.'',1;';

-- Exact PaymentSchemaGate SQL, isolated local-variable scope.
EXEC sys.sp_executesql N'DECLARE @Columns TABLE(Name sysname,TypeId int,Length int,Precision int,Scale int,Nullable bit,IdentityColumn bit);
INSERT @Columns VALUES
    (N''Id'',56,4,10,0,0,1),(N''BookingId'',56,4,10,0,0,0),
    (N''TransactionId'',231,200,0,0,0,0),(N''ValId'',231,200,0,0,1,0),
    (N''BankTranId'',231,200,0,0,1,0),(N''CardType'',231,200,0,0,1,0),
    (N''Currency'',231,20,0,0,0,0),(N''TotalAmount'',106,9,18,2,0,0),
    (N''PlatformFee'',106,9,18,2,0,0),(N''ServiceCharge'',106,9,18,2,0,0),
    (N''WorkerAmount'',106,9,18,2,0,0),(N''Status'',231,100,0,0,0,0),
    (N''CreatedAt'',42,8,27,7,0,0),(N''PaidAt'',42,8,27,7,1,0),(N''GatewayResponse'',231,-1,0,0,1,0);
DECLARE @Defaults TABLE(TableName sysname,ColumnName sysname,ConstraintName sysname,Definition nvarchar(100));
INSERT @Defaults VALUES(N''Bookings'',N''PaymentStatus'',N''DF_Bookings_PaymentStatus'',N''N''''Unpaid''''''),
    (N''Payments'',N''Currency'',N''DF_Payments_Currency'',N''N''''BDT''''''),
    (N''Payments'',N''ServiceCharge'',N''DF_Payments_ServiceCharge'',N''0''),
    (N''Payments'',N''Status'',N''DF_Payments_Status'',N''N''''Initiated''''''),
    (N''Payments'',N''CreatedAt'',N''DF_Payments_CreatedAt'',N''SYSUTCDATETIME'');
DECLARE @Indexes TABLE(Name sysname,Keys nvarchar(100),IsUnique bit,IsPrimary bit,IsConstraint bit);
INSERT @Indexes VALUES(N''PK_Payments'',N''Id'',1,1,0),(N''UQ_Payments_TransactionId'',N''TransactionId'',1,0,1),
    (N''IX_Payments_BookingId'',N''BookingId'',0,0,0),(N''IX_Payments_Status'',N''Status'',0,0,0);
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N''dbo.Payments'') AND minor_id=0
    AND name=N''KarigorPaymentSchemaVersion'' AND TRY_CAST(value AS int)=2)
    OR (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N''dbo.Payments''))<>27
    OR EXISTS(SELECT 1 FROM @Columns e LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N''dbo.Payments'') AND c.name=e.Name
        WHERE c.column_id IS NULL OR c.system_type_id<>e.TypeId OR c.max_length<>e.Length OR c.precision<>e.Precision
            OR c.scale<>e.Scale OR c.is_nullable<>e.Nullable OR c.is_identity<>e.IdentityColumn)
    OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N''dbo.Bookings'') AND name=N''PaymentStatus''
        AND system_type_id=231 AND max_length=100 AND is_nullable=0)
    OR EXISTS(SELECT 1 FROM @Defaults e LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N''dbo.''+e.TableName) AND c.name=e.ColumnName
        LEFT JOIN sys.default_constraints d ON d.object_id=c.default_object_id
        WHERE d.name IS NULL OR d.name<>e.ConstraintName OR
            CASE WHEN e.ColumnName=N''CreatedAt'' THEN UPPER(REPLACE(REPLACE(d.definition,N''('',N''''),N'')'',N''''))
                 ELSE REPLACE(REPLACE(d.definition,N''('',N''''),N'')'',N'''') END COLLATE Latin1_General_100_BIN2<>e.Definition)
    OR EXISTS(SELECT 1 FROM @Indexes e LEFT JOIN sys.indexes i ON i.object_id=OBJECT_ID(N''dbo.Payments'') AND i.name=e.Name
        OUTER APPLY(SELECT STRING_AGG(CONVERT(nvarchar(max),c.name),N'','') WITHIN GROUP(ORDER BY ic.key_ordinal) AS Keys
            FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
            WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0) k
        WHERE k.Keys IS NULL OR k.Keys<>e.Keys OR i.is_unique<>e.IsUnique OR i.is_primary_key<>e.IsPrimary
            OR i.is_unique_constraint<>e.IsConstraint OR i.is_disabled=1 OR i.has_filter=1)
    OR EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N''dbo.Payments'') AND is_unique=1
        AND name NOT IN(N''PK_Payments'',N''UQ_Payments_TransactionId'')
        AND name NOT IN(N''UQ_Payments_Id_BookingId'',N''UX_Payment_InitiationIntent'',N''UX_Payment_VerifiedIdentity''))
    OR (SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(N''dbo.Payments''))<>1
    OR NOT EXISTS(SELECT 1 FROM sys.foreign_keys f WHERE f.parent_object_id=OBJECT_ID(N''dbo.Payments'')
        AND f.name=N''FK_Payments_Bookings_BookingId'' AND f.referenced_object_id=OBJECT_ID(N''dbo.Bookings'')
        AND f.delete_referential_action=1 AND f.is_disabled=0 AND f.is_not_trusted=0
        AND (SELECT COUNT(*) FROM sys.foreign_key_columns c WHERE c.constraint_object_id=f.object_id)=1
        AND EXISTS(SELECT 1 FROM sys.foreign_key_columns c WHERE c.constraint_object_id=f.object_id
            AND COL_NAME(c.parent_object_id,c.parent_column_id)=N''BookingId'' AND COL_NAME(c.referenced_object_id,c.referenced_column_id)=N''Id''))
    THROW 51061,''Payment schema missing/drifted. Required marker 2; review docs/database/PAYMENT_SCHEMA_AUTHORITY.md and its matching SQL path. Startup will not create or repair payment schema.'',1;';

-- Exact PaymentSchemaGate SQL, isolated local-variable scope.
EXEC sys.sp_executesql N'DECLARE @Columns TABLE(TableName sysname,Name sysname,TypeId int,Length int,Nullable bit);
INSERT @Columns VALUES
    (N''Payments'',N''RowVersion'',189,8,0),(N''Bookings'',N''RowVersion'',189,8,0),(N''Bookings'',N''SelectedPaymentId'',56,4,1),
    (N''Payments'',N''InitiationFingerprint'',231,128,1),(N''Payments'',N''InitiationState'',231,40,1),
    (N''Payments'',N''InitiationDispatchedAt'',42,8,1),(N''Payments'',N''InitiationMerchantId'',231,200,1),
    (N''Payments'',N''InitiationEnvironment'',231,20,1),(N''Payments'',N''ProviderSessionKey'',231,200,1),
    (N''Payments'',N''ProviderGatewayUrl'',231,4096,1),(N''Payments'',N''VerifiedMerchantId'',231,200,1),
    (N''Payments'',N''VerifiedEnvironment'',231,20,1),(N''Payments'',N''VerifiedTransactionId'',231,200,1),
    (N''Payments'',N''RequiresReview'',104,1,0);
DECLARE @Indexes TABLE(Name sysname,Keys nvarchar(300),ConstraintIndex bit,Filter nvarchar(200));
INSERT @Indexes VALUES
    (N''UQ_Payments_Id_BookingId'',N''Id,BookingId'',1,NULL),
    (N''UX_Payment_InitiationIntent'',N''BookingId'',0,N''[InitiationFingerprint] IS NOT NULL''),
    (N''UX_Payment_VerifiedIdentity'',N''VerifiedMerchantId,VerifiedEnvironment,VerifiedTransactionId'',0,N''[VerifiedTransactionId] IS NOT NULL'');
IF EXISTS(SELECT 1 FROM @Columns e LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N''dbo.''+e.TableName) AND c.name=e.Name
    WHERE c.column_id IS NULL OR c.system_type_id<>e.TypeId OR c.max_length<>e.Length OR c.is_nullable<>e.Nullable
        OR (e.TypeId=42 AND (c.precision<>27 OR c.scale<>7)))
    OR EXISTS(SELECT 1 FROM @Indexes e LEFT JOIN sys.indexes i ON i.object_id=OBJECT_ID(N''dbo.Payments'') AND i.name=e.Name
        OUTER APPLY(SELECT STRING_AGG(CONVERT(nvarchar(max),c.name),N'','') WITHIN GROUP(ORDER BY ic.key_ordinal) AS Keys
            FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
            WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0) k
        WHERE k.Keys IS NULL OR k.Keys<>e.Keys OR i.is_unique<>1 OR i.is_unique_constraint<>e.ConstraintIndex OR i.is_disabled=1
            OR ISNULL(REPLACE(REPLACE(i.filter_definition,N''('',N''''),N'')'',N''''),N'''')<>ISNULL(e.Filter,N''''))
    OR NOT EXISTS(SELECT 1 FROM sys.foreign_keys f WHERE f.name=N''FK_PaymentAllocation_Booking''
        AND f.parent_object_id=OBJECT_ID(N''dbo.Bookings'') AND f.referenced_object_id=OBJECT_ID(N''dbo.Payments'')
        AND f.is_disabled=0 AND f.is_not_trusted=0 AND f.delete_referential_action=0
        AND (SELECT COUNT(*) FROM sys.foreign_key_columns WHERE constraint_object_id=f.object_id)=2
        AND EXISTS(SELECT 1 FROM sys.foreign_key_columns c WHERE c.constraint_object_id=f.object_id
            AND COL_NAME(c.parent_object_id,c.parent_column_id)=N''SelectedPaymentId'' AND COL_NAME(c.referenced_object_id,c.referenced_column_id)=N''Id'')
        AND EXISTS(SELECT 1 FROM sys.foreign_key_columns c WHERE c.constraint_object_id=f.object_id
            AND COL_NAME(c.parent_object_id,c.parent_column_id)=N''Id'' AND COL_NAME(c.referenced_object_id,c.referenced_column_id)=N''BookingId''))
    OR NOT EXISTS(SELECT 1 FROM sys.default_constraints WHERE parent_object_id=OBJECT_ID(N''dbo.Payments'') AND name=N''DF_Payments_RequiresReview'' AND REPLACE(REPLACE(definition,N''('',N''''),N'')'',N'''')=N''0'')
    OR (SELECT COUNT(*) FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N''dbo.Payments'') AND name IN(N''CK_Payment_Initiation'',N''CK_Payment_Verified'') AND is_disabled=0 AND is_not_trusted=0)<>2
    OR NOT EXISTS(SELECT 1 FROM sys.triggers WHERE name=N''TR_Payment_Facts_Immutable'' AND parent_id=OBJECT_ID(N''dbo.Payments'') AND is_disabled=0)
    OR NOT EXISTS(SELECT 1 FROM sys.triggers WHERE name=N''TR_Booking_PaymentAllocation'' AND parent_id=OBJECT_ID(N''dbo.Bookings'') AND is_disabled=0)
    THROW 51071,''Payment concurrency schema missing/drifted. Review and explicitly apply database/production/007_payment_concurrency.sql; startup does not repair it.'',1;';

-- Exact RefreshSessionSchemaGate SQL, isolated local-variable scope.
EXEC sys.sp_executesql N'DECLARE @Indexes TABLE(Name sysname, Keys nvarchar(100), Filter nvarchar(150));
INSERT @Indexes VALUES
    (N''UX_F6_TokenHash'',N''TokenHash'',NULL),
    (N''UX_F6_Parent'',N''ParentTokenId'',N''[ParentTokenId]ISNOTNULL''),
    (N''UX_F6_ActiveToken'',N''SessionId'',N''[SessionId]ISNOTNULLAND[RevokedAt]ISNULL'');
IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N''dbo.RefreshSessions'')
    AND name=N''KarigorF6Version'' AND TRY_CAST(value AS int)=1)
    OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N''dbo.RefreshTokens'') AND name=N''TokenHash'' AND max_length=128)
    OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N''dbo.RefreshTokens'') AND name=N''RowVersion'' AND system_type_id=189)
    OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N''dbo.RefreshSessions'') AND name=N''RowVersion'' AND system_type_id=189)
    OR (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID(N''dbo.RefreshTokens'')
        AND name IN(N''UX_F6_TokenHash'',N''UX_F6_Parent'',N''UX_F6_ActiveToken'') AND is_unique=1 AND is_disabled=0)<>3
    OR (SELECT COUNT(*) FROM sys.foreign_keys WHERE name IN(N''FK_F6_Session_User'',N''FK_F6_Token_Session'',N''FK_F6_Token_Parent'')
        AND is_disabled=0 AND is_not_trusted=0)<>3
    OR (SELECT COUNT(*) FROM sys.check_constraints WHERE name IN(N''CK_F6_Legacy_Revoked'',N''CK_F6_Hash'',N''CK_F6_Parent'',N''CK_F6_Session_Lifetime'',N''CK_F6_Session_Revocation'')
        AND is_disabled=0 AND is_not_trusted=0)<>5
    OR EXISTS(SELECT 1 FROM @Indexes e LEFT JOIN sys.indexes i ON i.object_id=OBJECT_ID(N''dbo.RefreshTokens'') AND i.name=e.Name
        OUTER APPLY(SELECT STRING_AGG(CONVERT(nvarchar(max),c.name),N'','') WITHIN GROUP(ORDER BY ic.key_ordinal) AS Keys
            FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
            WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0) k
        WHERE k.Keys IS NULL OR k.Keys<>e.Keys OR EXISTS(
            SELECT REPLACE(REPLACE(REPLACE(i.filter_definition,N''('',N''''),N'')'',N''''),N'' '',N'''') EXCEPT SELECT e.Filter))
    THROW 51065,''F6 schema missing/incomplete. Apply database/production/008_refresh_session_authority.sql during an authorized writer outage and forced sign-in reset.'',1;';

SELECT N'PASS: current F5/Payment v2/F6 runtime metadata gates' AS SchemaGateResult;
