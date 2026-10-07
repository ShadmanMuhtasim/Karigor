using System;

namespace Karigor.Application.Payments;

/// <summary>A callback did not establish payment truth. Stored financial state is unchanged.</summary>
public sealed class PaymentVerificationException : Exception
{
    public int BookingId { get; }
    public bool Retryable { get; }

    public PaymentVerificationException(int bookingId, string message, bool retryable = false, Exception? innerException = null)
        : base(message, innerException)
    {
        BookingId = bookingId;
        Retryable = retryable;
    }
}
