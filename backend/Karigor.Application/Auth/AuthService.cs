using Google.Apis.Auth;
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
    private readonly RefreshSessionService _sessions;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        KarigorDbContext db,
        ITokenService tokenService,
        IConfiguration config, RefreshSessionService sessions)
    {
        _userManager  = userManager;
        _db           = db;
        _tokenService = tokenService;
        _config       = config;
        _sessions = sessions;
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

        return await _sessions.CreateAsync(user.Id, user.SecurityStamp);
    }

    // -------------------------------------------------------------------------
    // Google OAuth Login
    // -------------------------------------------------------------------------
    public async Task<(AuthResultDto result, string rawRefreshToken)> GoogleLoginAsync(GoogleLoginDto dto)
    {
        GoogleJsonWebSignature.Payload googlePayload;
        try
        {
            var expectedClientId = _config["Authentication:Google:ClientId"]
                ?? _config["Google:ClientId"];

            var validationSettings = new GoogleJsonWebSignature.ValidationSettings
            {
                IssuedAtClockTolerance = TimeSpan.FromMinutes(10),
                ExpirationTimeClockTolerance = TimeSpan.FromMinutes(10)
            };
            if (!string.IsNullOrWhiteSpace(expectedClientId))
            {
                validationSettings.Audience = new[] { expectedClientId };
            }

            googlePayload = await GoogleJsonWebSignature.ValidateAsync(dto.IdToken, validationSettings);
        }
        catch (Exception ex)
        {
            throw new UnauthorizedAccessException($"Invalid Google authentication token: {ex.Message}");
        }

        if (string.IsNullOrWhiteSpace(googlePayload.Email))
        {
            throw new UnauthorizedAccessException("Google account must provide an email address.");
        }

        const string provider = "Google";
        var user = await _userManager.FindByLoginAsync(provider, googlePayload.Subject);

        if (user is null)
        {
            // Check if account with same email already exists (e.g. registered with password)
            user = await _userManager.FindByEmailAsync(googlePayload.Email);
            if (user is not null)
            {
                // Link Google to existing user account
                await _userManager.AddLoginAsync(user, new UserLoginInfo(provider, googlePayload.Subject, "Google"));
            }
        }

        // If user still doesn't exist, create a new user
        if (user is null)
        {
            var strategy = _db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _db.Database.BeginTransactionAsync();
                try
                {
                    var newUser = new ApplicationUser
                    {
                        UserName = googlePayload.Email,
                        Email = googlePayload.Email,
                        EmailConfirmed = googlePayload.EmailVerified
                    };

                    var createResult = await _userManager.CreateAsync(newUser);
                    if (!createResult.Succeeded)
                    {
                        throw new AuthValidationException(string.Join("; ", createResult.Errors.Select(e => e.Description)));
                    }

                    var role = string.Equals(dto.Role, "Worker", StringComparison.OrdinalIgnoreCase) ? "Worker" : "Customer";
                    await _userManager.AddToRoleAsync(newUser, role);

                    var addLoginResult = await _userManager.AddLoginAsync(newUser, new UserLoginInfo(provider, googlePayload.Subject, "Google"));
                    if (!addLoginResult.Succeeded)
                    {
                        throw new AuthValidationException(string.Join("; ", addLoginResult.Errors.Select(e => e.Description)));
                    }

                    if (role == "Customer")
                    {
                        _db.CustomerProfiles.Add(new CustomerProfile
                        {
                            UserId = newUser.Id,
                            FullName = string.IsNullOrWhiteSpace(googlePayload.Name) ? googlePayload.Email : googlePayload.Name,
                            Address = null,
                            ProfileImageUrl = googlePayload.Picture
                        });
                    }
                    else
                    {
                        _db.WorkerProfiles.Add(new WorkerProfile
                        {
                            UserId = newUser.Id,
                            Bio = "Professional artisan",
                            HourlyRate = 500,
                            ServiceRadiusKm = 10.0,
                            VerificationStatus = "Pending",
                            AverageRating = 0.0,
                            Categories = new List<ServiceCategory>()
                        });
                    }

                    await _db.SaveChangesAsync();

                    var authResult = await BuildAuthResultAsync(newUser);
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

        // Check if account is suspended
        if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow)
        {
            throw new UnauthorizedAccessException("Your account has been suspended by an administrator.");
        }

        // Update profile picture if missing and provided by Google
        if (!string.IsNullOrEmpty(googlePayload.Picture))
        {
            var customerProfile = await _db.CustomerProfiles.FirstOrDefaultAsync(c => c.UserId == user.Id);
            if (customerProfile != null && string.IsNullOrEmpty(customerProfile.ProfileImageUrl))
            {
                customerProfile.ProfileImageUrl = googlePayload.Picture;
                await _db.SaveChangesAsync();
            }
        }

        return await BuildAuthResultAsync(user);
    }

    // -------------------------------------------------------------------------
    // Refresh
    // -------------------------------------------------------------------------
    public Task<(AuthResultDto result, string rawRefreshToken)> RefreshAsync(string rawRefreshToken)
        => _sessions.RefreshAsync(rawRefreshToken);

    public Task LogoutAsync(string rawRefreshToken) => _sessions.LogoutAsync(rawRefreshToken);

    private Task<(AuthResultDto result, string rawRefreshToken)> BuildAuthResultAsync(ApplicationUser user)
        => _sessions.CreateAsync(user.Id);
}
