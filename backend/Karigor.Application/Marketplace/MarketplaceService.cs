using Karigor.Application.Marketplace.DTOs;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Application.Marketplace;

public class MarketplaceService(KarigorDbContext db) : IMarketplaceService
{
    private async Task<WorkerProfile> WorkerAsync(string userId) =>
        await db.WorkerProfiles.FirstOrDefaultAsync(x => x.UserId == userId)
        ?? throw new KeyNotFoundException("Worker profile not found.");

    private async Task<CustomerProfile> CustomerAsync(string userId) =>
        await db.CustomerProfiles.FirstOrDefaultAsync(x => x.UserId == userId)
        ?? throw new KeyNotFoundException("Customer profile not found.");

    public async Task<QuotationDto> CreateQuotationAsync(string workerUserId, CreateQuotationDto dto)
    {
        var worker = await WorkerAsync(workerUserId);
        var request = await db.ServiceRequests.Include(x => x.Category)
            .FirstOrDefaultAsync(x => x.Id == dto.ServiceRequestId)
            ?? throw new KeyNotFoundException("Service request not found.");
        if (request.Status != "Open") throw new InvalidOperationException("Quotations can only be sent for open requests.");
        var hasSkill = await db.WorkerProfiles.Where(x => x.Id == worker.Id)
            .AnyAsync(x => x.Categories.Any(c => c.Id == request.CategoryId));
        if (!hasSkill) throw new InvalidOperationException("You can only quote on requests in one of your service categories.");
        if (await db.Quotations.AnyAsync(x => x.ServiceRequestId == request.Id && x.WorkerId == worker.Id && x.Status == "Pending"))
            throw new InvalidOperationException("You already have a pending quotation for this request.");
        var quotation = new Quotation { ServiceRequestId = request.Id, WorkerId = worker.Id, ProposedPrice = dto.ProposedPrice, Message = dto.Message?.Trim(), Status = "Pending" };
        db.Quotations.Add(quotation);
        await db.SaveChangesAsync();
        return ToDto(quotation, worker);
    }

    public async Task<List<AvailableRequestDto>> GetAvailableRequestsAsync(string workerUserId)
    {
        var worker = await WorkerAsync(workerUserId);
        return await db.ServiceRequests.Include(x => x.Category)
            .Where(x => x.Status == "Open" && x.Category.Workers.Any(w => w.Id == worker.Id))
            .OrderBy(x => x.PreferredDate)
            .Select(x => new AvailableRequestDto { Id = x.Id, CategoryName = x.Category.Name, Description = x.Description, Address = x.Address, PreferredDate = x.PreferredDate })
            .ToListAsync();
    }

    public async Task<List<QuotationDto>> GetRequestQuotationsAsync(string customerUserId, int requestId)
    {
        var customer = await CustomerAsync(customerUserId);
        var requestExists = await db.ServiceRequests.AnyAsync(x => x.Id == requestId && x.CustomerId == customer.Id);
        if (!requestExists) throw new KeyNotFoundException("Service request not found.");
        var quotes = await db.Quotations.Include(x => x.Worker).ThenInclude(x => x.User).Include(x => x.ServiceRequest)
            .Where(x => x.ServiceRequestId == requestId).OrderBy(x => x.ProposedPrice).ToListAsync();
        return quotes.Select(x => ToDto(x, x.Worker)).ToList();
    }

    public async Task<BookingDto> AcceptQuotationAsync(string customerUserId, int quotationId)
    {
        var customer = await CustomerAsync(customerUserId);
        var quote = await db.Quotations.Include(x => x.ServiceRequest).ThenInclude(x => x.Category).Include(x => x.Worker)
            .FirstOrDefaultAsync(x => x.Id == quotationId && x.ServiceRequest.CustomerId == customer.Id)
            ?? throw new KeyNotFoundException("Quotation not found.");
        if (quote.Status != "Pending") throw new InvalidOperationException("Only a pending quotation can be accepted.");
        if (quote.ServiceRequest.Status != "Open") throw new InvalidOperationException("This service request is no longer open.");
        await using var transaction = await db.Database.BeginTransactionAsync();
        quote.Status = "Accepted";
        quote.ServiceRequest.Status = "InProgress";
        var otherQuotes = await db.Quotations.Where(x => x.ServiceRequestId == quote.ServiceRequestId && x.Id != quote.Id && x.Status == "Pending").ToListAsync();
        foreach (var other in otherQuotes) other.Status = "Rejected";
        var booking = new Booking { ServiceRequestId = quote.ServiceRequestId, WorkerId = quote.WorkerId, CustomerId = customer.Id, AgreedPrice = quote.ProposedPrice, ScheduledDate = quote.ServiceRequest.PreferredDate, Status = "Scheduled" };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return await BookingDtoAsync(booking.Id);
    }

