using System;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Karigor.Application.Notifications;
using Karigor.Application.Notifications.DTOs;
using Karigor.Application.Payments.DTOs;
using Karigor.Application.Payments.SslCommerz;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Karigor.Application.Payments;

public class PaymentService : IPaymentService
{
    private readonly KarigorDbContext _db;
    private readonly SslCommerzClient _sslCommerzClient;
    private readonly INotificationService _notificationService;
    private readonly IRealtimeNotifier _realtimeNotifier;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(
        KarigorDbContext db,
        SslCommerzClient sslCommerzClient,
        INotificationService notificationService,
        IRealtimeNotifier realtimeNotifier,
        ILogger<PaymentService> logger)
    {
        _db = db;
        _sslCommerzClient = sslCommerzClient;
        _notificationService = notificationService;
        _realtimeNotifier = realtimeNotifier;
        _logger = logger;
    }

    public async Task<InitiatePaymentResponseDto> InitiatePaymentAsync(string customerUserId, int bookingId, string? customAppBaseUrl = null)
    {
        var customer = await _db.CustomerProfiles
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.UserId == customerUserId)
            ?? throw new KeyNotFoundException("Customer profile not found.");

        var booking = await _db.Bookings
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.Customer)
            .Include(b => b.ServiceRequest).ThenInclude(r => r.Category)
            .FirstOrDefaultAsync(b => b.Id == bookingId)
            ?? throw new KeyNotFoundException("Booking not found.");

        if (booking.CustomerId != customer.Id)
            throw new UnauthorizedAccessException("You are not authorized to pay for this booking.");

        if (!string.Equals(booking.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Payment can only be completed after the service is marked as completed by the artisan.");

        if (string.Equals(booking.PaymentStatus, "Paid", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Payment for this booking has already been completed.");

        // Fee calculations: 2% platform fee, 4% service charges = 6% total deduction, 94% artisan net payout
        var totalAmount = booking.AgreedPrice;
        var platformFee = Math.Round(totalAmount * 0.02m, 2);   // 2% platform fee
        var serviceCharge = Math.Round(totalAmount * 0.04m, 2); // 4% service charges
        var totalFee = platformFee + serviceCharge;             // 6% combined platform fee and service charges
        var workerAmount = totalAmount - totalFee;              // 94% net payout

        // Unique transaction identifier
        var transactionId = $"TXN_B{booking.Id}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}_{Random.Shared.Next(100, 999)}";

        // Create pending payment record
        var payment = new Payment
        {
            BookingId       = booking.Id,
            TransactionId   = transactionId,
            TotalAmount     = totalAmount,
            PlatformFee     = platformFee,
            ServiceCharge   = serviceCharge,
            WorkerAmount    = workerAmount,
            Currency        = "BDT",
            Status          = "Initiated",
            CreatedAt       = DateTime.UtcNow
        };

        _db.Payments.Add(payment);
        await _db.SaveChangesAsync();

        // Call SSLCommerz Gateway initialization
        var customerPhone = customer.User?.PhoneNumber ?? "01700000000";
        var customerEmail = customer.User?.Email ?? "customer@karigor.com";
        var customerAddress = booking.ServiceRequest?.Address ?? "Dhaka, Bangladesh";
        var categoryName = booking.ServiceRequest?.Category?.Name ?? "General Service";

        var initResult = await _sslCommerzClient.InitiateTransactionAsync(
            transactionId: transactionId,
            totalAmount: totalAmount,
            platformFee: totalFee,
            bookingId: booking.Id,
            customerId: customer.Id,
            workerId: booking.WorkerId,
            customerName: customer.FullName,
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            customerAddress: customerAddress,
            categoryName: categoryName,
            customAppBaseUrl: customAppBaseUrl
        );

        return new InitiatePaymentResponseDto
        {
            GatewayUrl    = initResult.GatewayPageURL ?? string.Empty,
            TransactionId = transactionId,
            TotalAmount   = totalAmount,
            PlatformFee   = platformFee,
            ServiceCharge = serviceCharge,
            WorkerAmount  = workerAmount
        };
    }

    public Task<PaymentDetailsDto> ProcessSuccessCallbackAsync(SslCommerzCallbackDto callback)
        => ProcessVerifiedCallbackAsync(callback);

    public Task<PaymentDetailsDto> ProcessFailCallbackAsync(SslCommerzCallbackDto callback)
        => ProcessVerifiedCallbackAsync(callback);

    public Task<PaymentDetailsDto> ProcessCancelCallbackAsync(SslCommerzCallbackDto callback)
        => ProcessVerifiedCallbackAsync(callback);

    public Task<PaymentDetailsDto> ProcessIpnAsync(SslCommerzCallbackDto callback)
        => ProcessVerifiedCallbackAsync(callback);

    private async Task<PaymentDetailsDto> ProcessVerifiedCallbackAsync(SslCommerzCallbackDto callback)
    {
        _logger.LogInformation("Verifying SSLCommerz callback for TranId: {TranId}", callback.TranId);

        if (string.IsNullOrWhiteSpace(callback.TranId))
            throw new ArgumentException("Transaction ID is missing from callback.");

        var payment = await _db.Payments
            .Include(p => p.Booking)
            .FirstOrDefaultAsync(p => p.TransactionId == callback.TranId);

        // SQL collation can ignore case/trailing spaces; the attempt identifier must be exact.
        if (payment == null || !string.Equals(payment.TransactionId, callback.TranId, StringComparison.Ordinal))
            throw new KeyNotFoundException("Payment transaction not found.");

        // Preserve completion. This sequential guard is not concurrency/idempotency architecture.
        if (string.Equals(payment.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            return ToDto(payment);

        if (string.IsNullOrWhiteSpace(callback.ValId))
            throw new PaymentVerificationException(payment.BookingId, "Provider verification identifier is missing.");

        SslCommerzValidationResponse validation;
        try
        {
            validation = await _sslCommerzClient.ValidateTransactionAsync(callback.ValId);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException)
        {
            // Transport/parse uncertainty is not a financial failure, and never grants success.
            _logger.LogWarning("Provider verification unavailable for transaction {TransactionId}; state unchanged.", payment.TransactionId);
            throw new PaymentVerificationException(payment.BookingId,
                "Provider verification is unavailable. Payment remains unresolved.", retryable: true, innerException: ex);
        }

        var validStatus = string.Equals(validation.Status, "VALID", StringComparison.Ordinal) ||
                          string.Equals(validation.Status, "VALIDATED", StringComparison.Ordinal);
        // Provider amounts have at most two fractional digits: no rounding, tolerance, signs or grouping.
        var validAmount = validation.Amount is { Length: > 0 and <= 32 } &&
                          Regex.IsMatch(validation.Amount, @"\A[0-9]+(?:\.[0-9]{1,2})?\z", RegexOptions.CultureInvariant) &&
                          decimal.TryParse(validation.Amount, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount) &&
                          amount > 0 && amount == payment.TotalAmount;
        var validReceipt = !string.IsNullOrWhiteSpace(validation.ValId) && validation.ValId.Length <= 100 &&
                           string.Equals(validation.ValId, callback.ValId, StringComparison.Ordinal) &&
                           validation.BankTranId?.Length is not > 100 && validation.CardType?.Length is not > 100;
        if (!validStatus || !validAmount || !validReceipt ||
            !string.Equals(validation.TranId, payment.TransactionId, StringComparison.Ordinal) ||
            !string.Equals(payment.Currency, "BDT", StringComparison.Ordinal) ||
            !string.Equals(validation.Currency, payment.Currency, StringComparison.Ordinal))
        {
            _logger.LogWarning("Provider result did not bind to payment {TransactionId}; state unchanged.", payment.TransactionId);
            throw new PaymentVerificationException(payment.BookingId, "Provider result did not verify the stored payment attempt.");
        }

        // Receipt facts come only from the bound provider response, never callback fields.
        payment.Status          = "Completed";
        payment.ValId           = validation.ValId;
        payment.BankTranId      = validation.BankTranId;
        payment.CardType        = validation.CardType;
        payment.PaidAt          = DateTime.UtcNow;
        payment.GatewayResponse = JsonSerializer.Serialize(validation);

        var booking = await _db.Bookings
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.Customer)
            .FirstOrDefaultAsync(b => b.Id == payment.BookingId)
            ?? throw new KeyNotFoundException("Payment booking not found.");

        booking.PaymentStatus = "Paid";
        // EF commits payment and booking together; provider HTTP has already finished.
        await _db.SaveChangesAsync();

        // Dispatch in-app notification & SignalR alert to the artisan
        if (booking?.Worker?.User != null)
        {
            var customerName = booking.Customer?.FullName ?? "Customer";
            try
            {
                await _notificationService.CreateNotificationAsync(new CreateNotificationDto
                {
                    UserId          = booking.Worker.UserId,
                    Type            = "PaymentReceived",
                    Message         = $"💰 Payment Received! {customerName} paid ৳{payment.TotalAmount:N0} for Booking #{booking.Id}. Artisan share: ৳{payment.WorkerAmount:N0} after platform fee and service charges. This confirmation does not record a payout.",
                    RelatedEntityId = booking.Id
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to dispatch in-app notification to worker.");
            }
        }

        // Broadcast real-time payment event to update customer and worker screens
        try
        {
            await _realtimeNotifier.NotifyBookingGroupAsync(payment.BookingId, "PaymentReceived", new
            {
                bookingId     = payment.BookingId,
                totalAmount   = payment.TotalAmount,
                platformFee   = payment.PlatformFee,
                serviceCharge = payment.ServiceCharge,
                totalFee      = payment.PlatformFee + payment.ServiceCharge,
                workerAmount  = payment.WorkerAmount,
                status        = "Completed"
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast PaymentReceived event.");
        }

        return ToDto(payment);
    }

    public async Task<PaymentDetailsDto?> GetBookingPaymentAsync(string userId, int bookingId)
    {
        var booking = await _db.Bookings
            .Include(b => b.Customer)
            .Include(b => b.Worker)
            .FirstOrDefaultAsync(b => b.Id == bookingId)
            ?? throw new KeyNotFoundException("Booking not found.");

        var isCustomer = booking.Customer.UserId == userId;
        var isWorker = booking.Worker.UserId == userId;

        if (!isCustomer && !isWorker)
            throw new UnauthorizedAccessException("You are not a participant in this booking.");

        var payment = await _db.Payments
            .Where(p => p.BookingId == bookingId)
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        return payment == null ? null : ToDto(payment);
    }

    private static PaymentDetailsDto ToDto(Payment p) => new()
    {
        Id            = p.Id,
        BookingId     = p.BookingId,
        TransactionId = p.TransactionId,
        ValId         = p.ValId,
        BankTranId    = p.BankTranId,
        CardType      = p.CardType,
        Currency      = p.Currency,
        TotalAmount   = p.TotalAmount,
        PlatformFee   = p.PlatformFee,
        ServiceCharge = p.ServiceCharge,
        WorkerAmount  = p.WorkerAmount,
        Status        = p.Status,
        CreatedAt     = p.CreatedAt,
        PaidAt        = p.PaidAt
    };
}
