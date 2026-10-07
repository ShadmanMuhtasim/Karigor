using Microsoft.AspNetCore.Identity;

namespace Karigor.Api.Administration;

public static class IdentityRoleSeeder
{
    public static async Task EnsureAsync(RoleManager<IdentityRole> roles, params string[] names)
    {
        foreach (var name in names)
        {
            if (await roles.RoleExistsAsync(name)) continue;
            RequireSuccess(await roles.CreateAsync(new IdentityRole(name)), "Role creation");
        }
    }

    public static void RequireSuccess(IdentityResult result, string operation)
    {
        if (!result.Succeeded)
            // Do not include descriptions or input values: validators can mention sensitive input.
            throw new InvalidOperationException($"{operation} failed. Check Identity policy and database configuration.");
    }
}