    public async Task<QuotationDto> CounterQuotationAsync(string customerUserId, int quotationId, CounterQuotationDto dto)
    {
        var customer = await CustomerAsync(customerUserId);
        var quote = await db.Quotations.Include(x => x.ServiceRequest).Include(x => x.Worker)
            .FirstOrDefaultAsync(x => x.Id == quotationId && x.ServiceRequest.CustomerId == customer.Id)
            ?? throw new KeyNotFoundException("Quotation not found.");
        if (quote.Status != "Pending" || quote.ServiceRequest.Status != "Open") throw new InvalidOperationException("Only a pending quote on an open request can be countered.");
        quote.Status = "Countered";
        var counter = new Quotation { ServiceRequestId = quote.ServiceRequestId, WorkerId = quote.WorkerId, ProposedPrice = dto.ProposedPrice, Message = dto.Message?.Trim(), Status = "Pending", ParentQuotationId = quote.Id };
        db.Quotations.Add(counter);
        await db.SaveChangesAsync();
        return ToDto(counter, quote.Worker);
    }

    public async Task<BookingDto> CreateBookingAsync(string customerUserId, CreateBookingDto dto)
    {
        var customer = await CustomerAsync(customerUserId);
        var quote = await db.Quotations.Include(x => x.ServiceRequest).FirstOrDefaultAsync(x => x.Id == dto.QuotationId && x.ServiceRequest.CustomerId == customer.Id)
            ?? throw new KeyNotFoundException("Quotation not found.");
        if (quote.Status != "Accepted") throw new InvalidOperationException("A booking can only be created from an accepted quotation.");
        var booking = await db.Bookings.FirstOrDefaultAsync(x => x.ServiceRequestId == quote.ServiceRequestId && x.WorkerId == quote.WorkerId);
        if (booking is null) throw new InvalidOperationException("The accepted quotation does not have a booking. Please accept it again.");
        return await BookingDtoAsync(booking.Id);
    }

    public async Task<List<BookingDto>> GetCustomerBookingsAsync(string customerUserId)
    {
        var customer = await CustomerAsync(customerUserId);
        var ids = await db.Bookings.Where(x => x.CustomerId == customer.Id).OrderByDescending(x => x.Id).Select(x => x.Id).ToListAsync();
        return (await Task.WhenAll(ids.Select(BookingDtoAsync))).ToList();
    }
    public async Task<List<BookingDto>> GetWorkerBookingsAsync(string workerUserId)
    {
        var worker = await WorkerAsync(workerUserId);
        var ids = await db.Bookings.Where(x => x.WorkerId == worker.Id).OrderByDescending(x => x.Id).Select(x => x.Id).ToListAsync();
        return (await Task.WhenAll(ids.Select(BookingDtoAsync))).ToList();
    }
    public async Task<BookingDto> GetBookingAsync(string userId, string role, int bookingId)
    {
        var booking = await db.Bookings.FirstOrDefaultAsync(x => x.Id == bookingId) ?? throw new KeyNotFoundException("Booking not found.");
        var allowed = role == "Customer" ? booking.CustomerId == (await CustomerAsync(userId)).Id : booking.WorkerId == (await WorkerAsync(userId)).Id;
        if (!allowed) throw new KeyNotFoundException("Booking not found.");
        return await BookingDtoAsync(bookingId);
    }
    public async Task<BookingDto> UpdateBookingStatusAsync(string workerUserId, int bookingId, UpdateBookingStatusDto dto)
    {
        var worker = await WorkerAsync(workerUserId);
        var booking = await db.Bookings.Include(x => x.ServiceRequest).FirstOrDefaultAsync(x => x.Id == bookingId && x.WorkerId == worker.Id)
            ?? throw new KeyNotFoundException("Booking not found.");
        if (booking.Status is "Completed" or "Cancelled") throw new InvalidOperationException("A completed or cancelled booking cannot be changed.");
        if (dto.Status == "Completed" && booking.Status != "InProgress") throw new InvalidOperationException("A booking must be InProgress before it can be completed.");
        booking.Status = dto.Status;
        if (dto.Status == "Completed") booking.ServiceRequest.Status = "Completed";
        if (dto.Status == "Cancelled") booking.ServiceRequest.Status = "Cancelled";
        await db.SaveChangesAsync();
        return await BookingDtoAsync(bookingId);
    }

    private async Task<BookingDto> BookingDtoAsync(int id)
    {
        var x = await db.Bookings.Include(b => b.Worker).ThenInclude(w => w.User).Include(b => b.Customer).Include(b => b.ServiceRequest).ThenInclude(r => r.Category).FirstAsync(b => b.Id == id);
        return new BookingDto { Id=x.Id, ServiceRequestId=x.ServiceRequestId, CategoryName=x.ServiceRequest.Category.Name, WorkerId=x.WorkerId, WorkerName=x.Worker.User?.Email ?? $"Worker #{x.WorkerId}", CustomerId=x.CustomerId, CustomerName=x.Customer.FullName, AgreedPrice=x.AgreedPrice, ScheduledDate=x.ScheduledDate, Status=x.Status, Address=x.ServiceRequest.Address, Description=x.ServiceRequest.Description };
    }
    private static QuotationDto ToDto(Quotation x, WorkerProfile worker) => new() { Id=x.Id, ServiceRequestId=x.ServiceRequestId, WorkerId=x.WorkerId, WorkerName=worker.User?.Email ?? $"Worker #{x.WorkerId}", WorkerBio=worker.Bio, AverageRating=worker.AverageRating, ProposedPrice=x.ProposedPrice, Message=x.Message, Status=x.Status, ParentQuotationId=x.ParentQuotationId };
}
