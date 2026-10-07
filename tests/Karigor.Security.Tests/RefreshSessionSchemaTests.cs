using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Security.Tests;

[Trait("Finding", "F6"), Trait("Layer", "SQL")]
public sealed class RefreshSessionSchemaTests
{
    private static Task<int> Sql(DisposableSqlDatabase database, string sql)
    {
        return Run();
        async Task<int> Run()
        {
            await using var connection = new SqlConnection(database.ConnectionString); await connection.OpenAsync();
            await using var command = connection.CreateCommand(); command.CommandText = sql;
            return await command.ExecuteNonQueryAsync();
        }
    }
    private static async Task Apply(DisposableSqlDatabase db, bool acknowledge = true) => await Sql(db,
        "EXEC sys.sp_set_session_context @key=N'KarigorF6Apply',@value=1;\n" +
        (acknowledge ? "EXEC sys.sp_set_session_context @key=N'KarigorF6ForceSignInReset',@value=1;\n" : "") +
        await File.ReadAllTextAsync(Path.Combine(db.RepositoryRoot, "database/production/008_refresh_session_authority.sql")));
    private static KarigorDbContext Context(DisposableSqlDatabase db) => new(new DbContextOptionsBuilder<KarigorDbContext>()
        .UseSqlServer(db.ConnectionString).Options);

    [Fact]
    public async Task DefaultPreflightDoesNotMutateAndResetRequiresExplicitAcknowledgement()
    {
        await using var db = new DisposableSqlDatabase(); await db.InitializeAsync(applyF6: false);
        await Sql(db, await File.ReadAllTextAsync(Path.Combine(db.RepositoryRoot, "database/production/008_refresh_session_authority.sql")));
        await using var context = Context(db);
        Assert.Throws<SqlException>(() => RefreshSessionSchemaGate.Verify(context));
        Assert.Equal(51064, (await Assert.ThrowsAsync<SqlException>(() => Apply(db, false))).Number);
        await Apply(db); RefreshSessionSchemaGate.Verify(context); await Apply(db); RefreshSessionSchemaGate.Verify(context);
        Assert.Empty(await context.RefreshSessions.ToArrayAsync());
    }

