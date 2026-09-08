using Karigor.Application.Auth.DTOs;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Karigor.Application.Auth;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser>  _userManager;
    private readonly KarigorDbContext              _db;
    private readonly ITokenService                 _tokenService;
    private readonly IConfiguration                _config;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        KarigorDbContext db,
        ITokenService tokenService,
        IConfiguration config)
    {
        _userManager  = userManager;
        _db           = db;
        _tokenService = tokenService;
        _config       = config;
    }

    // -------------------------------------------------------------------------
    // Register Customer
    // -------------------------------------------------------------------------
    public async Task<(AuthResultDto result, string rawRefreshToken)> RegisterCustomerAsync(RegisterCustomerDto dto)
    {
        if (await _userManager.FindByEmailAsync(dto.Email) is not null)
            throw new AuthValidationException("An account with that email already exists.");

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                var user = new ApplicationUser { UserName = dto.Email, Email = dto.Email };
                var createResult = await _userManager.CreateAsync(user, dto.Password);
                if (!createResult.Succeeded)
                    throw new AuthValidationException(string.Join("; ", createResult.Errors.Select(e => e.Description)));

                await _userManager.AddToRoleAsync(user, "Customer");

                _db.CustomerProfiles.Add(new CustomerProfile
                {
                    UserId          = user.Id,
                    FullName        = dto.FullName,
                    Address         = dto.Address,
                    ProfileImageUrl = null
                });
                await _db.SaveChangesAsync();

                var authResult = await BuildAuthResultAsync(user);
                await tx.CommitAsync();

                return authResult;
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        });
    }

    // -------------------------------------------------------------------------
    // Register Worker
    // -------------------------------------------------------------------------
    public async Task<(AuthResultDto result, string rawRefreshToken)> RegisterWorkerAsync(RegisterWorkerDto dto)
    {
        if (await _userManager.FindByEmailAsync(dto.Email) is not null)
            throw new AuthValidationException("An account with that email already exists.");

        if (dto.CategoryIds == null || dto.CategoryIds.Count == 0)
            throw new AuthValidationException("At least one category is required for worker registration.");

        var validCategoryIds = await _db.ServiceCategories
            .Where(c => dto.CategoryIds.Contains(c.Id))
            .Select(c => c.Id)
            .ToListAsync();

        var invalidIds = dto.CategoryIds.Except(validCategoryIds).ToList();
        if (invalidIds.Count > 0)
            throw new AuthValidationException($"Invalid category IDs: {string.Join(", ", invalidIds)}");

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                var user = new ApplicationUser { UserName = dto.Email, Email = dto.Email };
                var createResult = await _userManager.CreateAsync(user, dto.Password);
                if (!createResult.Succeeded)
                    throw new AuthValidationException(string.Join("; ", createResult.Errors.Select(e => e.Description)));

                await _userManager.AddToRoleAsync(user, "Worker");

                var categories = await _db.ServiceCategories
                    .Where(c => validCategoryIds.Contains(c.Id))
                    .ToListAsync();

                var workerProfile = new WorkerProfile
                {
                    UserId             = user.Id,
                    Bio                = dto.Bio,
                    HourlyRate         = dto.HourlyRate,
                    ServiceRadiusKm    = 10.0,
                    VerificationStatus = "Pending",
                    AverageRating      = 0.0,
                    Categories         = categories
                };
                _db.WorkerProfiles.Add(workerProfile);
                await _db.SaveChangesAsync();

                var authResult = await BuildAuthResultAsync(user);
                await tx.CommitAsync();

                return authResult;
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        });
    }

    // -------------------------------------------------------------------------
    // Login
    // -------------------------------------------------------------------------
    public async Task<(AuthResultDto result, string rawRefreshToken)> LoginAsync(LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email)
            ?? throw new UnauthorizedAccessException("Invalid email or password.");

        if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow)
            throw new UnauthorizedAccessException("Your account has been suspended by an administrator.");

        if (!await _userManager.CheckPasswordAsync(user, dto.Password))
            throw new UnauthorizedAccessException("Invalid email or password.");

        return await BuildAuthResultAsync(user);
    }

    // -------------------------------------------------------------------------
    // Refresh
    // -------------------------------------------------------------------------
    public async Task<(AuthResultDto result, string rawRefreshToken)> RefreshAsync(string rawRefreshToken)
    {
        var tokenHash = _tokenService.HashToken(rawRefreshToken);

        var storedToken = await _db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

        if (storedToken is null)
            throw new UnauthorizedAccessException("Invalid refresh token.");

        if (storedToken.User.LockoutEnd.HasValue && storedToken.User.LockoutEnd.Value > DateTimeOffset.UtcNow)
            throw new UnauthorizedAccessException("Your account has been suspended by an administrator.");

        if (storedToken.RevokedAt is not null)
        {
            // Grace window for concurrent requests during token rotation:
            // If the token was revoked within the last 60 seconds and has a replacement token,
            // return a valid access token to prevent concurrent race conditions from dropping the session.
            if (storedToken.RevokedAt.Value.AddSeconds(60) > DateTime.UtcNow && !string.IsNullOrEmpty(storedToken.ReplacedByToken))
            {
                var replacementToken = await _db.RefreshTokens
                    .FirstOrDefaultAsync(t => t.TokenHash == storedToken.ReplacedByToken && t.RevokedAt == null);

                if (replacementToken != null && replacementToken.ExpiresAt > DateTime.UtcNow)
                {
                    var activeRoles = await _userManager.GetRolesAsync(storedToken.User);
                    var (graceToken, graceExpiry) = _tokenService.GenerateAccessToken(storedToken.User, activeRoles);
                    var graceResult = new AuthResultDto
                    {
                        AccessToken       = graceToken,
                        UserId            = storedToken.UserId,
                        Email             = storedToken.User.Email!,
                        Role              = activeRoles.FirstOrDefault() ?? string.Empty,
                        AccessTokenExpiry = graceExpiry
                    };
                    return (graceResult, rawRefreshToken);
                }
            }

            throw new UnauthorizedAccessException("Refresh token has been revoked.");
        }

        if (storedToken.ExpiresAt <= DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token has expired.");

        // Revoke old token
        storedToken.RevokedAt = DateTime.UtcNow;

        // Issue new refresh token and record replacement linkage
        var newRaw  = _tokenService.GenerateRefreshToken();
        var newHash = _tokenService.HashToken(newRaw);
        storedToken.ReplacedByToken = newHash;

        var expiryDays = int.Parse(_config["Jwt:RefreshTokenExpiryDays"] ?? "7");
        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId    = storedToken.UserId,
            TokenHash = newHash,
            ExpiresAt = DateTime.UtcNow.AddDays(expiryDays),
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var roles = await _userManager.GetRolesAsync(storedToken.User);
        var (accessToken, expiry) = _tokenService.GenerateAccessToken(storedToken.User, roles);

        var authResult = new AuthResultDto
        {
            AccessToken       = accessToken,
            UserId            = storedToken.UserId,
            Email             = storedToken.User.Email!,
            Role              = roles.FirstOrDefault() ?? string.Empty,
            AccessTokenExpiry = expiry
        };

        return (authResult, newRaw);
    }

    // -------------------------------------------------------------------------
    // Logout
    // -------------------------------------------------------------------------
    public async Task LogoutAsync(string rawRefreshToken)
    {
        var tokenHash = _tokenService.HashToken(rawRefreshToken);
        var storedToken = await _db.RefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

        if (storedToken is not null && storedToken.RevokedAt is null)
        {
            storedToken.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        // Silently succeed even if token is not found — prevents enumeration
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------
    private async Task<(AuthResultDto result, string rawRefreshToken)> BuildAuthResultAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var (accessToken, expiry) = _tokenService.GenerateAccessToken(user, roles);

        var rawRefreshToken  = _tokenService.GenerateRefreshToken();
        var hashRefreshToken = _tokenService.HashToken(rawRefreshToken);
        var expiryDays       = int.Parse(_config["Jwt:RefreshTokenExpiryDays"] ?? "7");

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId    = user.Id,
            TokenHash = hashRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(expiryDays),
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var authResult = new AuthResultDto
        {
            AccessToken       = accessToken,
            UserId            = user.Id,
            Email             = user.Email!,
            Role              = roles.FirstOrDefault() ?? string.Empty,
            AccessTokenExpiry = expiry
        };

        return (authResult, rawRefreshToken);
    }
}
