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
    private readonly ILogger<AuthController> _logger;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;
    private const string RefreshTokenCookieName = "karigor_rt";
    private const int RefreshTokenExpiryDays = 7;

    public AuthController(
        IAuthService authService,
        ILogger<AuthController> logger,
        IWebHostEnvironment env,
        IConfiguration config)
    {
        _authService = authService;
        _logger = logger;
        _env = env;
        _config = config;
    }

    // GET /api/auth/config
    [HttpGet("config")]
    [AllowAnonymous]
    public IActionResult GetAuthConfig()
    {
        var googleClientId = _config["Authentication:Google:ClientId"]
            ?? _config["Google:ClientId"]
            ?? string.Empty;

        return Ok(new
        {
            googleClientId
        });
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
        catch (AuthValidationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during customer registration for {Email}", dto.Email);
            return StatusCode(500, new { error = "Something went wrong while creating your account. Please try again in a moment." });
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
        catch (AuthValidationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during worker registration for {Email}", dto.Email);
            return StatusCode(500, new { error = "Something went wrong while creating your account. Please try again in a moment." });
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

    // POST /api/auth/google
    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var (result, rawRefreshToken) = await _authService.GoogleLoginAsync(dto);
            SetRefreshCookie(rawRefreshToken);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (AuthValidationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during Google login");
            return StatusCode(500, new { error = "Something went wrong while authenticating with Google. Please try again." });
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
        var isSecure = Request.IsHttps || !_env.IsDevelopment();
        Response.Cookies.Delete(RefreshTokenCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure   = isSecure,
            SameSite = SameSiteMode.Lax,
            Path     = "/"
        });

        return Ok(new { message = "Logged out successfully." });
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------
    private void SetRefreshCookie(string rawToken)
    {
        var isSecure = Request.IsHttps || !_env.IsDevelopment();
        Response.Cookies.Append(RefreshTokenCookieName, rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure   = isSecure,
            SameSite = SameSiteMode.Lax,
            Expires  = DateTimeOffset.UtcNow.AddDays(RefreshTokenExpiryDays),
            Path     = "/"
        });
    }
}