    [Fact]
    public async Task LegacyRowsAreRevokedWithoutInventingFamiliesOrDeletingHistory()
    {
        await using var db = new DisposableSqlDatabase(); await db.InitializeAsync(applyF6: false);
        await Sql(db, """
            INSERT dbo.AspNetUsers(Id,UserName,Email,EmailConfirmed,PhoneNumberConfirmed,TwoFactorEnabled,LockoutEnabled,AccessFailedCount)
              VALUES(N'legacy',N'legacy@fixture.invalid',N'legacy@fixture.invalid',0,0,0,0,0);
            INSERT dbo.RefreshTokens(TokenHash,UserId,CreatedAt,ExpiresAt)
              VALUES(REPLICATE(N'a',64),N'legacy',SYSUTCDATETIME(),DATEADD(day,7,SYSUTCDATETIME()));
            """);
        await Apply(db);
        await using var context = Context(db);
        var token = Assert.Single(await context.RefreshTokens.ToArrayAsync());
        Assert.NotNull(token.RevokedAt); Assert.Null(token.SessionId); Assert.Null(token.ParentTokenId);
        Assert.Equal(new string('a',64), token.TokenHash); Assert.Empty(await context.RefreshSessions.ToArrayAsync());
        await Assert.ThrowsAsync<SqlException>(() => Sql(db,"INSERT dbo.RefreshTokens(TokenHash,UserId,CreatedAt,ExpiresAt) VALUES(REPLICATE(N'b',64),N'legacy',SYSUTCDATETIME(),DATEADD(day,7,SYSUTCDATETIME()))"));
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public async Task MalformedOrDuplicateLegacyHashesRefuseMigration(bool duplicate)
    {
        await using var db = new DisposableSqlDatabase(); await db.InitializeAsync(applyF6: false);
        await Sql(db,"""
            INSERT dbo.AspNetUsers(Id,EmailConfirmed,PhoneNumberConfirmed,TwoFactorEnabled,LockoutEnabled,AccessFailedCount) VALUES(N'legacy',0,0,0,0,0);
            INSERT dbo.RefreshTokens(TokenHash,UserId,CreatedAt,ExpiresAt) VALUES(REPLICATE(N'a',64),N'legacy',SYSUTCDATETIME(),DATEADD(day,7,SYSUTCDATETIME()));
            """ + (duplicate ? "INSERT dbo.RefreshTokens(TokenHash,UserId,CreatedAt,ExpiresAt) SELECT TokenHash,UserId,CreatedAt,ExpiresAt FROM dbo.RefreshTokens;" :
            "UPDATE dbo.RefreshTokens SET TokenHash=N'not-a-hash';"));
        var error = await Assert.ThrowsAsync<SqlException>(() => Apply(db)); Assert.Equal(duplicate ? 51063 : 51062, error.Number);
        await Sql(db,"IF EXISTS(SELECT 1 FROM dbo.RefreshTokens WHERE RevokedAt IS NOT NULL) THROW 51999,'Unexpected legacy mutation',1;");
    }

    [Theory]
    [InlineData("DROP INDEX UX_F6_ActiveToken ON dbo.RefreshTokens")]
    [InlineData("ALTER TABLE dbo.RefreshTokens NOCHECK CONSTRAINT CK_F6_Legacy_Revoked")]
    [InlineData("DROP INDEX UX_F6_Parent ON dbo.RefreshTokens; CREATE UNIQUE INDEX UX_F6_Parent ON dbo.RefreshTokens(TokenHash) WHERE ParentTokenId IS NOT NULL")]
    public async Task StartupRejectsMissingDisabledOrMisdefinedAuthority(string drift)
    {
        await using var db = new DisposableSqlDatabase(); await db.InitializeAsync();
        await using var context = Context(db); RefreshSessionSchemaGate.Verify(context);
        await Sql(db, drift); Assert.Equal(51065, Assert.Throws<SqlException>(() => RefreshSessionSchemaGate.Verify(context)).Number);
    }

    [Fact]
    public async Task SqlEnforcesSingleSuccessorSingleUnconsumedTokenAndSameFamilyLineage()
    {
        await using var db = new DisposableSqlDatabase(); await db.InitializeAsync();
        await Sql(db,"""
            INSERT dbo.AspNetUsers(Id,EmailConfirmed,PhoneNumberConfirmed,TwoFactorEnabled,LockoutEnabled,AccessFailedCount) VALUES(N'fixture',0,0,0,0,0);
            DECLARE @one uniqueidentifier=NEWID(), @two uniqueidentifier=NEWID();
            INSERT dbo.RefreshSessions(Id,UserId,CreatedAt,ExpiresAt) VALUES(@one,N'fixture',SYSUTCDATETIME(),DATEADD(day,7,SYSUTCDATETIME())),(@two,N'fixture',SYSUTCDATETIME(),DATEADD(day,7,SYSUTCDATETIME()));
            INSERT dbo.RefreshTokens(TokenHash,UserId,SessionId,CreatedAt,ExpiresAt,RevokedAt) VALUES(REPLICATE(N'a',64),N'fixture',@one,SYSUTCDATETIME(),DATEADD(day,7,SYSUTCDATETIME()),SYSUTCDATETIME());
            DECLARE @parent int=SCOPE_IDENTITY();
            INSERT dbo.RefreshTokens(TokenHash,UserId,SessionId,CreatedAt,ExpiresAt,ParentTokenId) VALUES(REPLICATE(N'b',64),N'fixture',@one,SYSUTCDATETIME(),DATEADD(day,7,SYSUTCDATETIME()),@parent);
            """);
        await Assert.ThrowsAsync<SqlException>(() => Sql(db,"INSERT dbo.RefreshTokens(TokenHash,UserId,SessionId,CreatedAt,ExpiresAt) SELECT REPLICATE(N'c',64),UserId,SessionId,CreatedAt,ExpiresAt FROM dbo.RefreshTokens WHERE ParentTokenId IS NOT NULL"));
        await Assert.ThrowsAsync<SqlException>(() => Sql(db,"INSERT dbo.RefreshTokens(TokenHash,UserId,SessionId,CreatedAt,ExpiresAt,ParentTokenId,RevokedAt) SELECT REPLICATE(N'c',64),UserId,SessionId,CreatedAt,ExpiresAt,ParentTokenId,SYSUTCDATETIME() FROM dbo.RefreshTokens WHERE ParentTokenId IS NOT NULL"));
        await Assert.ThrowsAsync<SqlException>(() => Sql(db,"INSERT dbo.RefreshTokens(TokenHash,UserId,SessionId,CreatedAt,ExpiresAt,ParentTokenId,RevokedAt) SELECT REPLICATE(N'c',64),s.UserId,s.Id,s.CreatedAt,s.ExpiresAt,t.Id,SYSUTCDATETIME() FROM dbo.RefreshSessions s CROSS JOIN dbo.RefreshTokens t WHERE s.Id<>t.SessionId AND t.ParentTokenId IS NOT NULL"));
        await using var context = Context(db); Assert.Equal(2, await context.RefreshTokens.CountAsync());
    }
}
