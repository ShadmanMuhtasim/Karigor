using Karigor.Application.Auth;
using Karigor.Application.Auth.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karigor.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private const string RefreshTokenCookieName = "karigor_rt";
    private const int RefreshTokenExpiryDays = 7;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    // POST /api/auth/register/customer
    [HttpPost("register/customer")]
    public async Task<IActionResult> RegisterCustomer([FromBody] RegisterCustomerDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var (result, rawRefreshToken) = await _authService.RegisterCustomerAsync(dto);
            SetRefreshCookie(rawRefreshToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    // POST /api/auth/register/worker
    [HttpPost("register/worker")]
    public async Task<IActionResult> RegisterWorker([FromBody] RegisterWorkerDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var (result, rawRefreshToken) = await _authService.RegisterWorkerAsync(dto);
            SetRefreshCookie(rawRefreshToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
    }

    // POST /api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var (result, rawRefreshToken) = await _authService.LoginAsync(dto);
            SetRefreshCookie(rawRefreshToken);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    // POST /api/auth/refresh
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var rawToken = Request.Cookies[RefreshTokenCookieName];
        if (string.IsNullOrEmpty(rawToken))
            return Unauthorized(new { error = "No refresh token cookie present." });

        try
        {
            var (result, newRawToken) = await _authService.RefreshAsync(rawToken);
            SetRefreshCookie(newRawToken);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
    }

    // POST /api/auth/logout
    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var rawToken = Request.Cookies[RefreshTokenCookieName];
        if (!string.IsNullOrEmpty(rawToken))
            await _authService.LogoutAsync(rawToken);

        // Clear the httpOnly refresh token cookie
        Response.Cookies.Delete(RefreshTokenCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure   = false,
            SameSite = SameSiteMode.Strict,
            Path     = "/"
        });

        return Ok(new { message = "Logged out successfully." });
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------
    private void SetRefreshCookie(string rawToken)
    {
        Response.Cookies.Append(RefreshTokenCookieName, rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure   = false,        // false for local HTTP dev
            SameSite = SameSiteMode.Strict,
            Expires  = DateTimeOffset.UtcNow.AddDays(RefreshTokenExpiryDays),
            Path     = "/"
        });
    }
}
