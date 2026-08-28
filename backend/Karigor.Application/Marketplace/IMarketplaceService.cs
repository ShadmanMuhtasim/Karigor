using Karigor.Application.Customer.DTOs;
using Karigor.Application.Marketplace.DTOs;

namespace Karigor.Application.Marketplace;

public interface IMarketplaceService
{
    Task<QuotationDto> CreateQuotationAsync(string workerUserId, CreateQuotationDto dto);
    Task<List<AvailableRequestDto>> GetAvailableRequestsAsync(string workerUserId);
    Task<List<WorkerQuotationSummaryDto>> GetWorkerQuotationsAsync(string workerUserId);
    Task<ServiceRequestDto> GetServiceRequestDetailsAsync(string userId, int requestId);
    Task<List<QuotationDto>> GetRequestQuotationsAsync(string userId, int requestId);
    Task<BookingDto> AcceptQuotationAsync(string userId, int quotationId);
    Task<QuotationDto> CounterQuotationAsync(string userId, int quotationId, CounterQuotationDto dto);
    Task<BookingDto> CreateBookingAsync(string customerUserId, CreateBookingDto dto);
    Task<List<BookingDto>> GetCustomerBookingsAsync(string customerUserId);
    Task<List<BookingDto>> GetWorkerBookingsAsync(string workerUserId);
    Task<BookingDto> GetBookingAsync(string userId, string role, int bookingId);
    Task<BookingDto> UpdateBookingStatusAsync(string workerUserId, int bookingId, UpdateBookingStatusDto dto);
    Task<GenerateVerificationCodeResponseDto> GenerateVerificationCodeAsync(string customerUserId, int bookingId);
    Task<BookingDto> VerifyWorkerCheckInAsync(string workerUserId, int bookingId, WorkerCheckInDto dto);
}
