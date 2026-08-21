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
            throw new InvalidOperationException("An account with that email already exists.");

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var user = new ApplicationUser { UserName = dto.Email, Email = dto.Email };
            var createResult = await _userManager.CreateAsync(user, dto.Password);
            if (!createResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", createResult.Errors.Select(e => e.Description)));

            await _userManager.AddToRoleAsync(user, "Customer");

            _db.CustomerProfiles.Add(new CustomerProfile
            {
                UserId          = user.Id,
                FullName        = dto.FullName,
                Address         = dto.Address,
                ProfileImageUrl = null
            });
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return await BuildAuthResultAsync(user);
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    // -------------------------------------------------------------------------
    // Register Worker
    // -------------------------------------------------------------------------
    public async Task<(AuthResultDto result, string rawRefreshToken)> RegisterWorkerAsync(RegisterWorkerDto dto)
    {
        if (await _userManager.FindByEmailAsync(dto.Email) is not null)
            throw new InvalidOperationException("An account with that email already exists.");

        if (dto.CategoryIds == null || dto.CategoryIds.Count == 0)
            throw new InvalidOperationException("At least one category is required for worker registration.");

        var validCategoryIds = await _db.ServiceCategories
            .Where(c => dto.CategoryIds.Contains(c.Id))
            .Select(c => c.Id)
            .ToListAsync();

        var invalidIds = dto.CategoryIds.Except(validCategoryIds).ToList();
        if (invalidIds.Count > 0)
            throw new InvalidOperationException($"Invalid category IDs: {string.Join(", ", invalidIds)}");

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var user = new ApplicationUser { UserName = dto.Email, Email = dto.Email };
            var createResult = await _userManager.CreateAsync(user, dto.Password);
            if (!createResult.Succeeded)
                throw new InvalidOperationException(string.Join("; ", createResult.Errors.Select(e => e.Description)));

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
            await tx.CommitAsync();

            return await BuildAuthResultAsync(user);
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    // -------------------------------------------------------------------------
    // Login
    // -------------------------------------------------------------------------
    public async Task<(AuthResultDto result, string rawRefreshToken)> LoginAsync(LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email)
            ?? throw new UnauthorizedAccessException("Invalid email or password.");

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

        if (storedToken.RevokedAt is not null)
            throw new UnauthorizedAccessException("Refresh token has been revoked.");

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
