using System;
using System.Security.Claims;
using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading.Tasks;
using Karigor.Application.Payments;
using Karigor.Application.Payments.DTOs;
using Karigor.Application.Payments.SslCommerz;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Karigor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("AuthenticatedLimiter")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly SslCommerzOptions _sslOptions;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        IPaymentService paymentService,
        IOptions<SslCommerzOptions> sslOptions,
        ILogger<PaymentsController> logger)
    {
        _paymentService = paymentService;
        _sslOptions = sslOptions.Value;
        _logger = logger;
    }

    private string CurrentUserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException("User not authenticated.");

    /// <summary>
    /// Initiates an SSLCommerz payment session for a completed booking.
    /// Only the customer who owns the booking can initiate payment.
    /// </summary>
    [HttpPost("initiate")]
    [Authorize(Roles = "Customer")]
    public async Task<ActionResult<InitiatePaymentResponseDto>> InitiatePayment([FromBody] InitiatePaymentRequestDto dto)
    {
        // Infer public base URL if ngrok or reverse proxy is used
        string? appBaseUrl = null;
        if (!string.IsNullOrWhiteSpace(_sslOptions.AppBaseUrl))
        {
            appBaseUrl = _sslOptions.AppBaseUrl;
        }
        else
        {
            appBaseUrl = $"{Request.Scheme}://{Request.Host}";
        }

        Response.Headers.CacheControl = "no-store";
        try
        {
            var result = await _paymentService.InitiatePaymentAsync(CurrentUserId, dto.BookingId, appBaseUrl);
            return result.InitiationState == "Ready" && result.GatewayUrl.Length > 0
                ? Ok(result) : Accepted(result);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (KeyNotFoundException) { return NotFound(new { message = "Booking not found." }); }
        catch (PaymentConflictException ex) { return Conflict(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) when (ex is Microsoft.EntityFrameworkCore.DbUpdateException or Microsoft.Data.SqlClient.SqlException)
        {
            return StatusCode(503, new { message = "Payment initiation is unresolved. Check booking payment status before retrying." });
        }
    }

    // Route names are hints. Every route uses the same independent verification boundary.
    [HttpPost("sslcommerz/success"), HttpGet("sslcommerz/success"), AllowAnonymous]
    public Task<IActionResult> SslCommerzSuccess([FromForm] SslCommerzCallbackDto? callback)
        => ProcessBrowserCallbackAsync(callback, _paymentService.ProcessSuccessCallbackAsync);

    [HttpPost("sslcommerz/fail"), HttpGet("sslcommerz/fail"), AllowAnonymous]
    public Task<IActionResult> SslCommerzFail([FromForm] SslCommerzCallbackDto? callback)
        => ProcessBrowserCallbackAsync(callback, _paymentService.ProcessFailCallbackAsync);

    [HttpPost("sslcommerz/cancel"), HttpGet("sslcommerz/cancel"), AllowAnonymous]
    public Task<IActionResult> SslCommerzCancel([FromForm] SslCommerzCallbackDto? callback)
        => ProcessBrowserCallbackAsync(callback, _paymentService.ProcessCancelCallbackAsync);

    private async Task<IActionResult> ProcessBrowserCallbackAsync(SslCommerzCallbackDto? callback,
        Func<SslCommerzCallbackDto, Task<PaymentDetailsDto>> process)
    {
        callback ??= new SslCommerzCallbackDto();
        PopulateFromRequest(callback);
        Response.Headers.CacheControl = "no-store";
        var query = new Dictionary<string, string?> { ["status"] = "pending" };
        var verified = false;
        try
        {
            var payment = await process(callback);
            verified = string.Equals(payment.Status, "Completed", StringComparison.OrdinalIgnoreCase);
            query["status"] = verified ? "success" : "pending";
            query["bookingId"] = payment.BookingId.ToString(CultureInfo.InvariantCulture);
            query["tranId"] = payment.TransactionId;
        }
        catch (PaymentVerificationException ex)
        {
            // This ID came from the exact stored attempt, not ValueA. The return API still checks ownership.
            query["bookingId"] = ex.BookingId.ToString(CultureInfo.InvariantCulture);
            _logger.LogWarning("Browser payment verification unresolved: {Reason}", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Browser payment callback unresolved: {ErrorType}", ex.GetType().Name);
        }

        var redirectUrl = QueryHelpers.AddQueryString(
            $"{_sslOptions.ClientBaseUrl.TrimEnd('/')}/payment/callback", query);
        return RenderRedirectHtml(verified ? "Payment Confirmed" : "Payment Not Confirmed",
            verified ? "Karigor has a completed payment record. Returning to Karigor..."
                     : "Payment confirmation is unresolved. Check your booking status before attempting another payment.",
            redirectUrl, verified);
    }

    private void PopulateFromRequest(SslCommerzCallbackDto callback)
    {
        if (Request.HasFormContentType)
        {
            var form = Request.Form;
            if (string.IsNullOrWhiteSpace(callback.TranId) && form.TryGetValue("tran_id", out var tranId))
                callback.TranId = tranId;
            if (string.IsNullOrWhiteSpace(callback.ValId) && form.TryGetValue("val_id", out var valId))
                callback.ValId = valId;
            if (string.IsNullOrWhiteSpace(callback.Amount) && form.TryGetValue("amount", out var amount))
                callback.Amount = amount;
            if (string.IsNullOrWhiteSpace(callback.CardType) && form.TryGetValue("card_type", out var cardType))
                callback.CardType = cardType;
            if (string.IsNullOrWhiteSpace(callback.BankTranId) && form.TryGetValue("bank_tran_id", out var bankTranId))
                callback.BankTranId = bankTranId;
            if (string.IsNullOrWhiteSpace(callback.Status) && form.TryGetValue("status", out var status))
                callback.Status = status;
            if (string.IsNullOrWhiteSpace(callback.ValueA) && form.TryGetValue("value_a", out var valueA))
                callback.ValueA = valueA;
        }

        if (Request.Query.Count > 0)
        {
            var query = Request.Query;
            if (string.IsNullOrWhiteSpace(callback.TranId) && query.TryGetValue("tran_id", out var tranId))
                callback.TranId = tranId;
            if (string.IsNullOrWhiteSpace(callback.ValId) && query.TryGetValue("val_id", out var valId))
                callback.ValId = valId;
            if (string.IsNullOrWhiteSpace(callback.Amount) && query.TryGetValue("amount", out var amount))
                callback.Amount = amount;
            if (string.IsNullOrWhiteSpace(callback.CardType) && query.TryGetValue("card_type", out var cardType))
                callback.CardType = cardType;
            if (string.IsNullOrWhiteSpace(callback.BankTranId) && query.TryGetValue("bank_tran_id", out var bankTranId))
                callback.BankTranId = bankTranId;
            if (string.IsNullOrWhiteSpace(callback.Status) && query.TryGetValue("status", out var status))
                callback.Status = status;
            if (string.IsNullOrWhiteSpace(callback.ValueA) && query.TryGetValue("value_a", out var valueA))
                callback.ValueA = valueA;
        }
    }

    private ContentResult RenderRedirectHtml(string title, string message, string redirectUrl, bool isSuccess)
    {
        var icon = isSuccess ? "✓" : "✕";
        var iconBg = isSuccess ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)";
        var iconBorder = isSuccess ? "#10b981" : "#f43f5e";
        var iconColor = isSuccess ? "#10b981" : "#f43f5e";
        var btnGradient = isSuccess ? "linear-gradient(135deg, #059669, #0d9488)" : "linear-gradient(135deg, #e11d48, #be123c)";

        var encodedUrl = HtmlEncoder.Default.Encode(redirectUrl);
        var scriptUrl = JsonSerializer.Serialize(redirectUrl);
        var html = $@"<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""utf-8"" />
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"" />
    <meta http-equiv=""refresh"" content=""0;url={encodedUrl}"" />
    <title>{title} - Karigor</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #0b0f19;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 1.5rem;
        }}
        .card {{
            background: #151d2f;
            border: 1px solid #1e293b;
            border-radius: 1.5rem;
            padding: 2.5rem 2rem;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        }}
        .icon {{
            width: 68px;
            height: 68px;
            background: {iconBg};
            border: 2px solid {iconBorder};
            color: {iconColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.25rem;
            font-weight: 800;
            margin: 0 auto 1.25rem auto;
        }}
        h1 {{ font-size: 1.35rem; font-weight: 800; margin: 0 0 0.5rem 0; letter-spacing: -0.02em; }}
        p {{ color: #94a3b8; font-size: 0.875rem; margin: 0 0 1.75rem 0; line-height: 1.5; }}
        .btn {{
            display: block;
            width: 100%;
            padding: 0.85rem 1.5rem;
            background: {btnGradient};
            color: #ffffff;
            font-weight: 700;
            font-size: 0.875rem;
            border-radius: 0.85rem;
            text-decoration: none;
            box-shadow: 0 4px 14px rgba(0,0,0,0.3);
            transition: opacity 0.15s ease;
        }}
        .btn:hover {{ opacity: 0.92; }}
    </style>
</head>
<body>
    <div class=""card"">
        <div class=""icon"">{icon}</div>
        <h1>{title}</h1>
        <p>{message}</p>
        <a href=""{encodedUrl}"" class=""btn"">Return to Karigor Dashboard →</a>
    </div>
    <script>
        try {{
            window.location.replace({scriptUrl});
        }} catch (e) {{
            window.location.href = {scriptUrl};
        }}
    </script>
</body>
</html>";
        return Content(html, "text/html", System.Text.Encoding.UTF8);
    }

    /// <summary>
    /// Instant Payment Notification (IPN) server-to-server webhook from SSLCommerz.
    /// </summary>
    [HttpPost("sslcommerz/ipn")]
    [AllowAnonymous]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> SslCommerzIpn([FromForm] SslCommerzCallbackDto callback)
    {
        try
        {
            var payment = await _paymentService.ProcessIpnAsync(callback);
            return Ok(new { message = "Verified payment recorded", transactionId = payment.TransactionId, status = payment.Status });
        }
        catch (PaymentVerificationException ex)
        {
            if (ex.Retryable) Response.Headers.RetryAfter = "30";
            return StatusCode(ex.Retryable ? 503 : 422, new { error = ex.Message, status = "unresolved" });
        }
        catch (ArgumentException)
        {
            return BadRequest(new { error = "Transaction identifier is required.", status = "unresolved" });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Payment transaction not found.", status = "unresolved" });
        }
        catch (Exception ex)
        {
            _logger.LogError("IPN processing unresolved: {ErrorType}", ex.GetType().Name);
            return StatusCode(503, new { error = "Payment processing is unavailable.", status = "unresolved" });
        }
    }

    /// <summary>
    /// Retrieves the payment details for a specific booking.
    /// </summary>
    [HttpGet("booking/{bookingId:int}")]
    [Authorize]
    public async Task<ActionResult<PaymentDetailsDto>> GetBookingPayment(int bookingId)
    {
        Response.Headers.CacheControl = "no-store";
        try
        {
            var payment = await _paymentService.GetBookingPaymentAsync(CurrentUserId, bookingId);
            return payment == null
                ? NotFound(new { error = "No payment records found for this booking." })
                : Ok(payment);
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(403, new { error = "You are not a participant in this booking." });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "Booking not found." });
        }
    }
}
