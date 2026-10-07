-- F5's only schema authority. Default: read-only preflight.
-- Apply only during a writer outage, in an operator-selected database:
-- EXEC sys.sp_set_session_context @key=N'KarigorF5Apply', @value=1;
-- Then execute this entire file on that SAME connection. No USE/database targeting.
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Apply bit = ISNULL(TRY_CAST(SESSION_CONTEXT(N'KarigorF5Apply') AS bit), 0);
DECLARE @Installed bit = CASE WHEN EXISTS (
    SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.Quotations')
        AND minor_id=0 AND name=N'KarigorF5Version' AND TRY_CAST(value AS int)=1
) THEN 1 ELSE 0 END;

BEGIN TRY
    IF @Apply=1
    BEGIN
        BEGIN TRANSACTION;
        -- Prevent a write between preflight and installing constraints.
        DECLARE @Lock bigint;
        SELECT @Lock=COUNT_BIG(*) FROM dbo.ServiceRequests WITH (TABLOCKX,HOLDLOCK);
        SELECT @Lock=COUNT_BIG(*) FROM dbo.Quotations WITH (TABLOCKX,HOLDLOCK);
        SELECT @Lock=COUNT_BIG(*) FROM dbo.Bookings WITH (TABLOCKX,HOLDLOCK);
    END;
    DROP TABLE IF EXISTS #Issues;
    CREATE TABLE #Issues (Issue nvarchar(80) NOT NULL, EntityId int NOT NULL);
    INSERT #Issues SELECT N'duplicate-bookings',ServiceRequestId FROM dbo.Bookings
        GROUP BY ServiceRequestId HAVING COUNT(*)>1;
    INSERT #Issues SELECT N'multiple-pending-heads',MIN(Id) FROM dbo.Quotations
        WHERE Status=N'Pending' GROUP BY ServiceRequestId,WorkerId HAVING COUNT(*)>1;
    INSERT #Issues SELECT N'linear-chain-fork',ParentQuotationId FROM dbo.Quotations
        WHERE ParentQuotationId IS NOT NULL GROUP BY ParentQuotationId HAVING COUNT(*)>1;
    INSERT #Issues SELECT N'multiple-roots',MIN(Id) FROM dbo.Quotations
        WHERE ParentQuotationId IS NULL GROUP BY ServiceRequestId,WorkerId HAVING COUNT(*)>1;
    INSERT #Issues SELECT N'missing-parent',q.Id FROM dbo.Quotations q
        LEFT JOIN dbo.Quotations p ON p.Id=q.ParentQuotationId WHERE q.ParentQuotationId IS NOT NULL AND p.Id IS NULL;
    INSERT #Issues SELECT N'cross-request-parent',q.Id FROM dbo.Quotations q
        JOIN dbo.Quotations p ON p.Id=q.ParentQuotationId WHERE q.ServiceRequestId<>p.ServiceRequestId;
    INSERT #Issues SELECT N'cross-worker-parent',q.Id FROM dbo.Quotations q
        JOIN dbo.Quotations p ON p.Id=q.ParentQuotationId WHERE q.WorkerId<>p.WorkerId;
    INSERT #Issues SELECT N'invalid-quotation-status',Id FROM dbo.Quotations
        WHERE Status NOT IN (N'Pending',N'Countered',N'Accepted',N'Rejected') OR Status IS NULL;
    INSERT #Issues SELECT N'pending-has-child',q.Id FROM dbo.Quotations q
        WHERE q.Status=N'Pending' AND EXISTS(SELECT 1 FROM dbo.Quotations c WHERE c.ParentQuotationId=q.Id);
    INSERT #Issues SELECT N'countered-without-child',q.Id FROM dbo.Quotations q
        WHERE q.Status=N'Countered' AND NOT EXISTS(SELECT 1 FROM dbo.Quotations c WHERE c.ParentQuotationId=q.Id);
    INSERT #Issues SELECT N'pending-on-closed-request',q.Id FROM dbo.Quotations q
        JOIN dbo.ServiceRequests r ON r.Id=q.ServiceRequestId WHERE q.Status=N'Pending' AND r.Status<>N'Open';
    INSERT #Issues SELECT N'pending-with-booking',q.Id FROM dbo.Quotations q
        WHERE q.Status=N'Pending' AND EXISTS(SELECT 1 FROM dbo.Bookings b WHERE b.ServiceRequestId=q.ServiceRequestId);
    INSERT #Issues SELECT N'missing-request-or-worker',q.Id FROM dbo.Quotations q
        LEFT JOIN dbo.ServiceRequests r ON r.Id=q.ServiceRequestId LEFT JOIN dbo.WorkerProfiles w ON w.Id=q.WorkerId
        WHERE r.Id IS NULL OR w.Id IS NULL;
    ;WITH Walk AS (
        SELECT Id AS StartId,Id,ParentQuotationId,CAST('/'+CAST(Id AS varchar(12))+'/' AS varchar(max)) AS Path,0 AS Cycle
        FROM dbo.Quotations
        UNION ALL
        SELECT w.StartId,p.Id,p.ParentQuotationId,CAST(w.Path+CAST(p.Id AS varchar(12))+'/' AS varchar(max)),
            CASE WHEN CHARINDEX('/'+CAST(p.Id AS varchar(12))+'/',w.Path)>0 THEN 1 ELSE 0 END
        FROM Walk w JOIN dbo.Quotations p ON p.Id=w.ParentQuotationId WHERE w.Cycle=0
    )
    INSERT #Issues SELECT DISTINCT N'cycle',StartId FROM Walk WHERE Cycle=1 OPTION(MAXRECURSION 0);
    -- Even clean parity cannot prove who wrote an offer in the old mutable system.
    IF COL_LENGTH(N'dbo.Quotations',N'ProposedByUserId') IS NULL
        INSERT #Issues SELECT N'active-legacy-unknown-provenance',Id FROM dbo.Quotations WHERE Status=N'Pending';
    ELSE
        EXEC(N'INSERT #Issues SELECT N''active-legacy-unknown-provenance'',q.Id FROM dbo.Quotations q
            JOIN dbo.ServiceRequests r ON r.Id=q.ServiceRequestId JOIN dbo.CustomerProfiles c ON c.Id=r.CustomerId
            JOIN dbo.WorkerProfiles w ON w.Id=q.WorkerId WHERE q.Status=N''Pending'' AND
            (q.ProposedByUserId IS NULL OR q.CreatedAt IS NULL OR q.ProposedByUserId NOT IN(c.UserId,w.UserId));');

    SELECT Issue,EntityId FROM #Issues ORDER BY Issue,EntityId;
    IF @Apply=0 RETURN;
    IF EXISTS(SELECT 1 FROM #Issues) THROW 51005,'F5 preflight failed. Review reported IDs; no historical provenance was invented.',1;
    IF @Installed=1 BEGIN COMMIT; RETURN; END;
    -- A partial/manual F5 installation is not silently adopted.
    IF COL_LENGTH(N'dbo.Quotations',N'ProposedByUserId') IS NOT NULL
       OR COL_LENGTH(N'dbo.Quotations',N'RowVersion') IS NOT NULL
       OR COL_LENGTH(N'dbo.ServiceRequests',N'RowVersion') IS NOT NULL
        THROW 51006,'Partial F5 schema detected; reconcile explicitly before applying this version.',1;
    ALTER TABLE dbo.Quotations ADD ProposedByUserId nvarchar(450) NULL,CreatedAt datetime2 NULL,RowVersion rowversion NOT NULL;
    ALTER TABLE dbo.ServiceRequests ADD RowVersion rowversion NOT NULL;
    EXEC(N'ALTER TABLE dbo.Quotations WITH CHECK ADD CONSTRAINT FK_F5_Quotation_Proposer
        FOREIGN KEY(ProposedByUserId) REFERENCES dbo.AspNetUsers(Id) ON DELETE NO ACTION;');
    EXEC(N'CREATE INDEX IX_Quotations_ProposedByUserId ON dbo.Quotations(ProposedByUserId);');
    ALTER TABLE dbo.Quotations WITH CHECK ADD CONSTRAINT CK_F5_Quotation_Status
        CHECK(Status IN(N'Pending',N'Countered',N'Accepted',N'Rejected'));
    CREATE UNIQUE INDEX UX_F5_Quotations_Pending ON dbo.Quotations(ServiceRequestId,WorkerId) WHERE Status=N'Pending';
    CREATE UNIQUE INDEX UX_F5_Quotations_Child ON dbo.Quotations(ParentQuotationId) WHERE ParentQuotationId IS NOT NULL;
    CREATE UNIQUE INDEX UX_F5_Bookings_Request ON dbo.Bookings(ServiceRequestId);
    EXEC(N'CREATE TRIGGER dbo.TR_F5_Quotation_Immutable ON dbo.Quotations AFTER INSERT,UPDATE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.Id=i.Id WHERE
            i.ServiceRequestId<>d.ServiceRequestId OR i.WorkerId<>d.WorkerId OR i.ProposedPrice<>d.ProposedPrice OR
            EXISTS(SELECT i.Message COLLATE Latin1_General_100_BIN2,DATALENGTH(i.Message),
                          i.ProposedByUserId COLLATE Latin1_General_100_BIN2,DATALENGTH(i.ProposedByUserId),i.CreatedAt,i.ParentQuotationId
                   EXCEPT SELECT d.Message COLLATE Latin1_General_100_BIN2,DATALENGTH(d.Message),
                          d.ProposedByUserId COLLATE Latin1_General_100_BIN2,DATALENGTH(d.ProposedByUserId),d.CreatedAt,d.ParentQuotationId))
            THROW 51007,''Submitted F5 terms and provenance are immutable.'',1;
        IF EXISTS(SELECT 1 FROM inserted i JOIN deleted d ON d.Id=i.Id
            WHERE i.Status<>d.Status AND (d.Status<>N''Pending'' OR i.Status NOT IN(N''Countered'',N''Accepted'',N''Rejected'')))
            THROW 51008,''Invalid F5 offer transition.'',1;
        IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.Id=i.Id
            JOIN dbo.ServiceRequests r ON r.Id=i.ServiceRequestId JOIN dbo.CustomerProfiles c ON c.Id=r.CustomerId
            JOIN dbo.WorkerProfiles w ON w.Id=i.WorkerId LEFT JOIN dbo.Quotations p ON p.Id=i.ParentQuotationId
            WHERE d.Id IS NULL AND (i.Status<>N''Pending'' OR r.Status<>N''Open'' OR i.CreatedAt IS NULL OR
                i.ProposedByUserId IS NULL OR i.ProposedByUserId NOT IN(c.UserId,w.UserId) OR c.UserId=w.UserId OR
                (i.ParentQuotationId IS NULL AND i.ProposedByUserId<>w.UserId) OR
                (i.ParentQuotationId IS NOT NULL AND (p.Id>=i.Id OR p.ServiceRequestId<>i.ServiceRequestId OR
                    p.WorkerId<>i.WorkerId OR p.Status<>N''Countered'' OR p.ProposedByUserId IS NULL OR p.ProposedByUserId=i.ProposedByUserId))))
            THROW 51009,''Invalid F5 submission or parent.'',1;
    END;');
    EXEC sys.sp_addextendedproperty @name=N'KarigorF5Version',@value=1,
        @level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'Quotations';
    COMMIT;
END TRY
BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    THROW;
END CATCH;
