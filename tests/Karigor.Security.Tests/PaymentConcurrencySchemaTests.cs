using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Karigor.Security.Tests;

[Trait("Finding", "PaymentSchema"), Trait("Layer", "SQL")]
public sealed class PaymentConcurrencySchemaTests
{
    private static KarigorDbContext Context(DisposableSqlDatabase db) => new(new DbContextOptionsBuilder<KarigorDbContext>().UseSqlServer(db.ConnectionString).Options);
    private static async Task<string> Script(DisposableSqlDatabase db) => await File.ReadAllTextAsync(Path.Combine(db.RepositoryRoot,"database/production/007_payment_concurrency.sql"));
    private static async Task Execute(SqlConnection c, string sql)
    { using var command=c.CreateCommand(); command.CommandText=sql; await command.ExecuteNonQueryAsync(); }
    private static Task Apply(SqlConnection c,string script) => Execute(c,"EXEC sys.sp_set_session_context @key=N'KarigorPaymentConcurrencyApply',@value=1;\n"+script);
    private static async Task<List<string>> Preflight(SqlConnection c,string script)
    {
        await Execute(c,"EXEC sys.sp_set_session_context @key=N'KarigorPaymentConcurrencyApply',@value=NULL;");
        using var command=c.CreateCommand(); command.CommandText=script; using var r=await command.ExecuteReaderAsync();
        var codes=new List<string>(); while(await r.ReadAsync()) if(r.GetString(0)!="Info") codes.Add(r.GetString(1)); return codes;
    }
    private const string Seed="""
        INSERT dbo.AspNetUsers(Id) VALUES(N'customer'),(N'worker');
        INSERT dbo.CustomerProfiles(UserId,FullName) VALUES(N'customer',N'Fixture');
        INSERT dbo.WorkerProfiles(UserId) VALUES(N'worker');
        INSERT dbo.ServiceCategories(Name) VALUES(N'Fixture');
        INSERT dbo.ServiceRequests(CustomerId,CategoryId,Description,Address,PreferredDate,Status) VALUES(1,1,N'Fixture',N'Fixture',SYSUTCDATETIME(),N'Completed');
        INSERT dbo.Bookings(ServiceRequestId,WorkerId,CustomerId,AgreedPrice,ScheduledDate,Status) VALUES(1,1,1,1000,SYSUTCDATETIME(),N'Completed');
        """;

    [Fact]
    public async Task VersionTwoExactlyMatchesEfAndRepeatApplyChangesNoFinancialRows()
    {
        await using var database=new DisposableSqlDatabase(); await database.InitializeAsync();
        await using var db=Context(database); PaymentSchemaGate.Verify(db);
        using var c=new SqlConnection(database.ConnectionString); await c.OpenAsync(); await Execute(c,Seed);
        foreach(var model in new[]{typeof(Payment),typeof(Booking)})
        {
            var entity=db.Model.FindEntityType(model)!; var table=StoreObjectIdentifier.Table(entity.GetTableName()!,null);
            using var command=c.CreateCommand(); command.CommandText="SELECT name,TYPE_NAME(system_type_id),max_length,precision,scale,is_nullable,is_identity FROM sys.columns WHERE object_id=OBJECT_ID(@table)";
            command.Parameters.AddWithValue("@table","dbo."+table.Name); using var r=await command.ExecuteReaderAsync();
            var columns=new Dictionary<string,(string Type,int Length,int Precision,int Scale,bool Nullable,bool Identity)>();
            while(await r.ReadAsync()) columns.Add(r.GetString(0),(r.GetString(1),r.GetInt16(2),r.GetByte(3),r.GetByte(4),r.GetBoolean(5),r.GetBoolean(6)));
            if(model==typeof(Payment)) Assert.Equal(27,columns.Count);
            foreach(var property in entity.GetProperties())
            {
                var column=columns[property.GetColumnName(table)!]; var type=column.Type switch
                { "nvarchar"=>column.Length==-1?"nvarchar(max)":$"nvarchar({column.Length/2})", "decimal"=>$"decimal({column.Precision},{column.Scale})", "timestamp"=>"rowversion",_=>column.Type };
                Assert.Equal(property.GetColumnType()!.Replace(" ",""),type); Assert.Equal(property.IsNullable,column.Nullable);
            }
            Assert.True(columns["Id"].Identity); var version=entity.FindProperty("RowVersion")!;
            Assert.True(version.IsConcurrencyToken); Assert.Equal(ValueGenerated.OnAddOrUpdate,version.ValueGenerated);
        }
        Assert.False(db.Model.FindEntityType(typeof(Booking))!.FindProperty("SelectedPaymentId")!.IsConcurrencyToken);
        var payment=db.Model.FindEntityType(typeof(Payment))!;
        Assert.Equal(false,payment.FindProperty("RequiresReview")!.GetDefaultValue());
        Assert.Contains(payment.GetIndexes(),i=>i.GetDatabaseName()=="UX_Payment_InitiationIntent" && i.IsUnique && i.GetFilter()=="[InitiationFingerprint] IS NOT NULL");
        Assert.Contains(payment.GetIndexes(),i=>i.GetDatabaseName()=="UX_Payment_VerifiedIdentity" && i.IsUnique);
        var allocation=db.Model.FindEntityType(typeof(Booking))!.GetForeignKeys().Single(f=>f.GetConstraintName()=="FK_PaymentAllocation_Booking");
        Assert.Equal(new[]{"SelectedPaymentId","Id"},allocation.Properties.Select(p=>p.Name));
        Assert.Equal(new[]{"Id","BookingId"},allocation.PrincipalKey.Properties.Select(p=>p.Name)); Assert.Equal(DeleteBehavior.NoAction,allocation.DeleteBehavior);
        using var before=c.CreateCommand(); before.CommandText="SELECT (SELECT * FROM dbo.Bookings FOR JSON PATH,INCLUDE_NULL_VALUES)"; var snapshot=await before.ExecuteScalarAsync();
        var script=await Script(database); Assert.Empty(await Preflight(c,script)); await Apply(c,script); PaymentSchemaGate.Verify(db);
        Assert.Equal(snapshot,await before.ExecuteScalarAsync());
    }

