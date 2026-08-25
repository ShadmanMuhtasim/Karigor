using Karigor.Application.Customer.DTOs;
using Karigor.Application.Marketplace.DTOs;
using Karigor.Application.Notifications;
using Karigor.Application.Notifications.DTOs;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Application.Marketplace;

public class MarketplaceService(
    KarigorDbContext db,
    INotificationService notificationService,
    IRealtimeNotifier realtimeNotifier) : IMarketplaceService
{
    private async Task<WorkerProfile> WorkerAsync(string userId) =>
        await db.WorkerProfiles.Include(x => x.User).FirstOrDefaultAsync(x => x.UserId == userId)
        ?? throw new KeyNotFoundException("Worker profile not found.");

    private async Task<CustomerProfile> CustomerAsync(string userId) =>
        await db.CustomerProfiles.FirstOrDefaultAsync(x => x.UserId == userId)
        ?? throw new KeyNotFoundException("Customer profile not found.");

    private static int GetNegotiationDepth(Quotation q, Dictionary<int, Quotation> allQuotes)
    {
        int depth = 0;
        var curr = q;
        while (curr.ParentQuotationId.HasValue && allQuotes.TryGetValue(curr.ParentQuotationId.Value, out var parent))
        {
            depth++;
            curr = parent;
        }
        return depth;
    }

    public async Task<QuotationDto> CreateQuotationAsync(string workerUserId, CreateQuotationDto dto)
    {
        var worker = await WorkerAsync(workerUserId);
        var request = await db.ServiceRequests
            .Include(x => x.Category)
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == dto.ServiceRequestId)
            ?? throw new KeyNotFoundException("Service request not found.");

        if (request.Status != "Open")
            throw new InvalidOperationException("Quotations can only be sent for open requests.");

        // If worker already has an active pending quote for this job, update it; otherwise create a new quote
        var existingPending = await db.Quotations
            .FirstOrDefaultAsync(x => x.ServiceRequestId == request.Id && x.WorkerId == worker.Id && x.Status == "Pending");

        Quotation quotation;
        if (existingPending != null)
        {
            existingPending.ProposedPrice = dto.ProposedPrice;
            existingPending.Message = dto.Message?.Trim();
            quotation = existingPending;
        }
        else
        {
            quotation = new Quotation
            {
                ServiceRequestId  = request.Id,
                WorkerId          = worker.Id,
                ProposedPrice     = dto.ProposedPrice,
                Message           = dto.Message?.Trim(),
                Status            = "Pending"
            };
            db.Quotations.Add(quotation);
        }

        await db.SaveChangesAsync();

        // Notify customer
        if (request.Customer != null)
        {
            await notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId          = request.Customer.UserId,
                Type            = "NewQuotation",
                Message         = $"👷 Worker submitted a quotation of ৳{dto.ProposedPrice} for {request.Category?.Name ?? "your service request"}.",
                RelatedEntityId = request.Id
            });
        }

        // Broadcast real-time update to update negotiation screens live
        try
        {
            await realtimeNotifier.BroadcastAsync("QuotationUpdated", new
            {
                requestId = request.Id,
                serviceRequestId = request.Id,
                workerId = worker.Id,
                status = quotation.Status,
                price = quotation.ProposedPrice
            });
        }
        catch { /* Non-blocking */ }

        return ToDto(quotation, worker, 0);
    }

    public async Task<List<AvailableRequestDto>> GetAvailableRequestsAsync(string workerUserId)
    {
        var worker = await WorkerAsync(workerUserId);
        return await db.ServiceRequests.Include(x => x.Category)
            .Where(x => x.Status == "Open" && x.Category.Workers.Any(w => w.Id == worker.Id))
            .OrderBy(x => x.PreferredDate)
            .Select(x => new AvailableRequestDto
            {
                Id            = x.Id,
                CategoryName  = x.Category.Name,
                Description   = x.Description,
                Address       = x.Address,
                PreferredDate = x.PreferredDate
            })
            .ToListAsync();
    }
    public async Task<ServiceRequestDto> GetServiceRequestDetailsAsync(string userId, int requestId)
    {
        var customer = await db.CustomerProfiles.FirstOrDefaultAsync(x => x.UserId == userId);
        var worker = await db.WorkerProfiles.Include(w => w.Categories).FirstOrDefaultAsync(x => x.UserId == userId);

        if (customer is null && worker is null)
            throw new UnauthorizedAccessException("User profile not found.");

        var request = await db.ServiceRequests
            .Include(r => r.Category)
            .Include(r => r.Customer)
            .Include(r => r.Quotations)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request is null)
            throw new KeyNotFoundException($"Service request with ID {requestId} not found.");

        if (customer != null && request.CustomerId != customer.Id && worker == null)
            throw new UnauthorizedAccessException("You are not authorized to view this service request.");

        return new ServiceRequestDto
        {
            Id              = request.Id,
            CustomerId      = request.CustomerId,
            CustomerName    = request.Customer?.FullName ?? "Customer",
            CategoryId      = request.CategoryId,
            CategoryName    = request.Category?.Name ?? "Service",
            CategoryIconUrl = request.Category?.IconUrl,
            Description     = request.Description,
            Address         = request.Address,
            Latitude        = request.Latitude,
            Longitude       = request.Longitude,
            PreferredDate   = request.PreferredDate,
            Status          = request.Status,
            PhotoUrls       = request.PhotoUrls,
            QuotationsCount = request.Quotations.Count
        };
    }

    public async Task<List<WorkerQuotationSummaryDto>> GetWorkerQuotationsAsync(string workerUserId)
    {
        var worker = await WorkerAsync(workerUserId);

        var myQuotes = await db.Quotations
            .Include(q => q.ServiceRequest).ThenInclude(r => r.Category)
            .Include(q => q.ServiceRequest).ThenInclude(r => r.Customer)
            .Where(q => q.WorkerId == worker.Id)
            .OrderByDescending(q => q.Id)
            .ToListAsync();

        var grouped = myQuotes.GroupBy(q => q.ServiceRequestId);
        var list = new List<WorkerQuotationSummaryDto>();

        foreach (var group in grouped)
        {
            var allInThread = group.OrderBy(q => q.Id).ToList();
            var firstQuote = allInThread.First();
            var latestQuote = allInThread.Last();

            var req = firstQuote.ServiceRequest;
            if (req == null) continue;

            var quotesDict = allInThread.ToDictionary(q => q.Id);
            int depth = GetNegotiationDepth(latestQuote, quotesDict);
            string proposedBy = (depth % 2 == 0) ? "Worker" : "Customer";

            list.Add(new WorkerQuotationSummaryDto
            {
                QuotationId           = latestQuote.Id,
                ServiceRequestId      = req.Id,
                CategoryName          = req.Category?.Name ?? "Service",
                CustomerName          = req.Customer?.FullName ?? "Customer",
                Address               = req.Address,
                RequestStatus         = req.Status,
                MyInitialPrice        = firstQuote.ProposedPrice,
                LatestPrice           = latestQuote.ProposedPrice,
                LatestStatus          = latestQuote.Status,
                LatestProposedBy      = proposedBy,
                LatestMessage         = latestQuote.Message,
                NegotiationStepsCount = allInThread.Count,
                PreferredDate         = req.PreferredDate
            });
        }

        return list;
    }

    public async Task<List<QuotationDto>> GetRequestQuotationsAsync(string userId, int requestId)
    {
        var customer = await db.CustomerProfiles.FirstOrDefaultAsync(x => x.UserId == userId);
        var worker = await db.WorkerProfiles.FirstOrDefaultAsync(x => x.UserId == userId);

        if (customer is null && worker is null)
            throw new UnauthorizedAccessException("User profile not found.");

        var request = await db.ServiceRequests
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == requestId);

        if (request is null)
            throw new KeyNotFoundException("Service request not found.");

        if (customer != null && request.CustomerId != customer.Id && worker == null)
            throw new UnauthorizedAccessException("You are not authorized to view quotations for this request.");

        var allQuotes = await db.Quotations
            .Include(x => x.Worker).ThenInclude(x => x.User)
            .Include(x => x.ServiceRequest)
            .Where(x => x.ServiceRequestId == requestId)
            .OrderBy(x => x.Id)
            .ToListAsync();

        var quotesDict = allQuotes.ToDictionary(q => q.Id);

        // If worker, show quotations submitted by / involving this worker
        var filteredQuotes = (worker != null && (customer == null || request.CustomerId != customer.Id))
            ? allQuotes.Where(q => q.WorkerId == worker.Id).ToList()
            : allQuotes;

        return filteredQuotes.Select(x =>
        {
            int depth = GetNegotiationDepth(x, quotesDict);
            return ToDto(x, x.Worker, depth);
        }).ToList();
    }

    public async Task<BookingDto> AcceptQuotationAsync(string userId, int quotationId)
    {
        var customer = await db.CustomerProfiles.FirstOrDefaultAsync(x => x.UserId == userId);
        var worker = await db.WorkerProfiles.FirstOrDefaultAsync(x => x.UserId == userId);

        if (customer is null && worker is null)
            throw new UnauthorizedAccessException("User profile not found.");

        var quote = await db.Quotations
            .Include(x => x.ServiceRequest).ThenInclude(x => x.Category)
            .Include(x => x.ServiceRequest).ThenInclude(x => x.Customer)
            .Include(x => x.Worker).ThenInclude(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == quotationId)
            ?? throw new KeyNotFoundException("Quotation not found.");

        if (quote.Status != "Pending")
            throw new InvalidOperationException("Only a pending quotation or counter-offer can be accepted.");

        if (quote.ServiceRequest.Status != "Open")
            throw new InvalidOperationException("This service request is no longer open.");

        // Calculate who proposed this pending quote
        var allQuotes = await db.Quotations
            .Where(x => x.ServiceRequestId == quote.ServiceRequestId)
            .ToDictionaryAsync(x => x.Id);

        int depth = GetNegotiationDepth(quote, allQuotes);
        string proposedBy = (depth % 2 == 0) ? "Worker" : "Customer";

        // If proposed by Worker, caller must be the Customer
        if (proposedBy == "Worker")
        {
            if (customer is null || quote.ServiceRequest.CustomerId != customer.Id)
                throw new UnauthorizedAccessException("Only the customer can accept this proposal.");
        }
        // If proposed by Customer (counter-offer), caller must be the Worker
        else
        {
            if (worker is null || quote.WorkerId != worker.Id)
                throw new UnauthorizedAccessException("Only the worker can accept this counter-offer.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync();
        quote.Status = "Accepted";
        quote.ServiceRequest.Status = "InProgress";

        var otherQuotes = await db.Quotations
            .Where(x => x.ServiceRequestId == quote.ServiceRequestId && x.Id != quote.Id && x.Status == "Pending")
            .ToListAsync();

        foreach (var other in otherQuotes) other.Status = "Rejected";

        var booking = new Booking
        {
            ServiceRequestId = quote.ServiceRequestId,
            WorkerId         = quote.WorkerId,
            CustomerId       = quote.ServiceRequest.CustomerId,
            AgreedPrice      = quote.ProposedPrice,
            ScheduledDate    = quote.ServiceRequest.PreferredDate,
            Status           = "Scheduled"
        };

        db.Bookings.Add(booking);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        // Notify other party
        var customerName = quote.ServiceRequest.Customer?.FullName ?? "Customer";
        var workerName = quote.Worker?.User?.Email ?? "Worker";

        if (proposedBy == "Worker" && quote.Worker != null)
        {
            await notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId          = quote.Worker.UserId,
                Type            = "BookingCreated",
                Message         = $"🎉 Your quotation of ৳{booking.AgreedPrice} was accepted by {customerName}! Booking #{booking.Id} is scheduled.",
                RelatedEntityId = booking.Id
            });
        }
        else if (proposedBy == "Customer" && quote.ServiceRequest.Customer != null)
        {
            await notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId          = quote.ServiceRequest.Customer.UserId,
                Type            = "BookingCreated",
                Message         = $"🎉 {workerName} accepted your counter-offer of ৳{booking.AgreedPrice}! Booking #{booking.Id} is scheduled.",
                RelatedEntityId = booking.Id
            });
        }

        // Broadcast real-time update to update negotiation screens live
        try
        {
            await realtimeNotifier.BroadcastAsync("QuotationUpdated", new
            {
                requestId = quote.ServiceRequestId,
                serviceRequestId = quote.ServiceRequestId,
                bookingId = booking.Id,
                status = "Accepted",
                price = booking.AgreedPrice
            });
        }
        catch { /* Non-blocking */ }

        return await BookingDtoAsync(booking.Id);
    }

    public async Task<QuotationDto> CounterQuotationAsync(string userId, int quotationId, CounterQuotationDto dto)
    {
        var customer = await db.CustomerProfiles.FirstOrDefaultAsync(x => x.UserId == userId);
        var worker = await db.WorkerProfiles.FirstOrDefaultAsync(x => x.UserId == userId);

        if (customer is null && worker is null)
            throw new UnauthorizedAccessException("User profile not found.");

        var quote = await db.Quotations
            .Include(x => x.ServiceRequest).ThenInclude(x => x.Customer)
            .Include(x => x.Worker).ThenInclude(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == quotationId)
            ?? throw new KeyNotFoundException("Quotation not found.");

        if (quote.Status != "Pending" || quote.ServiceRequest.Status != "Open")
            throw new InvalidOperationException("Only a pending quote on an open request can be countered.");

        // Calculate who proposed this pending quote
        var allQuotes = await db.Quotations
            .Where(x => x.ServiceRequestId == quote.ServiceRequestId)
            .ToDictionaryAsync(x => x.Id);

        int depth = GetNegotiationDepth(quote, allQuotes);
        string proposedBy = (depth % 2 == 0) ? "Worker" : "Customer";

        // If proposed by Worker, Customer counters
        if (proposedBy == "Worker")
        {
            if (customer is null || quote.ServiceRequest.CustomerId != customer.Id)
                throw new UnauthorizedAccessException("Only the customer can counter this proposal.");
        }
        // If proposed by Customer, Worker counters
        else
        {
            if (worker is null || quote.WorkerId != worker.Id)
                throw new UnauthorizedAccessException("Only the worker can counter this counter-offer.");
        }

        quote.Status = "Countered";
        var counter = new Quotation
        {
            ServiceRequestId  = quote.ServiceRequestId,
            WorkerId          = quote.WorkerId,
            ProposedPrice     = dto.ProposedPrice,
            Message           = dto.Message?.Trim(),
            Status            = "Pending",
            ParentQuotationId = quote.Id
        };

        db.Quotations.Add(counter);
        await db.SaveChangesAsync();

        int newDepth = depth + 1;
        var customerName = quote.ServiceRequest.Customer?.FullName ?? "Customer";
        var workerName = quote.Worker?.User?.Email ?? "Worker";

        // If Customer countered, notify Worker
        if (proposedBy == "Worker" && quote.Worker != null)
        {
            await notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId          = quote.Worker.UserId,
                Type            = "QuotationCountered",
                Message         = $"💬 {customerName} sent a counter-offer of ৳{dto.ProposedPrice} for Request #{quote.ServiceRequestId}.",
                RelatedEntityId = quote.ServiceRequestId
            });
        }
        // If Worker countered, notify Customer
        else if (proposedBy == "Customer" && quote.ServiceRequest.Customer != null)
        {
            await notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId          = quote.ServiceRequest.Customer.UserId,
                Type            = "QuotationCountered",
                Message         = $"💬 {workerName} responded with a counter-offer of ৳{dto.ProposedPrice} for Request #{quote.ServiceRequestId}.",
                RelatedEntityId = quote.ServiceRequestId
            });
        }

        // Broadcast real-time update to update negotiation screens live
        try
        {
            await realtimeNotifier.BroadcastAsync("QuotationUpdated", new
            {
                requestId = quote.ServiceRequestId,
                serviceRequestId = quote.ServiceRequestId,
                workerId = quote.WorkerId,
                status = counter.Status,
                price = counter.ProposedPrice
            });
        }
        catch { /* Non-blocking */ }

        return ToDto(counter, quote.Worker, newDepth);
    }

    public async Task<BookingDto> CreateBookingAsync(string customerUserId, CreateBookingDto dto)
    {
        var customer = await CustomerAsync(customerUserId);
        var quote = await db.Quotations.Include(x => x.ServiceRequest)
            .FirstOrDefaultAsync(x => x.Id == dto.QuotationId && x.ServiceRequest.CustomerId == customer.Id)
            ?? throw new KeyNotFoundException("Quotation not found.");

        if (quote.Status != "Accepted")
            throw new InvalidOperationException("A booking can only be created from an accepted quotation.");

        var booking = await db.Bookings.FirstOrDefaultAsync(x => x.ServiceRequestId == quote.ServiceRequestId && x.WorkerId == quote.WorkerId);
        if (booking is null)
            throw new InvalidOperationException("The accepted quotation does not have a booking. Please accept it again.");

        return await BookingDtoAsync(booking.Id);
    }

    public async Task<List<BookingDto>> GetCustomerBookingsAsync(string customerUserId)
    {
        var customer = await CustomerAsync(customerUserId);
        return await db.Bookings
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.Customer)
            .Include(b => b.ServiceRequest).ThenInclude(r => r.Category)
            .Where(b => b.CustomerId == customer.Id)
            .OrderByDescending(b => b.Id)
            .Select(b => new BookingDto
            {
                Id                 = b.Id,
                ServiceRequestId   = b.ServiceRequestId,
                CategoryName       = b.ServiceRequest.Category.Name,
                WorkerId           = b.WorkerId,
                WorkerName         = b.Worker.User.Email,
                CustomerId         = b.CustomerId,
                CustomerName       = b.Customer.FullName,
                AgreedPrice        = b.AgreedPrice,
                ScheduledDate      = b.ScheduledDate,
                Status             = b.Status,
                Address            = b.ServiceRequest.Address,
                Description        = b.ServiceRequest.Description
            })
            .ToListAsync();
    }

    public async Task<List<BookingDto>> GetWorkerBookingsAsync(string workerUserId)
    {
        var worker = await WorkerAsync(workerUserId);
        return await db.Bookings
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.Customer)
            .Include(b => b.ServiceRequest).ThenInclude(r => r.Category)
            .Where(b => b.WorkerId == worker.Id)
            .OrderByDescending(b => b.Id)
            .Select(b => new BookingDto
            {
                Id                 = b.Id,
                ServiceRequestId   = b.ServiceRequestId,
                CategoryName       = b.ServiceRequest.Category.Name,
                WorkerId           = b.WorkerId,
                WorkerName         = b.Worker.User.Email,
                CustomerId         = b.CustomerId,
                CustomerName       = b.Customer.FullName,
                AgreedPrice        = b.AgreedPrice,
                ScheduledDate      = b.ScheduledDate,
                Status             = b.Status,
                Address            = b.ServiceRequest.Address,
                Description        = b.ServiceRequest.Description
            })
            .ToListAsync();
    }

    public async Task<BookingDto> GetBookingAsync(string userId, string role, int bookingId)
    {
        var booking = await db.Bookings
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.Customer)
            .Include(b => b.ServiceRequest).ThenInclude(r => r.Category)
            .FirstOrDefaultAsync(b => b.Id == bookingId)
            ?? throw new KeyNotFoundException("Booking not found.");

        var isCustomer = booking.Customer.UserId == userId;
        var isWorker = booking.Worker.UserId == userId;

        if (!isCustomer && !isWorker)
            throw new UnauthorizedAccessException("You are not a participant in this booking.");

        return new BookingDto
        {
            Id                 = booking.Id,
            ServiceRequestId   = booking.ServiceRequestId,
            CategoryName       = booking.ServiceRequest.Category.Name,
            WorkerId           = booking.WorkerId,
            WorkerName         = booking.Worker.User?.Email ?? $"Worker #{booking.WorkerId}",
            CustomerId         = booking.CustomerId,
            CustomerName       = booking.Customer.FullName,
            AgreedPrice        = booking.AgreedPrice,
            ScheduledDate      = booking.ScheduledDate,
            Status             = booking.Status,
            Address            = booking.ServiceRequest.Address,
            Description        = booking.ServiceRequest.Description
        };
    }

    public async Task<BookingDto> UpdateBookingStatusAsync(string workerUserId, int bookingId, UpdateBookingStatusDto dto)
    {
        var worker = await WorkerAsync(workerUserId);
        var booking = await db.Bookings
            .Include(b => b.Customer)
            .FirstOrDefaultAsync(b => b.Id == bookingId && b.WorkerId == worker.Id)
            ?? throw new KeyNotFoundException("Booking not found.");

        var validTransitions = booking.Status switch
        {
            "Scheduled" => new[] { "InProgress", "Cancelled" },
            "InProgress" => new[] { "Completed", "Cancelled" },
            _ => Array.Empty<string>()
        };

        if (!validTransitions.Contains(dto.Status))
            throw new InvalidOperationException($"Cannot transition booking from {booking.Status} to {dto.Status}.");

        booking.Status = dto.Status;
        if (dto.Status == "Completed")
        {
            var req = await db.ServiceRequests.FindAsync(booking.ServiceRequestId);
            if (req != null) req.Status = "Completed";
        }

        await db.SaveChangesAsync();

        // Notify customer
        if (booking.Customer != null)
        {
            await notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId          = booking.Customer.UserId,
                Type            = "BookingStatusChanged",
                Message         = $"🔧 Booking #{booking.Id} status was updated to '{dto.Status}' by worker.",
                RelatedEntityId = booking.Id
            });
        }

        return await BookingDtoAsync(bookingId);
    }

    private async Task<BookingDto> BookingDtoAsync(int id)
    {
        var x = await db.Bookings.Include(b => b.Worker).ThenInclude(w => w.User).Include(b => b.Customer).Include(b => b.ServiceRequest).ThenInclude(r => r.Category).FirstAsync(b => b.Id == id);
        return new BookingDto
        {
            Id                 = x.Id,
            ServiceRequestId   = x.ServiceRequestId,
            CategoryName       = x.ServiceRequest.Category.Name,
            WorkerId           = x.WorkerId,
            WorkerName         = x.Worker.User?.Email ?? $"Worker #{x.WorkerId}",
            CustomerId         = x.CustomerId,
            CustomerName       = x.Customer.FullName,
            AgreedPrice        = x.AgreedPrice,
            ScheduledDate      = x.ScheduledDate,
            Status             = x.Status,
            Address            = x.ServiceRequest.Address,
            Description        = x.ServiceRequest.Description
        };
    }

    private static QuotationDto ToDto(Quotation x, WorkerProfile? worker, int depth) =>
        new()
        {
            Id                 = x.Id,
            ServiceRequestId   = x.ServiceRequestId,
            WorkerId           = x.WorkerId,
            WorkerName         = worker?.User?.Email ?? $"Worker #{x.WorkerId}",
            WorkerBio          = worker?.Bio,
            AverageRating      = worker?.AverageRating ?? 0.0,
            ProposedPrice      = x.ProposedPrice,
            Message            = x.Message,
            Status             = x.Status,
            ParentQuotationId  = x.ParentQuotationId,
            NegotiationDepth   = depth,
            ProposedBy         = (depth % 2 == 0) ? "Worker" : "Customer"
        };
}
