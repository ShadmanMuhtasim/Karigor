using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit.Abstractions;

namespace Karigor.Security.Tests;

[Trait("Finding", "PaymentSchema"), Trait("Layer", "SQL")]
public sealed class PaymentSchemaTests(ITestOutputHelper output)
{
    private static async Task Execute(SqlConnection c, string sql)
    { using var cmd=c.CreateCommand(); cmd.CommandText=sql; await cmd.ExecuteNonQueryAsync(); }
    private static async Task<string> Script(DisposableSqlDatabase db) =>
        await File.ReadAllTextAsync(Path.Combine(db.RepositoryRoot,"database/production/006_payment_schema_authority.sql"));
    private static Task Apply(SqlConnection c,string script) => Execute(c,
        "EXEC sys.sp_set_session_context @key=N'KarigorPaymentSchemaApply',@value=1;\n"+script);
    private static KarigorDbContext Context(DisposableSqlDatabase db) => new(new DbContextOptionsBuilder<KarigorDbContext>().UseSqlServer(db.ConnectionString).Options);

    // Test-only snapshot of the audited former Program.cs/004 definition. Never an operator path.
    private const string AuditedPaymentSql="""
        ALTER TABLE dbo.Bookings ADD PaymentStatus nvarchar(50) NOT NULL DEFAULT 'Unpaid';
        CREATE TABLE dbo.Payments(
            Id int NOT NULL IDENTITY,BookingId int NOT NULL,TransactionId nvarchar(100) NOT NULL,
            ValId nvarchar(100) NULL,BankTranId nvarchar(100) NULL,CardType nvarchar(100) NULL,
            Currency nvarchar(10) NOT NULL DEFAULT 'BDT',TotalAmount decimal(18,2) NOT NULL,
            PlatformFee decimal(18,2) NOT NULL,ServiceCharge decimal(18,2) NOT NULL DEFAULT 0.00,
            WorkerAmount decimal(18,2) NOT NULL,Status nvarchar(50) NOT NULL DEFAULT 'Initiated',
            CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),PaidAt datetime2 NULL,GatewayResponse nvarchar(max) NULL,
            CONSTRAINT PK_Payments PRIMARY KEY(Id),
            CONSTRAINT FK_Payments_Bookings_BookingId FOREIGN KEY(BookingId) REFERENCES dbo.Bookings(Id) ON DELETE CASCADE,
            CONSTRAINT UQ_Payments_TransactionId UNIQUE(TransactionId));
        CREATE INDEX IX_Payments_BookingId ON dbo.Payments(BookingId);
        CREATE INDEX IX_Payments_Status ON dbo.Payments(Status);
        """;
    private const string SeedBookings="""
        INSERT dbo.AspNetUsers(Id) VALUES(N'customer'),(N'worker');
        INSERT dbo.CustomerProfiles(UserId,FullName) VALUES(N'customer',N'Fixture');
        INSERT dbo.WorkerProfiles(UserId) VALUES(N'worker');
        INSERT dbo.ServiceCategories(Name) VALUES(N'Fixture');
        INSERT dbo.ServiceRequests(CustomerId,CategoryId,Description,Address,PreferredDate,Status)
            VALUES(1,1,N'Fixture',N'Fixture',SYSUTCDATETIME(),N'Completed'),(1,1,N'Fixture',N'Fixture',SYSUTCDATETIME(),N'Completed');
        INSERT dbo.Bookings(ServiceRequestId,WorkerId,CustomerId,AgreedPrice,ScheduledDate,Status)
            VALUES(1,1,1,1000,SYSUTCDATETIME(),N'Completed'),(2,1,1,500,SYSUTCDATETIME(),N'Completed');
        """;
    private const string SeedPayments="""
        UPDATE dbo.Bookings SET PaymentStatus=N'Paid' WHERE Id=1;
        INSERT dbo.Payments(BookingId,TransactionId,ValId,BankTranId,CardType,Currency,TotalAmount,PlatformFee,ServiceCharge,WorkerAmount,Status,CreatedAt,PaidAt,GatewayResponse)
            VALUES(1,N'TXN_fixture_one',N'validation_one',N'bank_one',N'VISA',N'BDT',1000,20,40,940,N'Completed','2026-10-01T12:00:00','2026-10-02T12:00:00',N'{"fixture":true}'),
                  (2,N'TXN_fixture_two',NULL,NULL,NULL,N'BDT',500,10,20,470,N'Initiated','2026-10-03T12:00:00',NULL,NULL);
        """;
    private static async Task<string> Snapshot(SqlConnection c)
    {
        using var command=c.CreateCommand();
        command.CommandText="SELECT (SELECT * FROM dbo.Payments ORDER BY Id FOR JSON PATH,INCLUDE_NULL_VALUES),(SELECT * FROM dbo.Bookings ORDER BY Id FOR JSON PATH,INCLUDE_NULL_VALUES)";
        using var reader=await command.ExecuteReaderAsync(); await reader.ReadAsync();
        return (reader.IsDBNull(0)?"[]":reader.GetString(0))+"\n"+(reader.IsDBNull(1)?"[]":reader.GetString(1));
    }
    private static async Task DropDefault(SqlConnection c,string table,string column)
    {
        using var command=c.CreateCommand();
        command.CommandText="SELECT QUOTENAME(d.name) FROM sys.default_constraints d JOIN sys.columns c ON c.default_object_id=d.object_id WHERE c.object_id=OBJECT_ID(@table) AND c.name=@column";
        command.Parameters.AddWithValue("@table","dbo."+table); command.Parameters.AddWithValue("@column",column);
        var name=(string)(await command.ExecuteScalarAsync())!;
        await Execute(c,"ALTER TABLE dbo."+table+" DROP CONSTRAINT "+name); // Fixed fixture table names only.
    }
    private static async Task<List<string>> Preflight(SqlConnection c,string script)
    {
        await Execute(c,"EXEC sys.sp_set_session_context @key=N'KarigorPaymentSchemaApply',@value=NULL;");
        using var command=c.CreateCommand(); command.CommandText=script;
        using var reader=await command.ExecuteReaderAsync(); var issues=new List<string>();
        while(await reader.ReadAsync()) if(reader.GetString(0)!="Info") issues.Add(reader.GetString(1));
        return issues;
    }

