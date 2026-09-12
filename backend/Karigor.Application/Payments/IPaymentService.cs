using System.Threading.Tasks;
using Karigor.Application.Payments.DTOs;

namespace Karigor.Application.Payments;

public interface IPaymentService
{
    Task<InitiatePaymentResponseDto> InitiatePaymentAsync(string customerUserId, int bookingId, string? customAppBaseUrl = null);

    Task<PaymentDetailsDto> ProcessSuccessCallbackAsync(SslCommerzCallbackDto callback);

    Task<PaymentDetailsDto> ProcessFailCallbackAsync(SslCommerzCallbackDto callback);

    Task<PaymentDetailsDto> ProcessCancelCallbackAsync(SslCommerzCallbackDto callback);

    Task<PaymentDetailsDto> ProcessIpnAsync(SslCommerzCallbackDto callback);

    Task<PaymentDetailsDto?> GetBookingPaymentAsync(string userId, int bookingId);
}
