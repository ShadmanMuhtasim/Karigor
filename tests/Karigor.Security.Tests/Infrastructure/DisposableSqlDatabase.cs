using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace Karigor.Security.Tests.Infrastructure;

/// <summary>Never accepts an application database or a remote server.</summary>
public sealed class DisposableSqlDatabase : IAsyncDisposable
{
    public const string Prefix = "Karigor_SecurityTests_";
    public string Name { get; } = Prefix + Guid.NewGuid().ToString("N");
    private readonly string adminConnection;
    private bool created;
    public string ConnectionString { get; }
    public string RepositoryRoot { get; }

    public DisposableSqlDatabase()
    {
        var configured = Environment.GetEnvironmentVariable("KARIGOR_TEST_SQLSERVER")
            ?? @"Server=.\SQLEXPRESS;Initial Catalog=master;Integrated Security=true;TrustServerCertificate=true;Connect Timeout=5";
        adminConnection = ValidateAdminConnection(configured);
        var builder = new SqlConnectionStringBuilder(adminConnection) { InitialCatalog = Name };
        ConnectionString = builder.ConnectionString;
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Karigor.slnx")))
            directory = directory.Parent;
        RepositoryRoot = directory?.FullName ?? throw new InvalidOperationException("Cannot find Karigor.slnx.");
    }

    public static string ValidateAdminConnection(string value)
    {
        var builder = new SqlConnectionStringBuilder(value);
        var server = builder.DataSource;
        if (server.StartsWith("tcp:", StringComparison.OrdinalIgnoreCase)) server = server[4..];
        if (!Regex.IsMatch(server, @"^(\.|\(local\)|localhost|127\.0\.0\.1)(\\[A-Za-z0-9_]+|,[0-9]+)?$", RegexOptions.IgnoreCase))
            throw new InvalidOperationException("Security tests require a loopback SQL Server, never a remote database.");
        if (!string.IsNullOrEmpty(builder.InitialCatalog) &&
            !builder.InitialCatalog.Equals("master", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Provide the local master connection; the fixture generates its own database.");
        builder.InitialCatalog = "master";
        builder.Pooling = false;
        return builder.ConnectionString;
    }

    public async Task InitializeAsync(bool applyF5 = true)
    {
        // Readiness retry is not a concurrency-test synchronization mechanism.
        using var admin = new SqlConnection(adminConnection);
        for (var attempt = 0; ; attempt++)
        {
            try { await admin.OpenAsync(); break; }
            catch (SqlException) when (attempt < 29) { await Task.Delay(TimeSpan.FromSeconds(1)); }
        }
        using (var command = admin.CreateCommand())
        {
            command.CommandText = $"CREATE DATABASE [{Name}]";
            await command.ExecuteNonQueryAsync();
            created = true;
        }

        // Mirrors current deployment: production schema, then real Program.cs startup DDL.
        // Never run 004_add_payments.sql: it contains USE [KarigorDev].
        var script = await File.ReadAllTextAsync(Path.Combine(RepositoryRoot, "database/production/001_schema.sql"));
        var executable = Regex.Replace(script, @"--[^\r\n]*|/\*[\s\S]*?\*/", "");
        if (Regex.IsMatch(executable, @"^\s*(USE\b|(?:CREATE|ALTER|DROP)\s+DATABASE\b)", RegexOptions.Multiline | RegexOptions.IgnoreCase))
            throw new InvalidOperationException("Schema script contains unsafe database targeting.");
        using var database = new SqlConnection(ConnectionString);
        await database.OpenAsync();
        foreach (var batch in Regex.Split(script, @"^\s*GO\s*\r?$", RegexOptions.Multiline | RegexOptions.IgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(batch)) continue;
            using var command = database.CreateCommand();
            command.CommandText = batch;
            command.CommandTimeout = 30;
            await command.ExecuteNonQueryAsync();
        }
        if (applyF5)
        {
            using var command = database.CreateCommand();
            command.CommandText = "EXEC sys.sp_set_session_context @key=N'KarigorF5Apply', @value=1;\n" +
                await File.ReadAllTextAsync(Path.Combine(RepositoryRoot, "database/production/005_f5_negotiation_integrity.sql"));
            await command.ExecuteNonQueryAsync();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (!created) return;
        if (!Regex.IsMatch(Name, "^" + Prefix + "[a-f0-9]{32}$"))
            throw new InvalidOperationException("Refusing to drop a non-fixture database.");
        using var connection = new SqlConnection(adminConnection);
        await connection.OpenAsync();
        using var command = connection.CreateCommand();
        command.CommandText = $"ALTER DATABASE [{Name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{Name}]";
        await command.ExecuteNonQueryAsync();
        created = false;
    }
}
