-- F6 is SQL-owned. Run during a writer outage, after 001/005/006/007.
-- Default: read-only preflight. Apply requires BOTH explicit flags on this connection.
-- EXEC sys.sp_set_session_context @key=N'KarigorF6Apply', @value=1;
-- EXEC sys.sp_set_session_context @key=N'KarigorF6ForceSignInReset', @value=1;
-- Never infer families from legacy ReplacedByToken. Existing JWTs have no valid sid.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.RefreshTokens', N'U') IS NULL
    THROW 51060, 'F6 requires the canonical 001 schema.', 1;
IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.RefreshSessions')
    AND name=N'KarigorF6Version' AND TRY_CAST(value AS int)=1)
BEGIN
    PRINT 'F6 already applied. Startup gate verifies its required structure.';
    RETURN;
END;
IF OBJECT_ID(N'dbo.RefreshSessions', N'U') IS NOT NULL OR COL_LENGTH(N'dbo.RefreshTokens',N'SessionId') IS NOT NULL
    THROW 51061, 'Partial F6 schema: stop and review; no automatic repair.', 1;
IF EXISTS(SELECT 1 FROM dbo.RefreshTokens WHERE LEN(TokenHash)<>64 OR DATALENGTH(TokenHash)<>128
    OR TokenHash COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9a-f]%'
    OR (ReplacedByToken IS NOT NULL AND (LEN(ReplacedByToken)<>64 OR DATALENGTH(ReplacedByToken)<>128
        OR ReplacedByToken COLLATE Latin1_General_100_BIN2 LIKE N'%[^0-9a-f]%')))
    THROW 51062, 'Malformed legacy hashes require operator review; do not truncate or guess history.', 1;
IF EXISTS(SELECT TokenHash FROM dbo.RefreshTokens GROUP BY TokenHash HAVING COUNT(*)>1)
    THROW 51063, 'Duplicate legacy hashes require operator review.', 1;
SELECT COUNT(*) AS LegacyTokens, SUM(CASE WHEN RevokedAt IS NULL THEN 1 ELSE 0 END) AS TokensToRevoke FROM dbo.RefreshTokens;
IF ISNULL(TRY_CAST(SESSION_CONTEXT(N'KarigorF6Apply') AS int),0)<>1 RETURN;
IF ISNULL(TRY_CAST(SESSION_CONTEXT(N'KarigorF6ForceSignInReset') AS int),0)<>1
    THROW 51064, 'Explicit forced sign-in reset acknowledgement is required.', 1;

BEGIN TRANSACTION;
-- Lock legacy rows while altering; application writers must already be stopped.
UPDATE dbo.RefreshTokens WITH (TABLOCKX) SET RevokedAt=COALESCE(RevokedAt,SYSUTCDATETIME());
CREATE TABLE dbo.RefreshSessions (
    Id uniqueidentifier NOT NULL CONSTRAINT PK_RefreshSessions PRIMARY KEY,
    UserId nvarchar(450) NOT NULL,
    CreatedAt datetime2 NOT NULL,
    ExpiresAt datetime2 NOT NULL,
    RevokedAt datetime2 NULL,
    RevocationReason nvarchar(32) NULL,
    RowVersion rowversion NOT NULL,
    CONSTRAINT FK_F6_Session_User FOREIGN KEY(UserId) REFERENCES dbo.AspNetUsers(Id),
    CONSTRAINT UQ_F6_Session_User UNIQUE(Id,UserId),
    CONSTRAINT CK_F6_Session_Lifetime CHECK(ExpiresAt>CreatedAt),
    CONSTRAINT CK_F6_Session_Revocation CHECK((RevokedAt IS NULL AND RevocationReason IS NULL) OR
        (RevokedAt IS NOT NULL AND RevocationReason IN(N'Logout',N'Replay',N'Suspension')))
);
CREATE INDEX IX_RefreshSessions_UserId ON dbo.RefreshSessions(UserId);
ALTER TABLE dbo.RefreshTokens ALTER COLUMN TokenHash nvarchar(64) NOT NULL;
ALTER TABLE dbo.RefreshTokens ALTER COLUMN ReplacedByToken nvarchar(64) NULL;
ALTER TABLE dbo.RefreshTokens ADD SessionId uniqueidentifier NULL, ParentTokenId int NULL, RowVersion rowversion NOT NULL;
-- Dynamic batch resolves new columns after DDL compilation.
EXEC(N'
ALTER TABLE dbo.RefreshTokens ADD
 CONSTRAINT FK_F6_Token_Session FOREIGN KEY(SessionId,UserId) REFERENCES dbo.RefreshSessions(Id,UserId),
 CONSTRAINT UQ_F6_Token_Session UNIQUE(Id,SessionId),
 CONSTRAINT CK_F6_Legacy_Revoked CHECK(SessionId IS NOT NULL OR (RevokedAt IS NOT NULL AND ParentTokenId IS NULL)),
 CONSTRAINT CK_F6_Hash CHECK(LEN(TokenHash)=64 AND DATALENGTH(TokenHash)=128 AND TokenHash COLLATE Latin1_General_100_BIN2 NOT LIKE N''%[^0-9a-f]%''),
 CONSTRAINT CK_F6_Parent CHECK(ParentTokenId IS NULL OR ParentTokenId<Id);
ALTER TABLE dbo.RefreshTokens ADD CONSTRAINT FK_F6_Token_Parent FOREIGN KEY(ParentTokenId,SessionId) REFERENCES dbo.RefreshTokens(Id,SessionId);
CREATE UNIQUE INDEX UX_F6_TokenHash ON dbo.RefreshTokens(TokenHash);
CREATE UNIQUE INDEX UX_F6_Parent ON dbo.RefreshTokens(ParentTokenId) WHERE ParentTokenId IS NOT NULL;
CREATE UNIQUE INDEX UX_F6_ActiveToken ON dbo.RefreshTokens(SessionId) WHERE SessionId IS NOT NULL AND RevokedAt IS NULL;
');
EXEC sys.sp_addextendedproperty @name=N'KarigorF6Version',@value=1,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'RefreshSessions';
COMMIT;