    [Fact]
    public async Task FreshSqlSchemaIsCanonicalAndMatchesEfColumnsDefaultsKeysAndFk()
    {
        await using var db=new DisposableSqlDatabase(); await db.InitializeAsync();
        using var c=new SqlConnection(db.ConnectionString); await c.OpenAsync();
        using(var diagnostic=c.CreateCommand())
        {
            diagnostic.CommandText="SELECT c.name,TYPE_NAME(c.system_type_id),c.max_length,c.precision,c.scale,c.is_nullable,d.definition FROM sys.columns c LEFT JOIN sys.default_constraints d ON d.object_id=c.default_object_id WHERE c.object_id=OBJECT_ID(N'dbo.Payments') ORDER BY c.column_id";
            using var r=await diagnostic.ExecuteReaderAsync();
            while(await r.ReadAsync()) output.WriteLine(string.Join(" | ",Enumerable.Range(0,r.FieldCount).Select(r.GetValue)));
        }
        await using var context=Context(db);
        PaymentSchemaGate.Verify(context);
        var entity=context.Model.FindEntityType(typeof(Payment))!;
        var table=StoreObjectIdentifier.Table("Payments",null);
        var columns=new Dictionary<string,(string Type,int Length,int Precision,int Scale,bool Nullable)>();
        using(var command=c.CreateCommand())
        {
            command.CommandText="SELECT name,TYPE_NAME(system_type_id),max_length,precision,scale,is_nullable FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Payments')";
            using var r=await command.ExecuteReaderAsync();
            while(await r.ReadAsync()) columns.Add(r.GetString(0),(r.GetString(1),r.GetInt16(2),r.GetByte(3),r.GetByte(4),r.GetBoolean(5)));
        }
        Assert.Equal(15,columns.Count);
        foreach(var p in entity.GetProperties())
        {
            var column=columns[p.GetColumnName(table)!]; Assert.Equal(p.IsNullable,column.Nullable);
            var expected=p.GetColumnType()!.Replace(" ","");
            var actual=column.Type switch {
                "nvarchar"=>column.Length==-1 ? "nvarchar(max)" : $"nvarchar({column.Length/2})",
                "decimal"=>$"decimal({column.Precision},{column.Scale})",_=>column.Type };
            Assert.Equal(expected,actual);
        }
        Assert.Equal("BDT",entity.FindProperty(nameof(Payment.Currency))!.GetDefaultValue());
        Assert.Equal("Initiated",entity.FindProperty(nameof(Payment.Status))!.GetDefaultValue());
        Assert.Equal(0m,entity.FindProperty(nameof(Payment.ServiceCharge))!.GetDefaultValue());
        Assert.Equal("SYSUTCDATETIME()",entity.FindProperty(nameof(Payment.CreatedAt))!.GetDefaultValueSql());
        Assert.Equal("Unpaid",context.Model.FindEntityType(typeof(Booking))!.FindProperty(nameof(Booking.PaymentStatus))!.GetDefaultValue());
        Assert.Equal("UQ_Payments_TransactionId",entity.GetKeys().Single(k=>k.Properties.Single().Name==nameof(Payment.TransactionId)).GetName());
        Assert.Equal(DeleteBehavior.Cascade,entity.GetForeignKeys().Single().DeleteBehavior);
        Assert.Equal("FK_Payments_Bookings_BookingId",entity.GetForeignKeys().Single().GetConstraintName());
        Assert.Null(entity.FindProperty("RowVersion"));
        Assert.Null(context.Model.FindEntityType(typeof(Booking))!.FindProperty("RowVersion"));
        await Apply(c,await Script(db)); PaymentSchemaGate.Verify(context); // Repeatable, still no business metadata.
    }

