-- Supplemental Phase 1 inventory. NEVER applies upgrades or repairs data.
-- Select the target in the SQL client and replace ONLY the database placeholder.
-- Run with SELECT + VIEW DEFINITION permissions, no data/schema write permission.
-- Reports identifiers/counts only; no hashes, tokens, credentials or file bytes.
-- Also run the applicable canonical 005/006/007/008 default preflights as documented.
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

-- 1. Identity of the selected database and schema evidence (no connection string).
SELECT DB_NAME() AS DatabaseName,SYSUTCDATETIME() AS CapturedUtc,
 CONVERT(nvarchar(128),SERVERPROPERTY('ProductVersion')) AS SqlProductVersion,
 CONVERT(nvarchar(128),SERVERPROPERTY('Edition')) AS SqlEdition,
 d.compatibility_level,d.collation_name,d.is_read_only FROM sys.databases d WHERE d.name=DB_NAME();
SELECT SESSIONPROPERTY(N'QUOTED_IDENTIFIER') AS QuotedIdentifier,SESSIONPROPERTY(N'ANSI_NULLS') AS AnsiNulls,
 SESSIONPROPERTY(N'ANSI_PADDING') AS AnsiPadding,SESSIONPROPERTY(N'ANSI_WARNINGS') AS AnsiWarnings,
 SESSIONPROPERTY(N'ARITHABORT') AS ArithAbort,SESSIONPROPERTY(N'CONCAT_NULL_YIELDS_NULL') AS ConcatNullYieldsNull,
 SESSIONPROPERTY(N'NUMERIC_ROUNDABORT') AS NumericRoundAbort;
SELECT expected.TableName,CASE WHEN t.object_id IS NULL THEN N'MISSING' ELSE N'PRESENT' END AS TableState
FROM (VALUES(N'AspNetUsers'),(N'AspNetRoles'),(N'AspNetUserRoles'),(N'CustomerProfiles'),
 (N'WorkerProfiles'),(N'WorkerDocuments'),(N'ServiceRequests'),(N'Quotations'),(N'Bookings'),
 (N'Payments'),(N'RefreshTokens'),(N'RefreshSessions')) expected(TableName)
LEFT JOIN sys.tables t ON t.schema_id=SCHEMA_ID(N'dbo') AND t.name=expected.TableName;
SELECT OBJECT_SCHEMA_NAME(e.major_id) AS SchemaName,OBJECT_NAME(e.major_id) AS TableName,
 e.name AS Marker,CONVERT(nvarchar(128),e.value) AS MarkerValue
FROM sys.extended_properties e WHERE e.class=1 AND e.minor_id=0
 AND e.name IN(N'KarigorF5Version',N'KarigorPaymentSchemaVersion',N'KarigorF6Version');
SELECT t.name AS TableName,c.name AS ColumnName,ty.name AS SqlType,c.max_length,c.precision,c.scale,
 c.is_nullable,c.is_identity FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.schema_id=SCHEMA_ID(N'dbo') AND t.name IN(N'Quotations',N'ServiceRequests',N'Bookings',N'Payments',N'RefreshTokens',N'RefreshSessions',N'WorkerDocuments')
ORDER BY t.name,c.column_id;
SELECT OBJECT_NAME(i.object_id) AS TableName,i.name,i.is_unique,i.is_disabled,i.filter_definition,
 c.name AS KeyColumn,ic.key_ordinal FROM sys.indexes i
JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0
JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE OBJECT_NAME(i.object_id) IN(N'Quotations',N'Bookings',N'Payments',N'RefreshTokens',N'RefreshSessions')
ORDER BY TableName,i.name,ic.key_ordinal;
SELECT OBJECT_NAME(f.parent_object_id) AS TableName,f.name,f.is_disabled,f.is_not_trusted,
 OBJECT_NAME(f.referenced_object_id) AS ReferencedTable,f.delete_referential_action_desc,
 COL_NAME(fc.parent_object_id,fc.parent_column_id) AS ParentColumn,
 COL_NAME(fc.referenced_object_id,fc.referenced_column_id) AS ReferencedColumn
