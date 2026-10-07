using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

public static class F5SchemaGate
{
    // Read-only: startup must never compete with the versioned SQL owner.
    public static void Verify(KarigorDbContext db) => db.Database.ExecuteSqlRaw("""
        DECLARE @ExpectedIndexes TABLE(TableName sysname,IndexName sysname,Keys nvarchar(100),Filter nvarchar(100));
        INSERT @ExpectedIndexes VALUES
            (N'Quotations',N'UX_F5_Quotations_Pending',N'ServiceRequestId,WorkerId',N'[Status]=N''Pending'''),
            (N'Quotations',N'UX_F5_Quotations_Child',N'ParentQuotationId',N'[ParentQuotationId]ISNOTNULL'),
            (N'Bookings',N'UX_F5_Bookings_Request',N'ServiceRequestId',NULL);
        IF NOT EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.Quotations')
            AND minor_id=0 AND name=N'KarigorF5Version' AND TRY_CAST(value AS int)=1)
            OR COL_LENGTH(N'dbo.Quotations',N'ProposedByUserId') IS NULL
            OR COL_LENGTH(N'dbo.Quotations',N'CreatedAt') IS NULL
            OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Quotations') AND name=N'RowVersion' AND system_type_id=189)
            OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.ServiceRequests') AND name=N'RowVersion' AND system_type_id=189)
            OR NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Quotations') AND name=N'UX_F5_Quotations_Pending' AND is_unique=1 AND is_disabled=0 AND has_filter=1)
            OR NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Quotations') AND name=N'UX_F5_Quotations_Child' AND is_unique=1 AND is_disabled=0 AND has_filter=1)
            OR NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Bookings') AND name=N'UX_F5_Bookings_Request' AND is_unique=1 AND is_disabled=0)
            OR EXISTS(SELECT 1 FROM @ExpectedIndexes e
                LEFT JOIN sys.indexes i ON i.object_id=OBJECT_ID(N'dbo.'+e.TableName) AND i.name=e.IndexName
                OUTER APPLY(SELECT STRING_AGG(CONVERT(nvarchar(max),c.name),N',') WITHIN GROUP(ORDER BY ic.key_ordinal) AS Keys
                    FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
                    WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0) k
                WHERE k.Keys<>e.Keys OR k.Keys IS NULL OR
                    EXISTS(SELECT REPLACE(REPLACE(REPLACE(i.filter_definition,N'(',N''),N')',N''),N' ',N'') EXCEPT SELECT e.Filter))
            OR NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_F5_Quotation_Proposer' AND is_disabled=0 AND is_not_trusted=0)
            OR NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name=N'CK_F5_Quotation_Status' AND is_disabled=0 AND is_not_trusted=0)
            OR NOT EXISTS(SELECT 1 FROM sys.triggers WHERE parent_id=OBJECT_ID(N'dbo.Quotations') AND name=N'TR_F5_Quotation_Immutable' AND is_disabled=0)
            THROW 51010,'F5 schema missing/incomplete. Apply database/production/005_f5_negotiation_integrity.sql during an authorized writer outage.',1;
        """);
}
