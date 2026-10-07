using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

public static class RefreshSessionSchemaGate
{
    // Read-only: no startup repair, legacy family fabrication, or EF migration owner.
    public static void Verify(KarigorDbContext db) => db.Database.ExecuteSqlRaw("""
        DECLARE @Indexes TABLE(Name sysname, Keys nvarchar(100), Filter nvarchar(150));
        INSERT @Indexes VALUES
            (N'UX_F6_TokenHash',N'TokenHash',NULL),
            (N'UX_F6_Parent',N'ParentTokenId',N'[ParentTokenId]ISNOTNULL'),
            (N'UX_F6_ActiveToken',N'SessionId',N'[SessionId]ISNOTNULLAND[RevokedAt]ISNULL');
        IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.RefreshSessions')
            AND name=N'KarigorF6Version' AND TRY_CAST(value AS int)=1)
            OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.RefreshTokens') AND name=N'TokenHash' AND max_length=128)
            OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.RefreshTokens') AND name=N'RowVersion' AND system_type_id=189)
            OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.RefreshSessions') AND name=N'RowVersion' AND system_type_id=189)
            OR (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.RefreshTokens')
                AND name IN(N'UX_F6_TokenHash',N'UX_F6_Parent',N'UX_F6_ActiveToken') AND is_unique=1 AND is_disabled=0)<>3
            OR (SELECT COUNT(*) FROM sys.foreign_keys WHERE name IN(N'FK_F6_Session_User',N'FK_F6_Token_Session',N'FK_F6_Token_Parent')
                AND is_disabled=0 AND is_not_trusted=0)<>3
            OR (SELECT COUNT(*) FROM sys.check_constraints WHERE name IN(N'CK_F6_Legacy_Revoked',N'CK_F6_Hash',N'CK_F6_Parent',N'CK_F6_Session_Lifetime',N'CK_F6_Session_Revocation')
                AND is_disabled=0 AND is_not_trusted=0)<>5
            OR EXISTS(SELECT 1 FROM @Indexes e LEFT JOIN sys.indexes i ON i.object_id=OBJECT_ID(N'dbo.RefreshTokens') AND i.name=e.Name
                OUTER APPLY(SELECT STRING_AGG(CONVERT(nvarchar(max),c.name),N',') WITHIN GROUP(ORDER BY ic.key_ordinal) AS Keys
                    FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
                    WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0) k
                WHERE k.Keys IS NULL OR k.Keys<>e.Keys OR EXISTS(
                    SELECT REPLACE(REPLACE(REPLACE(i.filter_definition,N'(',N''),N')',N''),N' ',N'') EXCEPT SELECT e.Filter))
            THROW 51065,'F6 schema missing/incomplete. Apply database/production/008_refresh_session_authority.sql during an authorized writer outage and forced sign-in reset.',1;
        """);
}
