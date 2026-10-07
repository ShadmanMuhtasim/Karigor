using System.ComponentModel.DataAnnotations;
using System.Data;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Api.Administration;

/// <summary>Called only by the explicit operator command; no HTTP endpoint or ordinary startup call.</summary>
public sealed class AdminBootstrapper(KarigorDbContext db, UserManager<ApplicationUser> users, RoleManager<IdentityRole> roles)
{
    public async Task<string> CreateInitialAdministratorAsync(string email, string password)
    {
        email = email.Trim();
        if (email.Length > 256 || !new EmailAddressAttribute().IsValid(email) || string.IsNullOrEmpty(password))
            throw new InvalidOperationException("A valid email and nonempty password are required.");

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            // A retry must not reuse entities from a rolled-back creation attempt.
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            if (await users.FindByEmailAsync(email) is not null || await users.FindByNameAsync(email) is not null)
                throw new InvalidOperationException("The requested account already exists. Bootstrap never promotes an existing account.");

            await IdentityRoleSeeder.EnsureAsync(roles, "Admin");
            if ((await users.GetUsersInRoleAsync("Admin")).Count != 0)
                throw new InvalidOperationException("An administrator already exists. Initial bootstrap is closed.");

            var user = new ApplicationUser { UserName = email, Email = email };
            IdentityRoleSeeder.RequireSuccess(await users.CreateAsync(user, password), "Account creation");
            IdentityRoleSeeder.RequireSuccess(await users.AddToRoleAsync(user, "Admin"), "Administrator role assignment");
            await transaction.CommitAsync();
            return user.Id;
        });
    }
}
