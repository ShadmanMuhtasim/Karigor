using System;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
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
    private readonly IRealtimeNotifier _realtimeNotifier;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(
        KarigorDbContext db,
        SslCommerzClient sslCommerzClient,
        IRealtimeNotifier realtimeNotifier,
        ILogger<PaymentService> logger)
    {
        _db = db;
        _sslCommerzClient = sslCommerzClient;
        _realtimeNotifier = realtimeNotifier;
        _logger = logger;
    }

    public async Task<InitiatePaymentResponseDto> InitiatePaymentAsync(string customerUserId, int bookingId, string? customAppBaseUrl = null)
    {
        var customer = await _db.CustomerProfiles.Include(c => c.User)
            .SingleOrDefaultAsync(c => c.UserId == customerUserId)
            ?? throw new KeyNotFoundException("Customer profile not found.");
        var customerId = customer.Id;
        Payment payment = null!;
        Booking booking = null!;
        for (var retry = 0; ; retry++)
        {
            try
            {
                await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
                {
                    _db.ChangeTracker.Clear();
                    await using var tx = await _db.Database.BeginTransactionAsync();
                    booking = await _db.Bookings.Include(b => b.ServiceRequest).ThenInclude(r => r.Category)
                        .SingleOrDefaultAsync(b => b.Id == bookingId) ?? throw new KeyNotFoundException("Booking not found.");
                    if (booking.CustomerId != customerId)
                        throw new UnauthorizedAccessException("You are not authorized to pay for this booking.");
                    if (!string.Equals(booking.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException("Payment can only be completed after the service is marked as completed by the artisan.");
                    if (booking.SelectedPaymentId != null || booking.PaymentStatus == "Paid")
                        throw new PaymentConflictException();
                    var total = booking.AgreedPrice;
                    if (total <= 0) throw new InvalidOperationException("Payment amount must be positive.");
                    var platform = Math.Round(total * 0.02m, 2);
                    var service = Math.Round(total * 0.04m, 2);
                    var fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
                        JsonSerializer.Serialize(new { bookingId, customerId, workerId = booking.WorkerId, total, platform, service,
                            currency = "BDT", merchant = _sslCommerzClient.MerchantId, environment = _sslCommerzClient.EnvironmentName }))));
                    payment = (await _db.Payments.SingleOrDefaultAsync(p => p.BookingId == bookingId && p.InitiationFingerprint != null))!;
                    if (payment != null)
                    {
                        if (!string.Equals(payment.InitiationFingerprint, fingerprint, StringComparison.Ordinal))
                            throw new PaymentConflictException();
                    }
                    else
                    {
                        // A pre-existing external attempt is unresolved; never open another session blindly.
                        if (await _db.Payments.AnyAsync(p => p.BookingId == bookingId)) throw new PaymentConflictException();
                        // Compare-and-swap Booking coordinates reservation with a concurrent settlement.
                        _db.Entry(booking).Property(b => b.PaymentStatus).IsModified = true;
                        await _db.SaveChangesAsync();
                        payment = new Payment
                        {
                            BookingId = bookingId, TransactionId = "K" + Convert.ToHexString(RandomNumberGenerator.GetBytes(14)),
                            TotalAmount = total, PlatformFee = platform, ServiceCharge = service,
                            WorkerAmount = total - platform - service, Currency = "BDT", Status = "Initiated",
                            CreatedAt = DateTime.UtcNow, InitiationFingerprint = fingerprint, InitiationState = "Reserved",
                            InitiationMerchantId = _sslCommerzClient.MerchantId, InitiationEnvironment = _sslCommerzClient.EnvironmentName
                        };
                        _db.Payments.Add(payment);
                        await _db.SaveChangesAsync();
                    }
                    await tx.CommitAsync();
                });
                break;
            }
            catch (Exception ex) when (retry < 4 && IsExpectedRace(ex)) { }
            catch (Exception ex) when (IsExpectedRace(ex)) { throw new PaymentConflictException(); }
        }
        if (payment.InitiationState != "Reserved") return ToInitiationDto(payment);

        // Durable single dispatcher claim. Once committed, any crash/timeout leaves an unresolved intent.
        payment.InitiationState = "Dispatching";
        payment.InitiationDispatchedAt = DateTime.UtcNow;
        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException)
        {
            _db.ChangeTracker.Clear();
            return ToInitiationDto(await _db.Payments.SingleAsync(p => p.Id == payment.Id));
        }
        SslCommerzInitResponse result;
        try
        {
            // No SQL transaction spans this external call. HTTP retries are deliberately disabled here.
            result = await _sslCommerzClient.InitiateTransactionAsync(payment.TransactionId, payment.TotalAmount,
                payment.PlatformFee + payment.ServiceCharge, booking.Id, customerId, booking.WorkerId,
                customer.FullName, customer.User?.Email ?? "customer@karigor.com", customer.User?.PhoneNumber ?? "01700000000",
                booking.ServiceRequest.Address, booking.ServiceRequest.Category.Name, customAppBaseUrl);
            if (string.IsNullOrWhiteSpace(result.SessionKey) || result.SessionKey.Length > 100 ||
                result.GatewayPageURL is not { Length: > 0 and <= 2048 } ||
                !Uri.TryCreate(result.GatewayPageURL, UriKind.Absolute, out var url) || url.Scheme != Uri.UriSchemeHttps)
                throw new InvalidOperationException("Provider initialization metadata is incomplete.");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException)
        {
            _logger.LogWarning("Payment initiation outcome unknown for {TransactionId}; session creation will not be repeated.", payment.TransactionId);
            await PersistInitiationOutcomeAsync(payment.Id, null);
            _db.ChangeTracker.Clear();
            return ToInitiationDto(await _db.Payments.SingleAsync(p => p.Id == payment.Id));
        }
        await PersistInitiationOutcomeAsync(payment.Id, result);
        _db.ChangeTracker.Clear();
        return ToInitiationDto(await _db.Payments.SingleAsync(p => p.Id == payment.Id));
    }

    private async Task PersistInitiationOutcomeAsync(int id, SslCommerzInitResponse? result)
    {
        for (var retry = 0; ; retry++)
        {
            _db.ChangeTracker.Clear();
            var payment = await _db.Payments.SingleAsync(p => p.Id == id);
            if (payment.InitiationState != "Dispatching") return;
            payment.InitiationState = result == null ? "Unknown" : "Ready";
            payment.ProviderSessionKey = result?.SessionKey;
            payment.ProviderGatewayUrl = result?.GatewayPageURL;
            try { await _db.SaveChangesAsync(); return; }
            catch (DbUpdateConcurrencyException) when (retry < 4) { }
            catch (DbUpdateConcurrencyException) { throw new PaymentConflictException(); }
        }
    }

    private static InitiatePaymentResponseDto ToInitiationDto(Payment p) => new()
    {
        InitiationState = p.InitiationState ?? "Unknown",
        Message = p.InitiationState == "Ready" ? null : "Payment initiation is unresolved. Check this booking before paying again; retrying will reuse this intent.",
        GatewayUrl = p.Status == "Completed" ? "" : p.ProviderGatewayUrl ?? "", TransactionId = p.TransactionId,
        TotalAmount = p.TotalAmount, PlatformFee = p.PlatformFee, ServiceCharge = p.ServiceCharge, WorkerAmount = p.WorkerAmount
    };

    private static bool IsExpectedRace(Exception ex) => ex is DbUpdateConcurrencyException ||
        (ex is DbUpdateException { InnerException: SqlException sql } && sql.Number is 2601 or 2627 or 1205) ||
        (ex is SqlException direct && direct.Number == 1205);

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
            .AsNoTracking()
            .Include(p => p.Booking)
            .FirstOrDefaultAsync(p => p.TransactionId == callback.TranId);

        // SQL collation can ignore case/trailing spaces; the attempt identifier must be exact.
        if (payment == null || !string.Equals(payment.TransactionId, callback.TranId, StringComparison.Ordinal))
            throw new KeyNotFoundException("Payment transaction not found.");

        // Committed receipt is immutable in SQL; duplicates return the durable result without new effects.
        if (string.Equals(payment.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            return ToDto(payment);

        if (payment.InitiationMerchantId != null &&
            (!string.Equals(payment.InitiationMerchantId, _sslCommerzClient.MerchantId, StringComparison.Ordinal) ||
             !string.Equals(payment.InitiationEnvironment, _sslCommerzClient.EnvironmentName, StringComparison.Ordinal)))
            throw new PaymentVerificationException(payment.BookingId, "Payment merchant/environment differs from the configured verifier.");

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

        var (settlement, allocated, notification) = await CommitVerifiedSettlementAsync(payment.Id, payment.TotalAmount, payment.Currency, payment.TransactionId, validation);
        if (notification != null)
        {
            try
            {
                await _realtimeNotifier.NotifyUserAsync(notification.UserId, "ReceiveNotification", new NotificationDto
                {
                    Id = notification.Id, UserId = notification.UserId, Type = notification.Type,
                    Message = notification.Message, IsRead = false, RelatedEntityId = notification.RelatedEntityId,
                    CreatedAt = notification.CreatedAt
                });
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Payment notification committed; realtime delivery unavailable."); }
        }
        // Only the request that commits the first allocation emits a best-effort realtime hint.
        if (allocated)
        {
            try
            {
                await _realtimeNotifier.NotifyBookingGroupAsync(settlement.BookingId, "PaymentReceived", new
                {
                    bookingId = settlement.BookingId, totalAmount = settlement.TotalAmount,
                    platformFee = settlement.PlatformFee, serviceCharge = settlement.ServiceCharge,
                    totalFee = settlement.PlatformFee + settlement.ServiceCharge,
                    workerAmount = settlement.WorkerAmount, status = "Completed"
                });
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Payment committed; realtime delivery unavailable."); }
        }
        return ToDto(settlement);
    }

    private async Task<(Payment Payment, bool Allocated, Notification? Notification)> CommitVerifiedSettlementAsync(int paymentId,
        decimal verifiedAmount, string verifiedCurrency, string verifiedTransaction, SslCommerzValidationResponse validation)
    {
        for (var retry = 0; ; retry++)
        {
            try
            {
                return await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
                {
                    _db.ChangeTracker.Clear();
                    await using var tx = await _db.Database.BeginTransactionAsync();
                    var payment = await _db.Payments.SingleAsync(p => p.Id == paymentId);
                    var booking = await _db.Bookings.Include(b => b.Worker).Include(b => b.Customer)
                        .SingleAsync(b => b.Id == payment.BookingId);
                    payment.Booking = booking;
                    if (payment.Status == "Completed")
                    {
                        await tx.CommitAsync();
                        return (payment, false, (Notification?)null);
                    }
                    // Bind the proof to the freshly loaded terms, including concurrent changes.
                    if (payment.TotalAmount != verifiedAmount || payment.Currency != verifiedCurrency ||
                        payment.TransactionId != verifiedTransaction || (payment.InitiationMerchantId != null &&
                        (payment.InitiationMerchantId != _sslCommerzClient.MerchantId || payment.InitiationEnvironment != _sslCommerzClient.EnvironmentName)))
                        throw new PaymentVerificationException(payment.BookingId, "Payment terms changed during verification.", retryable: true);
                    // Acquire Booking with its rowversion BEFORE changing any payment fact.
                    // Conflicting requests roll back and reload; no process lock or provider call here.
                    _db.Entry(booking).Property(b => b.PaymentStatus).IsModified = true;
                    await _db.SaveChangesAsync();
                    var allocated = booking.SelectedPaymentId == null;
                    payment.Status = "Completed";
                    payment.ValId = validation.ValId;
                    payment.BankTranId = validation.BankTranId;
                    payment.CardType = validation.CardType;
                    payment.PaidAt = DateTime.UtcNow;
                    payment.GatewayResponse = JsonSerializer.Serialize(validation);
                    payment.VerifiedMerchantId = _sslCommerzClient.MerchantId;
                    payment.VerifiedEnvironment = _sslCommerzClient.EnvironmentName;
                    payment.VerifiedTransactionId = validation.TranId;
                    payment.RequiresReview = !allocated;
                    await _db.SaveChangesAsync();
                    Notification notification;
                    if (allocated)
                    {
                        booking.SelectedPaymentId = payment.Id;
                        booking.PaymentStatus = "Paid";
                        notification = new Notification
                        {
                            UserId = booking.Worker.UserId, Type = "PaymentReceived", RelatedEntityId = booking.Id,
                            Message = $"{booking.Customer.FullName} paid BDT {payment.TotalAmount:N2} for Booking #{booking.Id}. Artisan share: BDT {payment.WorkerAmount:N2}. This confirmation does not record a payout.",
                            CreatedAt = DateTime.UtcNow
                        };
                    }
                    else
                    {
                        notification = new Notification
                        {
                            UserId = booking.Customer.UserId, Type = "PaymentReview", RelatedEntityId = booking.Id,
                            Message = $"Another verified payment for Booking #{booking.Id} requires review. The selected settlement remains unchanged.",
                            CreatedAt = DateTime.UtcNow
                        };
                    }
                    _db.Notifications.Add(notification);
                    await _db.SaveChangesAsync();
                    await tx.CommitAsync();
                    return (payment, allocated, (Notification?)notification);
                });
            }
            catch (Exception ex) when (retry < 4 && IsExpectedRace(ex)) { }
            catch (Exception ex) when (IsExpectedRace(ex)) { throw new PaymentConflictException(); }
        }
    }

    public async Task<PaymentDetailsDto?> GetBookingPaymentAsync(string userId, int bookingId)
    {
        var booking = await _db.Bookings
            .AsNoTracking()
            .Include(b => b.Customer)
            .Include(b => b.Worker)
            .FirstOrDefaultAsync(b => b.Id == bookingId)
            ?? throw new KeyNotFoundException("Booking not found.");

        var isCustomer = booking.Customer.UserId == userId;
        var isWorker = booking.Worker.UserId == userId;

        if (!isCustomer && !isWorker)
            throw new UnauthorizedAccessException("You are not a participant in this booking.");

        var payment = await _db.Payments
            .AsNoTracking()
            .Where(p => p.BookingId == bookingId && (booking.SelectedPaymentId == null || p.Id == booking.SelectedPaymentId))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();

        if (payment != null) payment.Booking = booking;
        return payment == null ? null : ToDto(payment);
    }

    private static PaymentDetailsDto ToDto(Payment p) => new()
    {
        Version = Convert.ToBase64String(p.RowVersion),
        InitiationState = p.InitiationState, IsAllocated = p.Booking?.SelectedPaymentId == p.Id, RequiresReview = p.RequiresReview,
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
