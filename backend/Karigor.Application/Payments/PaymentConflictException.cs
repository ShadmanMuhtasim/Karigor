namespace Karigor.Application.Payments;

public sealed class PaymentConflictException() : Exception("Payment state changed. Refresh the authoritative payment status before retrying.");
