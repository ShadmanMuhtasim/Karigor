using Karigor.Application.Marketplace.DTOs;

namespace Karigor.Application.Marketplace;

public interface IMarketplaceService
{
    Task<QuotationDto> CreateQuotationAsync(string workerUserId, CreateQuotationDto dto);
    Task<List<AvailableRequestDto>> GetAvailableRequestsAsync(string workerUserId);
    Task<List<QuotationDto>> GetRequestQuotationsAsync(string customerUserId, int requestId);
    Task<BookingDto> AcceptQuotationAsync(string customerUserId, int quotationId);
    Task<QuotationDto> CounterQuotationAsync(string customerUserId, int quotationId, CounterQuotationDto dto);
    Task<BookingDto> CreateBookingAsync(string customerUserId, CreateBookingDto dto);
    Task<List<BookingDto>> GetCustomerBookingsAsync(string customerUserId);
    Task<List<BookingDto>> GetWorkerBookingsAsync(string workerUserId);
    Task<BookingDto> GetBookingAsync(string userId, string role, int bookingId);
    Task<BookingDto> UpdateBookingStatusAsync(string workerUserId, int bookingId, UpdateBookingStatusDto dto);
}
