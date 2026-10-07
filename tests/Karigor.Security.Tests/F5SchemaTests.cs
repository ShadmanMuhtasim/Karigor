using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Security.Tests;

[Trait("Finding", "F5"), Trait("Layer", "SQL")]
public sealed class F5SchemaTests
{
    private const string Seed = """
        INSERT dbo.AspNetUsers(Id) VALUES(N'customer'),(N'worker'),(N'worker2');
        INSERT dbo.CustomerProfiles(UserId,FullName) VALUES(N'customer',N'Fixture');
        INSERT dbo.WorkerProfiles(UserId) VALUES(N'worker'),(N'worker2');
        INSERT dbo.ServiceCategories(Name) VALUES(N'Fixture');
        INSERT dbo.ServiceRequests(CustomerId,CategoryId,Description,Address,PreferredDate,Status)
            VALUES(1,1,N'Fixture',N'Fixture',SYSUTCDATETIME(),N'Open'),(1,1,N'Fixture',N'Fixture',SYSUTCDATETIME(),N'Open');
        """;

    private static async Task Execute(SqlConnection c, string sql)
    { using var cmd = c.CreateCommand(); cmd.CommandText = sql; await cmd.ExecuteNonQueryAsync(); }
    private static async Task<string> Script(DisposableSqlDatabase db) =>
        await File.ReadAllTextAsync(Path.Combine(db.RepositoryRoot, "database/production/005_f5_negotiation_integrity.sql"));

    [Theory]
    [InlineData("duplicate-bookings", "INSERT dbo.Bookings(ServiceRequestId,WorkerId,CustomerId,AgreedPrice,ScheduledDate) VALUES(1,1,1,1000,SYSUTCDATETIME()),(1,1,1,1000,SYSUTCDATETIME());")]
    [InlineData("multiple-pending-heads", "INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status) VALUES(1,1,1000,N'Pending'),(1,1,800,N'Pending');")]
    [InlineData("cycle", "INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status) VALUES(1,1,1000,N'Rejected'),(1,1,800,N'Rejected'); UPDATE dbo.Quotations SET ParentQuotationId=CASE Id WHEN 1 THEN 2 ELSE 1 END;")]
    [InlineData("cross-request-parent", "INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status) VALUES(1,1,1000,N'Countered'); INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status,ParentQuotationId) VALUES(2,1,800,N'Rejected',1);")]
    [InlineData("cross-worker-parent", "INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status) VALUES(1,1,1000,N'Countered'); INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status,ParentQuotationId) VALUES(1,2,800,N'Rejected',1);")]
    [InlineData("missing-parent", "ALTER TABLE dbo.Quotations NOCHECK CONSTRAINT FK_Quotations_Quotations_ParentQuotationId; INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status,ParentQuotationId) VALUES(1,1,800,N'Rejected',999);")]
    [InlineData("invalid-quotation-status", "INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status) VALUES(1,1,1000,N'Invalid');")]
    [InlineData("linear-chain-fork", "INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status) VALUES(1,1,1000,N'Countered'); INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status,ParentQuotationId) VALUES(1,1,800,N'Rejected',1),(1,1,900,N'Rejected',1);")]
    [InlineData("active-legacy-unknown-provenance", "INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status) VALUES(1,1,1000,N'Countered'); INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status,ParentQuotationId) VALUES(1,1,800,N'Pending',1);")]
    public async Task PreflightReportsInvalidLegacyAndApplyRollsBack(string expected, string dirty)
    {
        await using var db = new DisposableSqlDatabase();
        await db.InitializeAsync(applyF5: false);
        using var c = new SqlConnection(db.ConnectionString); await c.OpenAsync();
        await Execute(c, Seed + dirty);
        var script = await Script(db);
        using (var cmd = c.CreateCommand())
        {
            cmd.CommandText = script;
            using var reader = await cmd.ExecuteReaderAsync();
            var issues = new List<string>(); while (await reader.ReadAsync()) issues.Add(reader.GetString(0));
            Assert.Contains(expected, issues);
        }
        var error = await Assert.ThrowsAsync<SqlException>(() => Execute(c,
            "EXEC sys.sp_set_session_context @key=N'KarigorF5Apply',@value=1;\n" + script));
        Assert.Equal(51005, error.Number);
        using var verify = c.CreateCommand();
        verify.CommandText = "SELECT COL_LENGTH(N'dbo.Quotations',N'ProposedByUserId')";
        Assert.Equal(DBNull.Value, await verify.ExecuteScalarAsync());
    }

    [Fact]
    public async Task CleanInactiveLegacyPreservesUnknownProvenanceAndBookingAndApplyIsRepeatable()
    {
        await using var db = new DisposableSqlDatabase(); await db.InitializeAsync(applyF5: false);
        using var c = new SqlConnection(db.ConnectionString); await c.OpenAsync();
        await Execute(c, Seed + """
            INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status) VALUES(1,1,1000,N'Countered');
            INSERT dbo.Quotations(ServiceRequestId,WorkerId,ProposedPrice,Status,ParentQuotationId) VALUES(1,1,800,N'Accepted',1);
            UPDATE dbo.ServiceRequests SET Status=N'InProgress' WHERE Id=1;
            INSERT dbo.Bookings(ServiceRequestId,WorkerId,CustomerId,AgreedPrice,ScheduledDate) VALUES(1,1,1,800,SYSUTCDATETIME());
            """);
        var apply = "EXEC sys.sp_set_session_context @key=N'KarigorF5Apply',@value=1;\n" + await Script(db);
        await Execute(c, apply); await Execute(c, apply);
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM dbo.Quotations WHERE ProposedByUserId IS NULL AND CreatedAt IS NULL; SELECT AgreedPrice FROM dbo.Bookings;";
        using var reader = await cmd.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync()); Assert.Equal(2, reader.GetInt32(0));
        Assert.True(await reader.NextResultAsync()); Assert.True(await reader.ReadAsync()); Assert.Equal(800m, reader.GetDecimal(0));
        await reader.DisposeAsync();
        await using var context = new KarigorDbContext(new DbContextOptionsBuilder<KarigorDbContext>().UseSqlServer(db.ConnectionString).Options);
        F5SchemaGate.Verify(context);
        await Execute(c, "DISABLE TRIGGER dbo.TR_F5_Quotation_Immutable ON dbo.Quotations;");
        Assert.Equal(51010, Assert.Throws<SqlException>(() => F5SchemaGate.Verify(context)).Number);
        await Execute(c, "ENABLE TRIGGER dbo.TR_F5_Quotation_Immutable ON dbo.Quotations; DROP INDEX UX_F5_Quotations_Pending ON dbo.Quotations; CREATE UNIQUE INDEX UX_F5_Quotations_Pending ON dbo.Quotations(ServiceRequestId,WorkerId) WHERE Status=N'Accepted';");
        Assert.Equal(51010, Assert.Throws<SqlException>(() => F5SchemaGate.Verify(context)).Number);
    }

    [Fact]
    public async Task StartupGateRejectsUnupgradedSchemaWithoutAddingColumns()
    {
        await using var db = new DisposableSqlDatabase(); await db.InitializeAsync(applyF5: false);
        await using var context = new KarigorDbContext(new DbContextOptionsBuilder<KarigorDbContext>().UseSqlServer(db.ConnectionString).Options);
        Assert.Equal(51010, Assert.Throws<SqlException>(() => F5SchemaGate.Verify(context)).Number);
    }
}
