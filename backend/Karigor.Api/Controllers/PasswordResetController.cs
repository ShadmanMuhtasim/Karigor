using System.ComponentModel.DataAnnotations;
using Karigor.Api.Email;
using Karigor.Application.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Karigor.Api.Controllers;

[ApiController, Route("api/auth"), AllowAnonymous, AuthCookieOrigin, RequestSizeLimit(16384)]
public sealed class PasswordResetController(PasswordResetEmailQueue queue, PasswordResetService reset,
    ILogger<PasswordResetController> logger) : ControllerBase
{
    [HttpPost("forgot-password"), EnableRateLimiting("PasswordResetLimiter")]
    public IActionResult Forgot(ForgotPasswordRequest request)
    {
        queue.Enqueue(request.Email);
        return Ok(new { message = PasswordResetService.GenericMessage });
    }

    [HttpPost("reset-password"), EnableRateLimiting("AuthLimiter")]
    public async Task<IActionResult> Reset(ResetPasswordRequest request)
    {
        try
        {
            var result = await reset.ResetAsync(request.Email, request.Token, request.NewPassword, request.ConfirmPassword);
            return result.Success ? Ok(new { message = result.Message }) : BadRequest(new { error = result.Message });
        }
        catch (Exception)
        {
            logger.LogError("Password reset could not complete. No credentials were returned.");
            return StatusCode(503, new { error = "Password reset is temporarily unavailable. Please try again later." });
        }
    }
}

public sealed record ForgotPasswordRequest(string? Email);
public sealed class ResetPasswordRequest
{
    [Required, EmailAddress, MaxLength(256)] public string Email { get; set; } = "";
    [Required, MaxLength(4096)] public string Token { get; set; } = "";
    [Required, MaxLength(1024)] public string NewPassword { get; set; } = "";
    [Required, MaxLength(1024)] public string ConfirmPassword { get; set; } = "";
}
