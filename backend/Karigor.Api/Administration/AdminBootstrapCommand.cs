using System.Text;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Api.Administration;

public interface IAdminBootstrapInput
{
    bool IsInteractive { get; }
    string? ReadEmail();
    string ReadPassword(bool confirmation);
}

public static class AdminBootstrapCommand
{
    public static bool IsRequested(string[] args) => args.Length > 0 && args[0] == "bootstrap-admin";

    // The optional input/configuration/output are test seams, not command-line secret sources.
    public static async Task<int> RunAsync(string[] args, IAdminBootstrapInput? input = null,
        IConfiguration? configuration = null, TextWriter? output = null)
    {
        output ??= Console.Out;
        if (args.Length != 0)
        {
            await output.WriteLineAsync("bootstrap-admin accepts no arguments. Use its protected interactive prompt.");
            return 2;
        }
        input ??= new ConsoleBootstrapInput();
        if (!input.IsInteractive)
        {
            await output.WriteLineAsync("Bootstrap requires an interactive terminal. Passwords cannot be piped or passed as arguments.");
            return 2;
        }

        try
        {
            var email = input.ReadEmail();
            var password = input.ReadPassword(confirmation: false);
            var confirmation = input.ReadPassword(confirmation: true);
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrEmpty(password) || password != confirmation)
            {
                await output.WriteLineAsync("Email/password input is missing or password confirmation does not match.");
                return 2;
            }

            // Build a non-web service provider only. No JWT requirement, schema DDL, HTTP listener or hosted service start.
            var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
            { Args = [], ContentRootPath = AppContext.BaseDirectory });
            if (configuration is not null)
            {
                builder.Configuration.Sources.Clear();
                builder.Configuration.AddConfiguration(configuration);
            }
            builder.Logging.ClearProviders();
            var connection = builder.Configuration.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(connection))
                throw new InvalidOperationException("Database connection is not configured.");
            builder.Services.AddDbContext<KarigorDbContext>(options => options.UseSqlServer(connection,
                sql => { sql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(5), null); sql.CommandTimeout(30); }));
            builder.Services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequiredLength = 8;
                options.Password.RequireNonAlphanumeric = false;
                options.User.RequireUniqueEmail = true;
            }).AddRoles<IdentityRole>().AddEntityFrameworkStores<KarigorDbContext>();
            builder.Services.AddScoped<AdminBootstrapper>();

            using var host = builder.Build();
            using var scope = host.Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<AdminBootstrapper>().CreateInitialAdministratorAsync(email, password);
            await output.WriteLineAsync("Initial administrator created. The web server was not started.");
            return 0;
        }
        catch (Exception)
        {
            // Do not print exceptions, connection strings, Identity descriptions or passwords.
            await output.WriteLineAsync("Bootstrap did not confirm success. Check database configuration, account existence and Identity policy before retrying.");
            return 1;
        }
    }

    private sealed class ConsoleBootstrapInput : IAdminBootstrapInput
    {
        public bool IsInteractive => !Console.IsInputRedirected && !Console.IsOutputRedirected;
        public string? ReadEmail()
        {
            Console.Write("Administrator email: ");
            return Console.ReadLine();
        }
        public string ReadPassword(bool confirmation)
        {
            Console.Write(confirmation ? "Confirm password: " : "Password: ");
            var value = new StringBuilder();
            while (true)
            {
                var key = Console.ReadKey(intercept: true);
                if (key.Key == ConsoleKey.Enter) { Console.WriteLine(); return value.ToString(); }
                if (key.Key == ConsoleKey.Backspace && value.Length > 0) value.Length--;
                else if (!char.IsControl(key.KeyChar))
                {
                    if (value.Length >= 1024) throw new InvalidOperationException("Password input is too long.");
                    value.Append(key.KeyChar);
                }
            }
        }
    }
}