    [Theory]
    [InlineData("audited-startup")]
    [InlineData("matching-ef-index")]
    [InlineData("missing-indexes-and-fk")]
    [InlineData("wrong-defaults")]
    public async Task AuditedValidUpgradePreservesEveryFinancialValue(string variant)
    {
        await using var db=new DisposableSqlDatabase(); await db.InitializeAsync(applyPayment:false);
        using var c=new SqlConnection(db.ConnectionString); await c.OpenAsync();
        await Execute(c,AuditedPaymentSql); await Execute(c,SeedBookings); await Execute(c,SeedPayments);
        if(variant=="matching-ef-index") await Execute(c,"ALTER TABLE dbo.Payments DROP CONSTRAINT UQ_Payments_TransactionId; CREATE UNIQUE INDEX UQ_Payments_TransactionId ON dbo.Payments(TransactionId);");
        if(variant=="missing-indexes-and-fk") await Execute(c,"DROP INDEX IX_Payments_BookingId ON dbo.Payments; DROP INDEX IX_Payments_Status ON dbo.Payments; ALTER TABLE dbo.Payments DROP CONSTRAINT FK_Payments_Bookings_BookingId;");
        if(variant=="wrong-defaults")
        {
            await DropDefault(c,"Payments","Currency"); await DropDefault(c,"Bookings","PaymentStatus");
            await Execute(c,"ALTER TABLE dbo.Payments ADD CONSTRAINT DF_Legacy_Currency DEFAULT N'USD' FOR Currency; ALTER TABLE dbo.Bookings ADD CONSTRAINT DF_Legacy_PaymentStatus DEFAULT N'Paid' FOR PaymentStatus;");
        }
        var before=await Snapshot(c); var script=await Script(db);
        Assert.Empty(await Preflight(c,script));
        await Apply(c,script); await Apply(c,script);
        Assert.Equal(before,await Snapshot(c));
        await using var context=Context(db); PaymentSchemaGate.Verify(context);
        var completed=await context.Payments.AsNoTracking().SingleAsync(p=>p.Id==1);
        Assert.Equal("Completed",completed.Status); Assert.Equal("validation_one",completed.ValId);
        Assert.Equal(1000m,completed.TotalAmount); Assert.Equal(40m,completed.ServiceCharge);
    }

