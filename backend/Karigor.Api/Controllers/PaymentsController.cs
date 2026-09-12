using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Karigor.Application.Payments;
using Karigor.Application.Payments.DTOs;
using Karigor.Application.Payments.SslCommerz;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Karigor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
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
        if (!string.IsNullOrWhiteSpace(_sslOptions.AppBaseUrl) && !_sslOptions.AppBaseUrl.Contains("localhost"))
        {
            appBaseUrl = _sslOptions.AppBaseUrl;
        }
        else if (Request.Headers.TryGetValue("X-Forwarded-Proto", out var proto) &&
                 Request.Headers.TryGetValue("X-Forwarded-Host", out var host))
        {
            appBaseUrl = $"{proto}://{host}";
        }
        else
        {
            appBaseUrl = $"{Request.Scheme}://{Request.Host}";
        }

        var result = await _paymentService.InitiatePaymentAsync(CurrentUserId, dto.BookingId, appBaseUrl);
        return Ok(result);
    }

    /// <summary>
    /// SSLCommerz browser POST callback for successful transactions.
    /// Validates payment server-to-server and 302 redirects to client frontend.
    /// </summary>
    [HttpPost("sslcommerz/success")]
    [AllowAnonymous]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> SslCommerzSuccess([FromForm] SslCommerzCallbackDto callback)
    {
        PopulateFromForm(callback);
        _logger.LogInformation("Received SSLCommerz success callback: TranId={TranId}, ValId={ValId}, Status={Status}",
            callback.TranId, callback.ValId, callback.Status);

        var clientBaseUrl = _sslOptions.ClientBaseUrl.TrimEnd('/');
        try
        {
            var payment = await _paymentService.ProcessSuccessCallbackAsync(callback);
            var redirectUrl = $"{clientBaseUrl}/payment/callback?status=success&bookingId={payment.BookingId}&tranId={Uri.EscapeDataString(payment.TransactionId)}&amount={payment.TotalAmount}&valId={Uri.EscapeDataString(payment.ValId ?? "")}";
            return Redirect(redirectUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing SSLCommerz success callback for TranId: {TranId}", callback.TranId);
            var redirectUrl = $"{clientBaseUrl}/payment/callback?status=error&message={Uri.EscapeDataString(ex.Message)}&tranId={Uri.EscapeDataString(callback.TranId ?? "")}";
            return Redirect(redirectUrl);
        }
    }

    /// <summary>
    /// SSLCommerz browser POST callback for failed transactions.
    /// </summary>
    [HttpPost("sslcommerz/fail")]
    [AllowAnonymous]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> SslCommerzFail([FromForm] SslCommerzCallbackDto callback)
    {
        PopulateFromForm(callback);
        _logger.LogWarning("Received SSLCommerz fail callback: TranId={TranId}", callback.TranId);

        var clientBaseUrl = _sslOptions.ClientBaseUrl.TrimEnd('/');
        try
        {
            var payment = await _paymentService.ProcessFailCallbackAsync(callback);
            var redirectUrl = $"{clientBaseUrl}/payment/callback?status=failed&bookingId={payment.BookingId}&tranId={Uri.EscapeDataString(payment.TransactionId)}";
            return Redirect(redirectUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing SSLCommerz fail callback for TranId: {TranId}", callback.TranId);
            var redirectUrl = $"{clientBaseUrl}/payment/callback?status=failed&tranId={Uri.EscapeDataString(callback.TranId ?? "")}";
            return Redirect(redirectUrl);
        }
    }

    /// <summary>
    /// SSLCommerz browser POST callback for user cancellation.
    /// </summary>
    [HttpPost("sslcommerz/cancel")]
    [AllowAnonymous]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> SslCommerzCancel([FromForm] SslCommerzCallbackDto callback)
    {
        PopulateFromForm(callback);
        _logger.LogWarning("Received SSLCommerz cancel callback: TranId={TranId}", callback.TranId);

        var clientBaseUrl = _sslOptions.ClientBaseUrl.TrimEnd('/');
        try
        {
            var payment = await _paymentService.ProcessCancelCallbackAsync(callback);
            var redirectUrl = $"{clientBaseUrl}/payment/callback?status=cancelled&bookingId={payment.BookingId}&tranId={Uri.EscapeDataString(payment.TransactionId)}";
            return Redirect(redirectUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing SSLCommerz cancel callback for TranId: {TranId}", callback.TranId);
            var redirectUrl = $"{clientBaseUrl}/payment/callback?status=cancelled&tranId={Uri.EscapeDataString(callback.TranId ?? "")}";
            return Redirect(redirectUrl);
        }
    }

    private void PopulateFromForm(SslCommerzCallbackDto callback)
    {
        if (!Request.HasFormContentType) return;
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

    /// <summary>
    /// Instant Payment Notification (IPN) server-to-server webhook from SSLCommerz.
    /// </summary>
    [HttpPost("sslcommerz/ipn")]
    [AllowAnonymous]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> SslCommerzIpn([FromForm] SslCommerzCallbackDto callback)
    {
        _logger.LogInformation("Received SSLCommerz IPN: TranId={TranId}, ValId={ValId}", callback.TranId, callback.ValId);
        try
        {
            var payment = await _paymentService.ProcessIpnAsync(callback);
            return Ok(new { message = "IPN processed successfully", transactionId = payment.TransactionId, status = payment.Status });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling IPN for TranId: {TranId}", callback.TranId);
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Retrieves the payment details for a specific booking.
    /// </summary>
    [HttpGet("booking/{bookingId:int}")]
    [Authorize]
    public async Task<ActionResult<PaymentDetailsDto>> GetBookingPayment(int bookingId)
    {
        var payment = await _paymentService.GetBookingPaymentAsync(CurrentUserId, bookingId);
        if (payment == null)
            return NotFound(new { error = "No payment records found for this booking." });

        return Ok(payment);
    }
}