    [Theory]
    [InlineData("payment", "legacy-payment-outcome")]
    [InlineData("paid", "legacy-booking-payment-provenance")]
    [InlineData("unknown", "legacy-booking-payment-provenance")]
    public async Task LegacyFinancialAmbiguityReportsIdentitiesAndRefusesWithoutInventingHistory(string variant,string expected)
    {
        await using var database=new DisposableSqlDatabase(); await database.InitializeAsync(applyPaymentConcurrency:false);
        using var c=new SqlConnection(database.ConnectionString); await c.OpenAsync(); await Execute(c,Seed);
        if(variant=="payment") await Execute(c,"INSERT dbo.Payments(BookingId,TransactionId,TotalAmount,PlatformFee,ServiceCharge,WorkerAmount) VALUES(1,N'legacy-attempt',1000,20,40,940)");
        else await Execute(c,variant=="paid"?"UPDATE dbo.Bookings SET PaymentStatus=N'Paid'":"UPDATE dbo.Bookings SET PaymentStatus=N'Unknown'");
        using var before=c.CreateCommand(); before.CommandText="SELECT (SELECT * FROM dbo.Bookings FOR JSON PATH,INCLUDE_NULL_VALUES),(SELECT * FROM dbo.Payments FOR JSON PATH,INCLUDE_NULL_VALUES)";
        async Task<string> Snapshot() { using var r=await before.ExecuteReaderAsync(); await r.ReadAsync(); return (r.IsDBNull(0)?"[]":r.GetString(0))+(r.IsDBNull(1)?"[]":r.GetString(1)); }
        var snapshot=await Snapshot(); var script=await Script(database); Assert.Contains(expected,await Preflight(c,script));
        Assert.Equal(51070,(await Assert.ThrowsAsync<SqlException>(()=>Apply(c,script))).Number);
        Assert.Equal(snapshot,await Snapshot()); using var metadata=c.CreateCommand(); metadata.CommandText="SELECT COL_LENGTH(N'dbo.Payments',N'RowVersion'),COL_LENGTH(N'dbo.Bookings',N'SelectedPaymentId')";
        using var reader=await metadata.ExecuteReaderAsync(); await reader.ReadAsync(); Assert.True(reader.IsDBNull(0)); Assert.True(reader.IsDBNull(1));
    }

    [Theory]
    [InlineData("index")]
    [InlineData("trigger")]
    [InlineData("check")]
    [InlineData("fk")]
    [InlineData("column")]
    public async Task StartupRejectsConcurrencyMetadataDriftAndDoesNotRepair(string variant)
    {
        await using var database=new DisposableSqlDatabase(); await database.InitializeAsync();
        await using var db=Context(database);
        await db.Database.ExecuteSqlRawAsync(variant switch
        {
            "index"=>"DROP INDEX UX_Payment_InitiationIntent ON dbo.Payments",
            "trigger"=>"DISABLE TRIGGER dbo.TR_Payment_Facts_Immutable ON dbo.Payments",
            "check"=>"ALTER TABLE dbo.Payments NOCHECK CONSTRAINT CK_Payment_Verified",
            "fk"=>"ALTER TABLE dbo.Bookings NOCHECK CONSTRAINT FK_PaymentAllocation_Booking",
            _=>"ALTER TABLE dbo.Payments ALTER COLUMN ProviderSessionKey nvarchar(200) NULL"
        });
        Assert.Equal(51071,Assert.Throws<SqlException>(()=>PaymentSchemaGate.Verify(db)).Number);
        Assert.Equal(51071,Assert.Throws<SqlException>(()=>PaymentSchemaGate.Verify(db)).Number);
    }

    [Fact]
    public async Task VersionOneBinariesContractIsFrozenAndCurrentStartupRequiresExplicit007()
    {
        await using var database=new DisposableSqlDatabase(); await database.InitializeAsync(applyPaymentConcurrency:false);
        await using var db=Context(database); PaymentSchemaGate.VerifyVersionOne(db);
        Assert.Equal(51061,Assert.Throws<SqlException>(()=>PaymentSchemaGate.Verify(db)).Number);
        using var c=new SqlConnection(database.ConnectionString); await c.OpenAsync(); var script=await Script(database);
        Assert.Empty(await Preflight(c,script)); await Apply(c,script); PaymentSchemaGate.Verify(db);
    }
}