FROM sys.foreign_keys f JOIN sys.foreign_key_columns fc ON fc.constraint_object_id=f.object_id
WHERE OBJECT_NAME(f.parent_object_id) IN(N'Quotations',N'Bookings',N'Payments',N'RefreshTokens',N'RefreshSessions');
SELECT OBJECT_NAME(parent_object_id) AS TableName,name,is_disabled,is_not_trusted,definition
FROM sys.check_constraints WHERE OBJECT_NAME(parent_object_id) IN(N'Quotations',N'Payments',N'RefreshTokens',N'RefreshSessions');
SELECT OBJECT_NAME(parent_id) AS TableName,name,is_disabled FROM sys.triggers
WHERE OBJECT_NAME(parent_id) IN(N'Quotations',N'Bookings',N'Payments');
SELECT N'INFO' AS Severity,N'ef-history-present-not-authority' AS Issue
WHERE OBJECT_ID(N'dbo.__EFMigrationsHistory',N'U') IS NOT NULL;

-- 2. Negotiation structure. Missing/unsupported column shape is a blocker, not a clean report.
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Quotations')
 AND name IN(N'Id',N'ServiceRequestId',N'WorkerId',N'Status',N'ParentQuotationId'))=5
 AND (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.ServiceRequests') AND name IN(N'Id',N'CustomerId',N'Status'))=3
 AND (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Bookings') AND name IN(N'Id',N'ServiceRequestId'))=2
 AND (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.WorkerProfiles') AND name IN(N'Id',N'UserId'))=2
 AND (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.CustomerProfiles') AND name IN(N'Id',N'UserId'))=2
BEGIN
 EXEC(N'
 SELECT N''REVIEW'' AS Severity,N''duplicate-bookings'' AS Issue,ServiceRequestId AS EntityId FROM dbo.Bookings GROUP BY ServiceRequestId HAVING COUNT(*)>1
 UNION ALL SELECT N''REVIEW'',N''multiple-pending-heads'',MIN(Id) FROM dbo.Quotations WHERE Status=N''Pending'' GROUP BY ServiceRequestId,WorkerId HAVING COUNT(*)>1
 UNION ALL SELECT N''REVIEW'',N''multiple-roots'',MIN(Id) FROM dbo.Quotations WHERE ParentQuotationId IS NULL GROUP BY ServiceRequestId,WorkerId HAVING COUNT(*)>1
 UNION ALL SELECT N''REVIEW'',N''forked-parent'',ParentQuotationId FROM dbo.Quotations WHERE ParentQuotationId IS NOT NULL GROUP BY ParentQuotationId HAVING COUNT(*)>1
 UNION ALL SELECT N''REVIEW'',N''invalid-parent'',q.Id FROM dbo.Quotations q LEFT JOIN dbo.Quotations p ON p.Id=q.ParentQuotationId WHERE q.ParentQuotationId IS NOT NULL AND (p.Id IS NULL OR p.Id>=q.Id)
 UNION ALL SELECT N''REVIEW'',N''cross-request-parent'',q.Id FROM dbo.Quotations q JOIN dbo.Quotations p ON p.Id=q.ParentQuotationId WHERE p.ServiceRequestId<>q.ServiceRequestId
 UNION ALL SELECT N''REVIEW'',N''cross-worker-parent'',q.Id FROM dbo.Quotations q JOIN dbo.Quotations p ON p.Id=q.ParentQuotationId WHERE p.WorkerId<>q.WorkerId
 UNION ALL SELECT N''REVIEW'',N''invalid-status'',Id FROM dbo.Quotations WHERE Status IS NULL OR Status COLLATE Latin1_General_100_BIN2 NOT IN(N''Pending'',N''Countered'',N''Accepted'',N''Rejected'') OR DATALENGTH(Status)<>DATALENGTH(LTRIM(RTRIM(Status)))
 UNION ALL SELECT N''REVIEW'',N''pending-has-child'',q.Id FROM dbo.Quotations q WHERE q.Status=N''Pending'' AND EXISTS(SELECT 1 FROM dbo.Quotations c WHERE c.ParentQuotationId=q.Id)
 UNION ALL SELECT N''REVIEW'',N''countered-without-child'',q.Id FROM dbo.Quotations q WHERE q.Status=N''Countered'' AND NOT EXISTS(SELECT 1 FROM dbo.Quotations c WHERE c.ParentQuotationId=q.Id)
 UNION ALL SELECT N''REVIEW'',N''pending-on-closed-or-booked-request'',q.Id FROM dbo.Quotations q JOIN dbo.ServiceRequests r ON r.Id=q.ServiceRequestId WHERE q.Status=N''Pending'' AND (r.Status<>N''Open'' OR EXISTS(SELECT 1 FROM dbo.Bookings b WHERE b.ServiceRequestId=r.Id))
 UNION ALL SELECT N''REVIEW'',N''missing-request-worker-customer'',q.Id FROM dbo.Quotations q LEFT JOIN dbo.ServiceRequests r ON r.Id=q.ServiceRequestId LEFT JOIN dbo.WorkerProfiles w ON w.Id=q.WorkerId LEFT JOIN dbo.CustomerProfiles c ON c.Id=r.CustomerId WHERE r.Id IS NULL OR w.Id IS NULL OR c.Id IS NULL;
 ;WITH Walk AS (
 SELECT Id AS StartId,Id,ParentQuotationId,CAST(''/''+CAST(Id AS varchar(12))+''/'' AS varchar(max)) AS Path,0 AS Cycle FROM dbo.Quotations
 UNION ALL SELECT w.StartId,p.Id,p.ParentQuotationId,CAST(w.Path+CAST(p.Id AS varchar(12))+''/'' AS varchar(max)),
 CASE WHEN CHARINDEX(''/''+CAST(p.Id AS varchar(12))+''/'',w.Path)>0 THEN 1 ELSE 0 END
 FROM Walk w JOIN dbo.Quotations p ON p.Id=w.ParentQuotationId WHERE w.Cycle=0)
 SELECT DISTINCT N''REVIEW'' AS Severity,N''cycle'' AS Issue,StartId AS EntityId FROM Walk WHERE Cycle=1 OPTION(MAXRECURSION 256);');
 IF COL_LENGTH(N'dbo.Quotations',N'ProposedByUserId') IS NULL
  EXEC(N'SELECT N''REVIEW'' AS Severity,N''active-authorship-unknown'' AS Issue,Id AS EntityId FROM dbo.Quotations WHERE Status=N''Pending'';');
 ELSE
  EXEC(N'SELECT N''REVIEW'' AS Severity,N''unknown-or-nonparticipant-author'' AS Issue,q.Id AS EntityId FROM dbo.Quotations q
   JOIN dbo.ServiceRequests r ON r.Id=q.ServiceRequestId JOIN dbo.CustomerProfiles c ON c.Id=r.CustomerId JOIN dbo.WorkerProfiles w ON w.Id=q.WorkerId
   WHERE (q.Status=N''Pending'' AND q.ProposedByUserId IS NULL) OR (q.ProposedByUserId IS NOT NULL AND q.ProposedByUserId<>c.UserId AND q.ProposedByUserId<>w.UserId);
   SELECT N''REVIEW'' AS Severity,N''same-author-parent-child'' AS Issue,q.Id AS EntityId FROM dbo.Quotations q JOIN dbo.Quotations p ON p.Id=q.ParentQuotationId
   WHERE q.ProposedByUserId IS NOT NULL AND p.ProposedByUserId IS NOT NULL AND q.ProposedByUserId=p.ProposedByUserId;');
END
ELSE SELECT N'BLOCKER' AS Severity,N'unsupported-negotiation-shape' AS Issue;

-- 3. Payment existence, unknown history and common financial checks on v0/v1/v2.
IF OBJECT_ID(N'dbo.Bookings',N'U') IS NOT NULL
BEGIN
 IF COL_LENGTH(N'dbo.Bookings',N'PaymentStatus') IS NULL
  EXEC(N'SELECT N''REVIEW'' AS Severity,N''unknown-booking-payment-history'' AS Issue,Id AS EntityId FROM dbo.Bookings;');
 ELSE
  EXEC(N'SELECT N''REVIEW'' AS Severity,N''suspicious-booking-payment-status'' AS Issue,Id AS EntityId FROM dbo.Bookings
   WHERE PaymentStatus IS NULL OR PaymentStatus COLLATE Latin1_General_100_BIN2 NOT IN(N''Unpaid'',N''Paid'') OR DATALENGTH(PaymentStatus)<>DATALENGTH(LTRIM(RTRIM(PaymentStatus)));');
END;
IF OBJECT_ID(N'dbo.Payments',N'U') IS NULL
BEGIN
 SELECT N'INFO' AS Severity,N'payments-table-missing' AS Issue;
 IF COL_LENGTH(N'dbo.Bookings',N'PaymentStatus') IS NOT NULL
  EXEC(N'SELECT N''REVIEW'' AS Severity,N''paid-booking-without-payment-table'' AS Issue,Id AS EntityId FROM dbo.Bookings WHERE PaymentStatus=N''Paid'';');
END
ELSE IF (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Payments') AND name IN(N'Id',N'BookingId',N'TransactionId',N'Status',N'Currency',N'TotalAmount',N'PlatformFee',N'WorkerAmount',N'CreatedAt',N'PaidAt',N'ValId',N'BankTranId'))=12
 AND COL_LENGTH(N'dbo.Bookings',N'AgreedPrice') IS NOT NULL
BEGIN
 EXEC(N'
 SELECT N''REVIEW'' AS Severity,N''duplicate-transaction-id'' AS Issue,MIN(Id) AS EntityId FROM dbo.Payments GROUP BY TransactionId HAVING COUNT(*)>1
 UNION ALL SELECT N''REVIEW'',N''malformed-transaction-id'',Id FROM dbo.Payments WHERE TransactionId IS NULL OR LEN(LTRIM(RTRIM(TransactionId)))=0 OR DATALENGTH(TransactionId)<>DATALENGTH(LTRIM(RTRIM(TransactionId))) OR TransactionId LIKE N''%''+NCHAR(9)+N''%'' OR TransactionId LIKE N''%''+NCHAR(10)+N''%'' OR TransactionId LIKE N''%''+NCHAR(13)+N''%''
 UNION ALL SELECT N''REVIEW'',N''multiple-successful-settlements'',BookingId FROM dbo.Payments WHERE Status=N''Completed'' GROUP BY BookingId HAVING COUNT(*)>1
 UNION ALL SELECT N''REVIEW'',N''invalid-payment-amount'',Id FROM dbo.Payments WHERE TotalAmount IS NULL OR TotalAmount<=0 OR PlatformFee IS NULL OR PlatformFee<0 OR WorkerAmount IS NULL OR WorkerAmount<0
 UNION ALL SELECT N''REVIEW'',N''invalid-currency'',Id FROM dbo.Payments WHERE Currency IS NULL OR Currency COLLATE Latin1_General_100_BIN2<>N''BDT'' OR DATALENGTH(Currency)<>6
 UNION ALL SELECT N''REVIEW'',N''orphan-payment'',p.Id FROM dbo.Payments p LEFT JOIN dbo.Bookings b ON b.Id=p.BookingId WHERE b.Id IS NULL
 UNION ALL SELECT N''REVIEW'',N''suspicious-payment-status'',Id FROM dbo.Payments WHERE Status IS NULL OR Status COLLATE Latin1_General_100_BIN2 NOT IN(N''Initiated'',N''Completed'',N''Failed'',N''Cancelled'') OR DATALENGTH(Status)<>DATALENGTH(LTRIM(RTRIM(Status)))
 UNION ALL SELECT N''REVIEW'',N''incomplete-completed-receipt'',Id FROM dbo.Payments WHERE Status=N''Completed'' AND (PaidAt IS NULL OR NULLIF(LTRIM(RTRIM(ValId)),N'''') IS NULL)
 UNION ALL SELECT N''REVIEW'',N''missing-creation-time'',Id FROM dbo.Payments WHERE CreatedAt IS NULL
 UNION ALL SELECT N''REVIEW'',N''booking-amount-mismatch'',p.Id FROM dbo.Payments p JOIN dbo.Bookings b ON b.Id=p.BookingId WHERE p.TotalAmount<>b.AgreedPrice;
 SELECT N''REVIEW'' AS Severity,N''apparent-duplicate-validation-id'' AS Issue,MIN(Id) AS EntityId FROM dbo.Payments WHERE NULLIF(LTRIM(RTRIM(ValId)),N'''') IS NOT NULL GROUP BY ValId COLLATE Latin1_General_100_BIN2,DATALENGTH(ValId) HAVING COUNT(*)>1;
 SELECT N''REVIEW'' AS Severity,N''apparent-duplicate-bank-id'' AS Issue,MIN(Id) AS EntityId FROM dbo.Payments WHERE NULLIF(LTRIM(RTRIM(BankTranId)),N'''') IS NOT NULL GROUP BY BankTranId COLLATE Latin1_General_100_BIN2,DATALENGTH(BankTranId) HAVING COUNT(*)>1;');
 IF COL_LENGTH(N'dbo.Payments',N'ServiceCharge') IS NULL
  EXEC(N'SELECT N''REVIEW'' AS Severity,N''unknown-servicecharge-history'' AS Issue,Id AS EntityId FROM dbo.Payments;');
 ELSE EXEC(N'SELECT N''REVIEW'' AS Severity,N''invalid-fee-breakdown'' AS Issue,Id AS EntityId FROM dbo.Payments WHERE ServiceCharge IS NULL OR ServiceCharge<0 OR TotalAmount<>PlatformFee+ServiceCharge+WorkerAmount;');
 IF COL_LENGTH(N'dbo.Bookings',N'PaymentStatus') IS NOT NULL
  EXEC(N'SELECT N''REVIEW'' AS Severity,N''paid-without-success'' AS Issue,b.Id AS EntityId FROM dbo.Bookings b WHERE b.PaymentStatus=N''Paid'' AND NOT EXISTS(SELECT 1 FROM dbo.Payments p WHERE p.BookingId=b.Id AND p.Status=N''Completed'');
   SELECT N''REVIEW'' AS Severity,N''success-without-paid-booking'' AS Issue,p.Id AS EntityId FROM dbo.Payments p JOIN dbo.Bookings b ON b.Id=p.BookingId WHERE p.Status=N''Completed'' AND (b.PaymentStatus IS NULL OR b.PaymentStatus<>N''Paid'');');
 IF COL_LENGTH(N'dbo.Bookings',N'SelectedPaymentId') IS NOT NULL AND COL_LENGTH(N'dbo.Payments',N'RequiresReview') IS NOT NULL
 AND COL_LENGTH(N'dbo.Payments',N'VerifiedTransactionId') IS NOT NULL AND COL_LENGTH(N'dbo.Payments',N'VerifiedMerchantId') IS NOT NULL AND COL_LENGTH(N'dbo.Payments',N'VerifiedEnvironment') IS NOT NULL
 BEGIN
  EXEC(N'SELECT N''REVIEW'' AS Severity,N''invalid-selected-allocation'' AS Issue,b.Id AS EntityId FROM dbo.Bookings b LEFT JOIN dbo.Payments p ON p.Id=b.SelectedPaymentId AND p.BookingId=b.Id WHERE (b.PaymentStatus=N''Paid'' AND b.SelectedPaymentId IS NULL) OR (b.SelectedPaymentId IS NOT NULL AND (p.Id IS NULL OR p.Status<>N''Completed'' OR p.RequiresReview<>0 OR b.PaymentStatus<>N''Paid''));
   SELECT N''REVIEW'' AS Severity,N''extra-success-needs-reconciliation'' AS Issue,p.Id AS EntityId FROM dbo.Payments p JOIN dbo.Bookings b ON b.Id=p.BookingId WHERE p.Status=N''Completed'' AND (b.SelectedPaymentId IS NULL OR p.Id<>b.SelectedPaymentId);
   SELECT N''REVIEW'' AS Severity,N''completed-without-bound-provider-facts'' AS Issue,Id AS EntityId FROM dbo.Payments WHERE Status=N''Completed'' AND (VerifiedTransactionId IS NULL OR VerifiedTransactionId<>TransactionId OR NULLIF(LTRIM(RTRIM(VerifiedMerchantId)),N'''') IS NULL OR VerifiedEnvironment IS NULL OR VerifiedEnvironment NOT IN(N''Sandbox'',N''Live''));');
 END;
 IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.Payments') AND minor_id=0 AND name=N'KarigorPaymentSchemaVersion' AND TRY_CAST(value AS int)=2)
  EXEC(N'SELECT N''REVIEW'' AS Severity,N''007-refuses-every-legacy-attempt'' AS Issue,Id AS EntityId FROM dbo.Payments;');
END
ELSE SELECT N'BLOCKER' AS Severity,N'unsupported-payment-shape' AS Issue;

-- 4. Refresh: aggregate legacy history only. NEVER output token hash values.
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.RefreshTokens') AND name IN(N'Id',N'TokenHash',N'UserId',N'ExpiresAt',N'RevokedAt',N'ReplacedByToken'))=6
BEGIN
 EXEC(N'SELECT COUNT_BIG(*) AS TokenRows,SUM(CONVERT(bigint,CASE WHEN RevokedAt IS NULL THEN 1 ELSE 0 END)) AS UnretiredRows FROM dbo.RefreshTokens;
  SELECT N''REVIEW'' AS Severity,N''malformed-legacy-hash'' AS Issue,Id AS EntityId FROM dbo.RefreshTokens WHERE TokenHash IS NULL OR LEN(TokenHash)<>64 OR DATALENGTH(TokenHash)<>128 OR TokenHash COLLATE Latin1_General_100_BIN2 LIKE N''%[^0-9a-f]%'' OR (ReplacedByToken IS NOT NULL AND (LEN(ReplacedByToken)<>64 OR DATALENGTH(ReplacedByToken)<>128 OR ReplacedByToken COLLATE Latin1_General_100_BIN2 LIKE N''%[^0-9a-f]%''));
  SELECT N''REVIEW'' AS Severity,N''duplicate-token-hash'' AS Issue,MIN(Id) AS EntityId FROM dbo.RefreshTokens GROUP BY TokenHash HAVING COUNT(*)>1;');
 IF COL_LENGTH(N'dbo.RefreshTokens',N'SessionId') IS NULL
  SELECT N'INFO' AS Severity,N'forced-sign-in-reset-required-no-legacy-family-migration' AS Issue;
 ELSE
  EXEC(N'SELECT COUNT_BIG(*) AS RetainedLegacyRows FROM dbo.RefreshTokens WHERE SessionId IS NULL;
   SELECT N''BLOCKER'' AS Severity,N''unretired-null-family-token'' AS Issue,Id AS EntityId FROM dbo.RefreshTokens WHERE SessionId IS NULL AND RevokedAt IS NULL;');
END
ELSE SELECT N'BLOCKER' AS Severity,N'unsupported-refresh-token-shape' AS Issue;
IF OBJECT_ID(N'dbo.RefreshSessions',N'U') IS NOT NULL
 AND (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.RefreshSessions') AND name IN(N'Id',N'UserId',N'ExpiresAt',N'RevokedAt'))=4
 EXEC(N'SELECT COUNT_BIG(*) AS SessionRows,SUM(CONVERT(bigint,CASE WHEN RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME() THEN 1 ELSE 0 END)) AS UnexpiredUnrevokedSessions FROM dbo.RefreshSessions;');

-- 5. Documents: FileUrl is an authorized ROUTE, not proof of physical storage.
IF (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.WorkerDocuments') AND name IN(N'Id',N'WorkerId',N'FileUrl'))=3
 AND OBJECT_ID(N'dbo.WorkerProfiles',N'U') IS NOT NULL
 EXEC(N'SELECT N''REVIEW'' AS Severity,N''orphan-document-worker'' AS Issue,d.Id AS EntityId FROM dbo.WorkerDocuments d LEFT JOIN dbo.WorkerProfiles w ON w.Id=d.WorkerId WHERE w.Id IS NULL;
  SELECT N''REVIEW'' AS Severity,N''legacy-or-unsupported-document-url'' AS Issue,Id AS EntityId FROM dbo.WorkerDocuments WHERE FileUrl IS NULL OR FileUrl NOT LIKE N''/uploads/worker-documents/%'' OR FileUrl LIKE N''%..%'' OR FileUrl LIKE N''%?%'' OR FileUrl LIKE N''%#%'' OR FileUrl LIKE N''%://%'';
  SELECT COUNT_BIG(*) AS MetadataRowsNeedingPrivateDiskInventory FROM dbo.WorkerDocuments;
  SELECT N''REVIEW'' AS Severity,N''duplicate-document-url'' AS Issue,MIN(Id) AS EntityId FROM dbo.WorkerDocuments GROUP BY FileUrl HAVING COUNT(*)>1;');
ELSE SELECT N'BLOCKER' AS Severity,N'unsupported-document-metadata-shape' AS Issue;

-- 6. Roles/admin identities. No PasswordHash/SecurityStamp/credential columns read.
IF OBJECT_ID(N'dbo.AspNetUsers',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.AspNetRoles',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.AspNetUserRoles',N'U') IS NOT NULL
 EXEC(N'SELECT r.Name AS RoleName,COUNT(ur.UserId) AS AssignedUsers FROM dbo.AspNetRoles r LEFT JOIN dbo.AspNetUserRoles ur ON ur.RoleId=r.Id GROUP BY r.Id,r.Name;
  SELECT u.Id AS UserId,u.LockoutEnd,CASE WHEN u.NormalizedEmail=N''ADMIN@KARIGOR.COM'' THEN 1 ELSE 0 END AS MatchesHistoricalBootstrapEmail
  FROM dbo.AspNetUsers u JOIN dbo.AspNetUserRoles ur ON ur.UserId=u.Id JOIN dbo.AspNetRoles r ON r.Id=ur.RoleId WHERE r.NormalizedName=N''ADMIN'';
  SELECT u.Id AS UserId,N''REVIEW'' AS Severity,N''historical-bootstrap-email-present-password-exposure-unknown'' AS Issue FROM dbo.AspNetUsers u WHERE u.NormalizedEmail=N''ADMIN@KARIGOR.COM'';');
ELSE SELECT N'BLOCKER' AS Severity,N'identity-tables-missing' AS Issue;

SELECT N'NOT AN AUTOMATIC GO: review every result set, canonical preflight, metadata gate and operational prerequisite.' AS NextStep;
-- Timeout, recursion limit, permission error or SQL exception => INCOMPLETE => NO-GO.
-- Query results do not certify filesystem state, external gateway history or writer exclusion.