    [Theory]
    [InlineData("duplicate-transaction-id","ALTER TABLE dbo.Payments DROP CONSTRAINT UQ_Payments_TransactionId; UPDATE dbo.Payments SET TransactionId=N'TXN_fixture_one' WHERE Id=2;")]
    [InlineData("malformed-transaction-id","UPDATE dbo.Payments SET TransactionId=N'   ' WHERE Id=2;")]
    [InlineData("malformed-transaction-id","UPDATE dbo.Payments SET TransactionId=TransactionId+N' ' WHERE Id=2;")]
    [InlineData("malformed-transaction-id","ALTER TABLE dbo.Payments DROP CONSTRAINT UQ_Payments_TransactionId; ALTER TABLE dbo.Payments ALTER COLUMN TransactionId nvarchar(100) NULL; UPDATE dbo.Payments SET TransactionId=NULL WHERE Id=2;")]
    [InlineData("apparent-duplicate-validation-id","UPDATE dbo.Payments SET ValId=N'validation_one' WHERE Id=2;")]
    [InlineData("apparent-duplicate-bank-transaction-id","UPDATE dbo.Payments SET BankTranId=N'bank_one' WHERE Id=2;")]
    [InlineData("multiple-completed-attempts","UPDATE dbo.Payments SET BookingId=1,TotalAmount=1000,PlatformFee=20,ServiceCharge=40,WorkerAmount=940,Status=N'Completed',ValId=N'validation_two',PaidAt='2026-10-04T12:00:00' WHERE Id=2;")]
    [InlineData("paid-booking-without-completion","UPDATE dbo.Bookings SET PaymentStatus=N'Paid' WHERE Id=2;")]
    [InlineData("completed-payment-booking-not-paid","UPDATE dbo.Bookings SET PaymentStatus=N'Unpaid' WHERE Id=1;")]
    [InlineData("invalid-payment-amount","UPDATE dbo.Payments SET TotalAmount=0 WHERE Id=2;")]
    [InlineData("invalid-payment-amount","ALTER TABLE dbo.Payments ALTER COLUMN TotalAmount decimal(18,2) NULL; UPDATE dbo.Payments SET TotalAmount=NULL WHERE Id=2;")]
    [InlineData("invalid-fee-breakdown","UPDATE dbo.Payments SET ServiceCharge=-1 WHERE Id=2;")]
    [InlineData("unsupported-payment-currency","UPDATE dbo.Payments SET Currency=N'USD' WHERE Id=2;")]
    [InlineData("unsupported-payment-currency","UPDATE dbo.Payments SET Currency=N'' WHERE Id=2;")]
    [InlineData("unsupported-payment-currency","ALTER TABLE dbo.Payments ALTER COLUMN Currency nvarchar(10) NULL; UPDATE dbo.Payments SET Currency=NULL WHERE Id=2;")]
    [InlineData("orphan-payment","ALTER TABLE dbo.Payments NOCHECK CONSTRAINT FK_Payments_Bookings_BookingId; UPDATE dbo.Payments SET BookingId=999 WHERE Id=2;")]
    [InlineData("suspicious-payment-status","UPDATE dbo.Payments SET Status=N'Unknown' WHERE Id=2;")]
    [InlineData("suspicious-booking-paymentstatus","UPDATE dbo.Bookings SET PaymentStatus=N'Unknown' WHERE Id=2;")]
    [InlineData("completed-receipt-incomplete","UPDATE dbo.Payments SET PaidAt=NULL WHERE Id=1;")]
    [InlineData("payment-column-type:TotalAmount","ALTER TABLE dbo.Payments ALTER COLUMN TotalAmount decimal(18,4) NOT NULL;")]
    [InlineData("unrecognized-payment-schema-version","EXEC sys.sp_addextendedproperty @name=N'KarigorPaymentSchemaVersion',@value=2,@level0type=N'SCHEMA',@level0name=N'dbo',@level1type=N'TABLE',@level1name=N'Payments';")]
    public async Task InvalidFinancialHistoryIsReportedAndNeverAutoCorrected(string expected,string dirty)
    {
        await using var db=new DisposableSqlDatabase(); await db.InitializeAsync(applyPayment:false);
        using var c=new SqlConnection(db.ConnectionString); await c.OpenAsync();
        await Execute(c,AuditedPaymentSql); await Execute(c,SeedBookings); await Execute(c,SeedPayments); await Execute(c,dirty);
        var before=await Snapshot(c); var script=await Script(db);
        Assert.Contains(expected,await Preflight(c,script));
        var error=await Assert.ThrowsAsync<SqlException>(()=>Apply(c,script)); Assert.Equal(51060,error.Number);
        Assert.Equal(before,await Snapshot(c));
        await using var context=Context(db); Assert.Equal(51061,Assert.Throws<SqlException>(()=>PaymentSchemaGate.Verify(context)).Number);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task MissingServiceChargeIsAddedOnlyWhenNoHistoricalPaymentExists(bool populated)
    {
        await using var db=new DisposableSqlDatabase(); await db.InitializeAsync(applyPayment:false);
        using var c=new SqlConnection(db.ConnectionString); await c.OpenAsync();
        await Execute(c,AuditedPaymentSql); await Execute(c,SeedBookings); if(populated) await Execute(c,SeedPayments);
        await DropDefault(c,"Payments","ServiceCharge"); await Execute(c,"ALTER TABLE dbo.Payments DROP COLUMN ServiceCharge;");
        var script=await Script(db);
        if(populated)
        {
            var before=await Snapshot(c); Assert.Contains("missing-servicecharge-history",await Preflight(c,script));
            Assert.Equal(51060,(await Assert.ThrowsAsync<SqlException>(()=>Apply(c,script))).Number);
            Assert.Equal(before,await Snapshot(c));
        }
        else
        {
            Assert.Empty(await Preflight(c,script)); await Apply(c,script);
            await using var context=Context(db); PaymentSchemaGate.Verify(context);
        }
    }

    [Fact]
    public async Task ExistingBookingsWithoutPaymentStatusRequireReviewInsteadOfInventedUnpaidHistory()
    {
        await using var db=new DisposableSqlDatabase(); await db.InitializeAsync(applyPayment:false);
        using var c=new SqlConnection(db.ConnectionString); await c.OpenAsync(); await Execute(c,SeedBookings);
        var script=await Script(db); Assert.Contains("missing-booking-paymentstatus-history",await Preflight(c,script));
        Assert.Equal(51060,(await Assert.ThrowsAsync<SqlException>(()=>Apply(c,script))).Number);
        using var command=c.CreateCommand(); command.CommandText="SELECT COL_LENGTH(N'dbo.Bookings',N'PaymentStatus')";
        Assert.Equal(DBNull.Value,await command.ExecuteScalarAsync());
    }

    [Fact]
    public async Task UnsupportedBookingPaymentStatusTypeIsReportedWithoutUnsafeFinancialQueries()
    {
        await using var db=new DisposableSqlDatabase(); await db.InitializeAsync(applyPayment:false);
        using var c=new SqlConnection(db.ConnectionString); await c.OpenAsync();
        await Execute(c,AuditedPaymentSql); await Execute(c,SeedBookings);
        await DropDefault(c,"Bookings","PaymentStatus");
        await Execute(c,"UPDATE dbo.Bookings SET PaymentStatus=N'0'; ALTER TABLE dbo.Bookings ALTER COLUMN PaymentStatus int NOT NULL;");
        var before=await Snapshot(c); var script=await Script(db);
        Assert.Contains("booking-paymentstatus-column-shape",await Preflight(c,script));
        Assert.Equal(51060,(await Assert.ThrowsAsync<SqlException>(()=>Apply(c,script))).Number);
        Assert.Equal(before,await Snapshot(c));
    }

    [Theory]
    [InlineData("missing-schema")]
    [InlineData("wrong-default")]
    [InlineData("wrong-index")]
    [InlineData("disabled-fk")]
    public async Task StartupGateRejectsDriftWithoutRepairingAnything(string variant)
    {
        await using var db=new DisposableSqlDatabase(); await db.InitializeAsync(applyPayment:variant!="missing-schema");
        using var c=new SqlConnection(db.ConnectionString); await c.OpenAsync();
        if(variant=="wrong-default") { await DropDefault(c,"Payments","Currency"); await Execute(c,"ALTER TABLE dbo.Payments ADD CONSTRAINT DF_Payments_Currency DEFAULT N'USD' FOR Currency;"); }
        if(variant=="wrong-index") await Execute(c,"DROP INDEX IX_Payments_Status ON dbo.Payments; CREATE INDEX IX_Payments_Status ON dbo.Payments(BookingId);");
        if(variant=="disabled-fk") await Execute(c,"ALTER TABLE dbo.Payments NOCHECK CONSTRAINT FK_Payments_Bookings_BookingId;");
        await using var context=Context(db);
        Assert.Equal(51061,Assert.Throws<SqlException>(()=>PaymentSchemaGate.Verify(context)).Number);
        Assert.Equal(51061,Assert.Throws<SqlException>(()=>PaymentSchemaGate.Verify(context)).Number);
        var program=await File.ReadAllTextAsync(Path.Combine(db.RepositoryRoot,"backend/Karigor.Api/Program.cs"));
        Assert.Contains("PaymentSchemaGate.Verify",program);
        Assert.DoesNotContain("CREATE TABLE [dbo].[Payments]",program);
        Assert.DoesNotContain("ADD [PaymentStatus]",program);
        Assert.DoesNotContain("ADD [ServiceCharge]",program);
    }

    [Fact]
    public async Task ActualApplicationStartupRefusesMissingPaymentSchemaAndDoesNotCreateIt()
    {
        var fixture=new SecurityApplicationFixture();
        try
        {
            await fixture.Database.InitializeAsync(applyPayment:false);
            Directory.CreateDirectory(fixture.UploadRoot);
            await using var factory=new SecurityApplicationFactory(fixture);
            var error=Assert.Throws<SqlException>(()=>factory.CreateClient());
            Assert.Equal(51061,error.Number);
            using var c=new SqlConnection(fixture.Database.ConnectionString); await c.OpenAsync();
            using var command=c.CreateCommand();
            command.CommandText="SELECT OBJECT_ID(N'dbo.Payments',N'U'),COL_LENGTH(N'dbo.Bookings',N'PaymentStatus')";
            using var reader=await command.ExecuteReaderAsync(); Assert.True(await reader.ReadAsync());
            Assert.True(reader.IsDBNull(0)); Assert.True(reader.IsDBNull(1));
        }
        finally { await fixture.DisposeAsync(); }
    }
}
