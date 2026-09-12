using System;
using System.Globalization;
using System.Linq;
using System.Text.Json;
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

    public async Task<PaymentDetailsDto> ProcessSuccessCallbackAsync(SslCommerzCallbackDto callback)
    {
        _logger.LogInformation("Processing SSLCommerz success callback for TranId: {TranId}, ValId: {ValId}",
            callback.TranId, callback.ValId);

        if (string.IsNullOrWhiteSpace(callback.TranId))
            throw new ArgumentException("Transaction ID is missing from callback.");

        var payment = await _db.Payments
            .Include(p => p.Booking)
            .FirstOrDefaultAsync(p => p.TransactionId == callback.TranId);

        if (payment == null && int.TryParse(callback.ValueA, out var bookingId))
        {
            payment = await _db.Payments
                .Include(p => p.Booking)
                .Where(p => p.BookingId == bookingId)
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();
        }

        if (payment == null)
            throw new KeyNotFoundException($"Payment with transaction ID '{callback.TranId}' not found.");

        // Idempotency: if already completed, return immediately
        if (string.Equals(payment.Status, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation("Payment {TransactionId} is already marked Completed.", payment.TransactionId);
            return ToDto(payment);
        }

        // Server-side validation with SSLCommerz Order Validation API
        bool isValid = false;
        if (!string.IsNullOrWhiteSpace(callback.ValId))
        {
            try
            {
                var validation = await _sslCommerzClient.ValidateTransactionAsync(callback.ValId);
                if (validation != null &&
                    (string.Equals(validation.Status, "VALID", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(validation.Status, "VALIDATED", StringComparison.OrdinalIgnoreCase)))
                {
                    // Validate amount integrity if present
                    if (!string.IsNullOrWhiteSpace(validation.Amount) &&
                        decimal.TryParse(validation.Amount, NumberStyles.Any, CultureInfo.InvariantCulture, out var validatedAmount))
                    {
                        if (Math.Abs(validatedAmount - payment.TotalAmount) < 1.00m)
                        {
                            isValid = true;
                        }
                        else
                        {
                            _logger.LogWarning("Validation amount mismatch: expected {Expected}, received {Received}",
                                payment.TotalAmount, validatedAmount);
                        }
                    }
                    else
                    {
                        isValid = true;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SSLCommerz validation API check failed for val_id: {ValId}. Falling back to callback status.", callback.ValId);
            }
        }

        // Also accept if sandbox/callback explicitly reported VALID
        if (!isValid && string.Equals(callback.Status, "VALID", StringComparison.OrdinalIgnoreCase))
        {
            isValid = true;
        }

        if (!isValid)
        {
            payment.Status = "Failed";
            payment.GatewayResponse = JsonSerializer.Serialize(callback);
            await _db.SaveChangesAsync();
            throw new InvalidOperationException("Payment could not be verified by the gateway.");
        }

        // Record successful payment
        payment.Status          = "Completed";
        payment.ValId           = callback.ValId;
        payment.BankTranId      = callback.BankTranId;
        payment.CardType        = callback.CardType;
        payment.PaidAt          = DateTime.UtcNow;
        payment.GatewayResponse = JsonSerializer.Serialize(callback);

        // Update booking payment status
        var booking = await _db.Bookings
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.Customer)
            .FirstOrDefaultAsync(b => b.Id == payment.BookingId);

        if (booking != null)
        {
            booking.PaymentStatus = "Paid";
        }

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
                    Message         = $"💰 Payment Received! {customerName} paid ৳{payment.TotalAmount:N0} for Booking #{booking.Id}. Your payout of ৳{payment.WorkerAmount:N0} (94%) has been credited after platform fee and service charges (6%).",
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
            await _realtimeNotifier.BroadcastAsync("PaymentReceived", new
            {
                bookingId     = payment.BookingId,
                transactionId = payment.TransactionId,
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

    public async Task<PaymentDetailsDto> ProcessFailCallbackAsync(SslCommerzCallbackDto callback)
    {
        _logger.LogWarning("Processing SSLCommerz fail callback for TranId: {TranId}", callback.TranId);

        var payment = await _db.Payments.FirstOrDefaultAsync(p => p.TransactionId == callback.TranId);
        if (payment == null && int.TryParse(callback.ValueA, out var bookingId))
        {
            payment = await _db.Payments
                .Where(p => p.BookingId == bookingId)
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();
        }

        if (payment != null && !string.Equals(payment.Status, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            payment.Status = "Failed";
            payment.GatewayResponse = JsonSerializer.Serialize(callback);
            await _db.SaveChangesAsync();
            return ToDto(payment);
        }

        return payment != null ? ToDto(payment) : new PaymentDetailsDto { Status = "Failed" };
    }

    public async Task<PaymentDetailsDto> ProcessCancelCallbackAsync(SslCommerzCallbackDto callback)
    {
        _logger.LogInformation("Processing SSLCommerz cancel callback for TranId: {TranId}", callback.TranId);

        var payment = await _db.Payments.FirstOrDefaultAsync(p => p.TransactionId == callback.TranId);
        if (payment == null && int.TryParse(callback.ValueA, out var bookingId))
        {
            payment = await _db.Payments
                .Where(p => p.BookingId == bookingId)
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();
        }

        if (payment != null && !string.Equals(payment.Status, "Completed", StringComparison.OrdinalIgnoreCase))
        {
            payment.Status = "Cancelled";
            payment.GatewayResponse = JsonSerializer.Serialize(callback);
            await _db.SaveChangesAsync();
            return ToDto(payment);
        }

        return payment != null ? ToDto(payment) : new PaymentDetailsDto { Status = "Cancelled" };
    }

    public async Task<PaymentDetailsDto> ProcessIpnAsync(SslCommerzCallbackDto callback)
    {
        return await ProcessSuccessCallbackAsync(callback);
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
