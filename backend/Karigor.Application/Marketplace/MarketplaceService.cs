using Karigor.Application.Customer.DTOs;
using Karigor.Application.Marketplace.DTOs;
using Karigor.Application.Notifications;
using Karigor.Application.Notifications.DTOs;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using System.Security.Cryptography;
using System.Text;

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
        var visited = new HashSet<int> { q.Id };
        while (curr.ParentQuotationId.HasValue && allQuotes.TryGetValue(curr.ParentQuotationId.Value, out var parent))
        {
            if (!visited.Add(parent.Id)) break; // Corrupt legacy history must not hang reads.
            depth++;
            curr = parent;
        }
        return depth;
    }

    private static bool IsTimeOverlapping(DateTime t1, DateTime t2)
    {
        return Math.Abs((t1 - t2).TotalMinutes) < 120;
    }

    private static bool IsSameLocationAndCustomer(
        int customerId1, double? lat1, double? lon1,
        int customerId2, double? lat2, double? lon2)
    {
        if (customerId1 != customerId2) return false;
        if (lat1 == null || lat2 == null || lon1 == null || lon2 == null) return false;
        return Math.Abs(lat1.Value - lat2.Value) < 0.0001
            && Math.Abs(lon1.Value - lon2.Value) < 0.0001;
    }

    private async Task<bool> CheckSimultaneousJobWarningAsync(int workerId, ServiceRequest request)
    {
        var existingBookings = await db.Bookings
            .Include(b => b.ServiceRequest)
            .Where(b => b.WorkerId == workerId
                     && b.ServiceRequestId != request.Id
                     && (b.Status == "Scheduled" || b.Status == "InProgress"))
            .ToListAsync();

        var hasOverlappingBooking = existingBookings.Any(b =>
            IsTimeOverlapping(b.ScheduledDate, request.PreferredDate) &&
            IsSameLocationAndCustomer(request.CustomerId, request.Latitude, request.Longitude,
                                      b.CustomerId, b.ServiceRequest?.Latitude, b.ServiceRequest?.Longitude));

        if (hasOverlappingBooking) return true;

        var existingQuotes = await db.Quotations
            .Include(q => q.ServiceRequest)
            .Where(q => q.WorkerId == workerId
                     && q.ServiceRequestId != request.Id
                     && q.Status == "Pending"
                     && q.ServiceRequest.Status == "Open")
            .ToListAsync();

        var hasOverlappingQuote = existingQuotes.Any(q =>
            IsTimeOverlapping(q.ServiceRequest.PreferredDate, request.PreferredDate) &&
            IsSameLocationAndCustomer(request.CustomerId, request.Latitude, request.Longitude,
                                      q.ServiceRequest.CustomerId, q.ServiceRequest.Latitude, q.ServiceRequest.Longitude));

        return hasOverlappingQuote;
    }

    public async Task<QuotationDto> CreateQuotationAsync(string workerUserId, CreateQuotationDto dto)
    {
        ValidatePrice(dto.ProposedPrice);
        var (quotation, worker, request, hasSimultaneousJobWarning) = await NegotiationTransactionAsync(async () =>
        {
            var worker = await WorkerAsync(workerUserId);
            var request = await db.ServiceRequests.Include(x => x.Category).Include(x => x.Customer)
                .SingleOrDefaultAsync(x => x.Id == dto.ServiceRequestId)
                ?? throw new KeyNotFoundException("Service request not found.");
            if (request.Customer.UserId == workerUserId) throw new UnauthorizedAccessException("Cannot bid on your own request.");
            if (request.Status != "Open") throw new NegotiationConflictException();
            // An initial POST is a submission, never an edit or a second root.
            if (await db.Quotations.AnyAsync(q => q.ServiceRequestId == request.Id && q.WorkerId == worker.Id))
                throw new NegotiationConflictException();
            // Schedule conflict check:
            // A worker CAN submit a quotation for a time that overlaps with their existing accepted bookings/active quotes
            // ONLY IF the Latitude, Longitude, and CustomerId of the new Service Request exactly match the existing one.
            // If they do not match, block it normally with a time conflict error.
            var existingBookings = await db.Bookings
                .Include(b => b.ServiceRequest)
                .Where(b => b.WorkerId == worker.Id
                         && b.ServiceRequestId != request.Id
                         && (b.Status == "Scheduled" || b.Status == "InProgress"))
                .ToListAsync();

            var existingActiveQuotes = await db.Quotations
                .Include(q => q.ServiceRequest)
                .Where(q => q.WorkerId == worker.Id
                         && q.ServiceRequestId != request.Id
                         && q.Status == "Pending"
                         && q.ServiceRequest.Status == "Open")
                .ToListAsync();

            var overlappingBookings = existingBookings
                .Where(b => IsTimeOverlapping(b.ScheduledDate, request.PreferredDate))
                .ToList();

            var overlappingQuotes = existingActiveQuotes
                .Where(q => IsTimeOverlapping(q.ServiceRequest.PreferredDate, request.PreferredDate))
                .ToList();

            bool hasOverlap = overlappingBookings.Count > 0 || overlappingQuotes.Count > 0;
            bool hasSimultaneousJobWarning = false;

            if (hasOverlap)
            {
                // Verify whether all overlapping bookings and quotes match CustomerId, Latitude, and Longitude
                bool allMatchGeoCustomer =
                    overlappingBookings.All(b => IsSameLocationAndCustomer(
                        request.CustomerId, request.Latitude, request.Longitude,
                        b.CustomerId, b.ServiceRequest?.Latitude, b.ServiceRequest?.Longitude))
                    &&
                    overlappingQuotes.All(q => IsSameLocationAndCustomer(
                        request.CustomerId, request.Latitude, request.Longitude,
                        q.ServiceRequest.CustomerId, q.ServiceRequest.Latitude, q.ServiceRequest.Longitude));

                if (!allMatchGeoCustomer)
                {
                    throw new InvalidOperationException(
                        "Schedule conflict: You have an existing booking or quotation overlapping with this scheduled time.");
                }

                // Exception triggered: same time, location, and customer!
                hasSimultaneousJobWarning = true;

            }

            await TouchRequestAsync(request);
            var quotation = new Quotation
            {
                ServiceRequestId = request.Id, WorkerId = worker.Id,
                ProposedPrice = dto.ProposedPrice, Message = dto.Message?.Trim(), Status = "Pending",
                ProposedByUserId = workerUserId, CreatedAt = DateTime.UtcNow
            };
            db.Quotations.Add(quotation);
            await db.SaveChangesAsync();
            return (quotation, worker, request, hasSimultaneousJobWarning);
        });

        if (hasSimultaneousJobWarning)
            await notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId = request.Customer.UserId, Type = "MultiJobBidWarning",
                Message = "Worker is bidding on another job at the same time and location.", RelatedEntityId = request.Id
            });
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
            await NotifyQuotationParticipantsAsync(quotation.Id, new
            {
                requestId = request.Id,
                serviceRequestId = request.Id,
                workerId = worker.Id,
                status = quotation.Status,
                price = quotation.ProposedPrice,
                hasSimultaneousJobWarning = hasSimultaneousJobWarning
            });
        }
        catch { /* Non-blocking */ }

        return ToDto(quotation, worker, 0, hasSimultaneousJobWarning);
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

            string proposedBy = ProposerRole(latestQuote);

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
                LatestProposedByUserId = latestQuote.ProposedByUserId,
                Version = Convert.ToBase64String(latestQuote.RowVersion),
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
            .Include(x => x.ServiceRequest).ThenInclude(x => x.Customer)
            .Where(x => x.ServiceRequestId == requestId)
            .OrderBy(x => x.Id)
            .ToListAsync();

        var quotesDict = allQuotes.ToDictionary(q => q.Id);

        // If worker, show quotations submitted by / involving this worker
        var filteredQuotes = (worker != null && (customer == null || request.CustomerId != customer.Id))
            ? allQuotes.Where(q => q.WorkerId == worker.Id).ToList()
            : allQuotes;

        var workerIds = filteredQuotes.Select(q => q.WorkerId).Distinct().ToList();
        var warningFlags = new Dictionary<int, bool>();
        foreach (var wId in workerIds)
        {
            warningFlags[wId] = await CheckSimultaneousJobWarningAsync(wId, request);
        }

        return filteredQuotes.Select(x =>
        {
            int depth = GetNegotiationDepth(x, quotesDict);
            bool warning = warningFlags.TryGetValue(x.WorkerId, out var hasWarn) && hasWarn;
            return ToDto(x, x.Worker, depth, warning);
        }).ToList();
    }

    public async Task<BookingDto> AcceptQuotationAsync(string userId, int quotationId, string? expectedVersion)
    {
        var (quote, booking) = await NegotiationTransactionAsync(async () =>
        {
            // Every retry loads fresh state inside its own transaction.
            var quote = await CurrentOfferAsync(userId, quotationId, expectedVersion);
            quote.ServiceRequest.Status = "InProgress";
            await TouchRequestAsync(quote.ServiceRequest);
            quote.Status = "Accepted";
            var competitors = await db.Quotations
                .Where(q => q.ServiceRequestId == quote.ServiceRequestId && q.Id != quote.Id && q.Status == "Pending")
                .ToListAsync();
            foreach (var other in competitors) other.Status = "Rejected";
            await db.SaveChangesAsync();
            var booking = new Booking
            {
                ServiceRequestId = quote.ServiceRequestId, WorkerId = quote.WorkerId,
                CustomerId = quote.ServiceRequest.CustomerId, AgreedPrice = quote.ProposedPrice,
                ScheduledDate = quote.ServiceRequest.PreferredDate, Status = "Scheduled"
            };
            db.Bookings.Add(booking);
            await db.SaveChangesAsync();
            return (quote, booking);
        });
        var proposedBy = ProposerRole(quote);

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
            await NotifyQuotationParticipantsAsync(quote.Id, new
            {
                requestId = quote.ServiceRequestId,
                serviceRequestId = quote.ServiceRequestId,
                bookingId = booking.Id,
                status = "Accepted",
                price = booking.AgreedPrice
            });
            // Competitors learn only that their known request closed, never winning terms.
            var otherWorkerUsers = await db.Quotations.AsNoTracking()
                .Where(q => q.ServiceRequestId == quote.ServiceRequestId && q.WorkerId != quote.WorkerId)
                .Select(q => q.Worker.UserId).Distinct().ToListAsync();
            foreach (var recipient in otherWorkerUsers)
                await realtimeNotifier.NotifyUserAsync(recipient, "QuotationUpdated", new
                {
                    requestId = quote.ServiceRequestId,
                    status = "Closed"
                });
        }
        catch { /* Non-blocking */ }

        return await BookingDtoAsync(booking.Id);
    }

    public async Task<QuotationDto> CounterQuotationAsync(string userId, int quotationId, CounterQuotationDto dto)
    {
        ValidatePrice(dto.ProposedPrice);
        var (quote, counter) = await NegotiationTransactionAsync(async () =>
        {
            var quote = await CurrentOfferAsync(userId, quotationId, dto.ExpectedVersion);
            await TouchRequestAsync(quote.ServiceRequest);
            quote.Status = "Countered";
            // Release the filtered Pending key before inserting its immutable child.
            await db.SaveChangesAsync();
            var counter = new Quotation
            {
                ServiceRequestId = quote.ServiceRequestId, WorkerId = quote.WorkerId,
                ProposedPrice = dto.ProposedPrice, Message = dto.Message?.Trim(), Status = "Pending",
                ParentQuotationId = quote.Id, ProposedByUserId = userId, CreatedAt = DateTime.UtcNow
            };
            db.Quotations.Add(counter);
            await db.SaveChangesAsync();
            return (quote, counter);
        });
        var proposedBy = ProposerRole(quote);
        var history = await db.Quotations.AsNoTracking().Where(q => q.ServiceRequestId == quote.ServiceRequestId)
            .ToDictionaryAsync(q => q.Id);
        int newDepth = GetNegotiationDepth(counter, history);
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
            await NotifyQuotationParticipantsAsync(counter.Id, new
            {
                requestId = quote.ServiceRequestId,
                serviceRequestId = quote.ServiceRequestId,
                workerId = quote.WorkerId,
                status = counter.Status,
                price = counter.ProposedPrice
            });
        }
        catch { /* Non-blocking */ }

        bool warning = await CheckSimultaneousJobWarningAsync(quote.WorkerId, quote.ServiceRequest);
        return ToDto(counter, quote.Worker, newDepth, warning);
    }

    private static string ProposerRole(Quotation offer) =>
        offer.ProposedByUserId is null ? "Unknown" :
        offer.ProposedByUserId == offer.Worker.UserId ? "Worker" :
        offer.ProposedByUserId == offer.ServiceRequest.Customer.UserId ? "Customer" : "Unknown";

    private static void ValidatePrice(decimal price)
    {
        if (price < 0.01m || price > 99999999m || decimal.Round(price, 2) != price)
            throw new InvalidOperationException("Offer prices must be positive and have at most two decimal places.");
    }

    private async Task<Quotation> CurrentOfferAsync(string actor, int id, string? expectedVersion)
    {
        var quote = await db.Quotations
            .Include(q => q.Worker).ThenInclude(w => w.User)
            .Include(q => q.ServiceRequest).ThenInclude(r => r.Customer)
            .Include(q => q.ServiceRequest).ThenInclude(r => r.Category)
            .SingleOrDefaultAsync(q => q.Id == id) ?? throw new KeyNotFoundException("Quotation not found.");
        var customer = quote.ServiceRequest.Customer.UserId;
        var worker = quote.Worker.UserId;
        if ((actor != customer && actor != worker) || actor == quote.ProposedByUserId || customer == worker)
            throw new UnauthorizedAccessException("Only the opposite participant may respond to an offer.");
        if (quote.ProposedByUserId != customer && quote.ProposedByUserId != worker)
            throw new NegotiationConflictException(); // Unknown legacy provenance fails closed.
        if (quote.Status != "Pending" || quote.ServiceRequest.Status != "Open" ||
            expectedVersion != Convert.ToBase64String(quote.RowVersion) ||
            await db.Quotations.AnyAsync(q => q.ParentQuotationId == id) ||
            await db.Bookings.AnyAsync(b => b.ServiceRequestId == quote.ServiceRequestId))
            throw new NegotiationConflictException();
        return quote;
    }

    private async Task TouchRequestAsync(ServiceRequest request)
    {
        // A rowversion-checked write orders all F5 mutations on this request.
        // Save it first so competing workers cannot commit inconsistent winners.
        db.Entry(request).Property(r => r.Status).IsModified = true;
        await db.SaveChangesAsync();
    }

    private async Task<T> NegotiationTransactionAsync<T>(Func<Task<T>> action)
    {
        try
        {
            return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                await using var transaction = await db.Database.BeginTransactionAsync();
                var result = await action();
                await transaction.CommitAsync();
                return result;
            });
        }
        catch (DbUpdateConcurrencyException) { db.ChangeTracker.Clear(); throw new NegotiationConflictException(); }
        catch (DbUpdateException e) when (e.InnerException is SqlException { Number: 2601 or 2627 })
        { db.ChangeTracker.Clear(); throw new NegotiationConflictException(); }
    }

    private async Task NotifyQuotationParticipantsAsync(int quotationId, object data)
    {
        var recipients = await db.Quotations.AsNoTracking().Where(q => q.Id == quotationId)
            .Select(q => new { Customer = q.ServiceRequest.Customer.UserId, Worker = q.Worker.UserId })
            .SingleAsync();
        foreach (var recipient in new[] { recipients.Customer, recipients.Worker }.Distinct())
            await realtimeNotifier.NotifyUserAsync(recipient, "QuotationUpdated", data);
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
            .Include(b => b.Review)
            .Where(b => b.CustomerId == customer.Id)
            .OrderByDescending(b => b.Id)
            .Select(b => new BookingDto
            {
                Id                 = b.Id,
                ServiceRequestId   = b.ServiceRequestId,
                CategoryName       = b.ServiceRequest.Category.Name,
                WorkerId           = b.WorkerId,
                WorkerName         = b.Worker.User.Email ?? $"Worker #{b.WorkerId}",
                CustomerId         = b.CustomerId,
                CustomerName       = b.Customer.FullName,
                AgreedPrice        = b.AgreedPrice,
                ScheduledDate      = b.ScheduledDate,
                Status             = b.Status,
                Address            = b.ServiceRequest.Address,
                Description        = b.ServiceRequest.Description,
                CheckedInAt        = b.CheckedInAt,
                HasActiveVerificationCode = b.VerificationCodeHash != null && b.VerificationCodeExpiresAt > DateTime.UtcNow,
                VerificationCodeExpiresAt = b.VerificationCodeHash != null && b.VerificationCodeExpiresAt > DateTime.UtcNow ? b.VerificationCodeExpiresAt : null,
                Review             = b.Review != null ? new Karigor.Application.Reviews.DTOs.ReviewDto
                {
                    Id             = b.Review.Id,
                    BookingId      = b.Review.BookingId,
                    WorkerId       = b.WorkerId,
                    WorkerName     = b.Worker.User.Email ?? $"Worker #{b.WorkerId}",
                    CustomerId     = b.CustomerId,
                    CustomerName   = b.Customer.FullName ?? "Customer",
                    CategoryName   = b.ServiceRequest.Category.Name,
                    Rating         = b.Review.Rating,
                    Comment        = b.Review.Comment,
                    WorkerResponse = b.Review.WorkerResponse,
                    BookingDate    = b.ScheduledDate
                } : null,
                PaymentStatus  = b.PaymentStatus ?? "Unpaid",
                PlatformFee    = Math.Round(b.AgreedPrice * 0.02m, 2),
                ServiceCharge  = Math.Round(b.AgreedPrice * 0.04m, 2),
                WorkerAmount   = b.AgreedPrice - Math.Round(b.AgreedPrice * 0.06m, 2)
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
            .Include(b => b.Review)
            .Where(b => b.WorkerId == worker.Id)
            .OrderByDescending(b => b.Id)
            .Select(b => new BookingDto
            {
                Id                 = b.Id,
                ServiceRequestId   = b.ServiceRequestId,
                CategoryName       = b.ServiceRequest.Category.Name,
                WorkerId           = b.WorkerId,
                WorkerName         = b.Worker.User.Email ?? $"Worker #{b.WorkerId}",
                CustomerId         = b.CustomerId,
                CustomerName       = b.Customer.FullName,
                AgreedPrice        = b.AgreedPrice,
                ScheduledDate      = b.ScheduledDate,
                Status             = b.Status,
                Address            = b.ServiceRequest.Address,
                Description        = b.ServiceRequest.Description,
                CheckedInAt        = b.CheckedInAt,
                HasActiveVerificationCode = false, // worker shouldn't see customer's active code state to avoid confusion, or it can just be false
                VerificationCodeExpiresAt = null,
                Review             = b.Review != null ? new Karigor.Application.Reviews.DTOs.ReviewDto
                {
                    Id             = b.Review.Id,
                    BookingId      = b.Review.BookingId,
                    WorkerId       = b.WorkerId,
                    WorkerName     = b.Worker.User.Email ?? $"Worker #{b.WorkerId}",
                    CustomerId     = b.CustomerId,
                    CustomerName   = b.Customer.FullName ?? "Customer",
                    CategoryName   = b.ServiceRequest.Category.Name,
                    Rating         = b.Review.Rating,
                    Comment        = b.Review.Comment,
                    WorkerResponse = b.Review.WorkerResponse,
                    BookingDate    = b.ScheduledDate
                } : null,
                PaymentStatus  = b.PaymentStatus ?? "Unpaid",
                PlatformFee    = Math.Round(b.AgreedPrice * 0.02m, 2),
                ServiceCharge  = Math.Round(b.AgreedPrice * 0.04m, 2),
                WorkerAmount   = b.AgreedPrice - Math.Round(b.AgreedPrice * 0.06m, 2)
            })
            .ToListAsync();
    }

    public async Task<BookingDto> GetBookingAsync(string userId, string role, int bookingId)
    {
        var booking = await db.Bookings
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.Customer)
            .Include(b => b.ServiceRequest).ThenInclude(r => r.Category)
            .Include(b => b.Review)
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
            Description        = booking.ServiceRequest.Description,
            CheckedInAt        = booking.CheckedInAt,
            HasActiveVerificationCode = isCustomer && booking.VerificationCodeHash != null && booking.VerificationCodeExpiresAt > DateTime.UtcNow,
            VerificationCodeExpiresAt = isCustomer && booking.VerificationCodeHash != null && booking.VerificationCodeExpiresAt > DateTime.UtcNow ? booking.VerificationCodeExpiresAt : null,
            Review             = booking.Review != null ? new Karigor.Application.Reviews.DTOs.ReviewDto
            {
                Id             = booking.Review.Id,
                BookingId      = booking.Review.BookingId,
                WorkerId       = booking.WorkerId,
                WorkerName     = booking.Worker.User?.Email ?? $"Worker #{booking.WorkerId}",
                CustomerId     = booking.CustomerId,
                CustomerName   = booking.Customer.FullName ?? "Customer",
                CategoryName   = booking.ServiceRequest.Category.Name,
                Rating         = booking.Review.Rating,
                Comment        = booking.Review.Comment,
                WorkerResponse = booking.Review.WorkerResponse,
                BookingDate    = booking.ScheduledDate
            } : null,
            PaymentStatus  = booking.PaymentStatus ?? "Unpaid",
            PlatformFee    = Math.Round(booking.AgreedPrice * 0.02m, 2),
            ServiceCharge  = Math.Round(booking.AgreedPrice * 0.04m, 2),
            WorkerAmount   = booking.AgreedPrice - Math.Round(booking.AgreedPrice * 0.06m, 2)
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
            "Scheduled" => new[] { "Cancelled" }, // InProgress now requires OTP check-in
            "InProgress" => new[] { "Completed", "Cancelled" },
            _ => Array.Empty<string>()
        };

        if (!validTransitions.Contains(dto.Status))
            throw new InvalidOperationException($"Cannot manually transition booking from {booking.Status} to {dto.Status}.");

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

    public async Task<GenerateVerificationCodeResponseDto> GenerateVerificationCodeAsync(string customerUserId, int bookingId)
    {
        var customer = await CustomerAsync(customerUserId);
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId && b.CustomerId == customer.Id)
            ?? throw new KeyNotFoundException("Booking not found.");

        if (booking.Status != "Scheduled")
            throw new InvalidOperationException("Verification code can only be generated for scheduled bookings.");

        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(code));
        
        booking.VerificationCodeHash = Convert.ToBase64String(hash);
        booking.VerificationCodeExpiresAt = DateTime.UtcNow.AddMinutes(15);
        booking.VerificationAttempts = 0;

        await db.SaveChangesAsync();

        return new GenerateVerificationCodeResponseDto
        {
            VerificationCode = code,
            ExpiresAt = booking.VerificationCodeExpiresAt.Value
        };
    }

    public async Task<BookingDto> VerifyWorkerCheckInAsync(string workerUserId, int bookingId, WorkerCheckInDto dto)
    {
        var worker = await WorkerAsync(workerUserId);
        var booking = await db.Bookings
            .Include(b => b.Customer)
            .FirstOrDefaultAsync(b => b.Id == bookingId && b.WorkerId == worker.Id)
            ?? throw new KeyNotFoundException("Booking not found.");

        if (booking.Status != "Scheduled")
            throw new InvalidOperationException("Booking is not in a check-in state.");

        if (string.IsNullOrEmpty(booking.VerificationCodeHash) || booking.VerificationCodeExpiresAt == null)
            throw new InvalidOperationException("No active verification code for this booking. Customer must generate one.");

        if (DateTime.UtcNow > booking.VerificationCodeExpiresAt.Value)
            throw new InvalidOperationException("Verification code has expired.");

        if (booking.VerificationAttempts >= 5)
            throw new InvalidOperationException("Too many invalid verification attempts. Customer must generate a new code.");

        var inputHash = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(dto.VerificationCode.Trim())));
        if (inputHash != booking.VerificationCodeHash)
        {
            booking.VerificationAttempts++;
            await db.SaveChangesAsync();
            throw new InvalidOperationException("Invalid verification code.");
        }

        booking.Status = "InProgress";
        booking.CheckedInAt = DateTime.UtcNow;
        booking.VerificationCodeHash = null;
        booking.VerificationCodeExpiresAt = null;
        booking.VerificationAttempts = 0;

        var req = await db.ServiceRequests.FindAsync(booking.ServiceRequestId);
        if (req != null) req.Status = "InProgress";

        await db.SaveChangesAsync();

        if (booking.Customer != null)
        {
            await notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId          = booking.Customer.UserId,
                Type            = "WorkerCheckedIn",
                Message         = $"✅ Worker has successfully verified their identity and checked in for Booking #{booking.Id}.",
                RelatedEntityId = booking.Id
            });
        }

        return await BookingDtoAsync(bookingId);
    }

    private async Task<BookingDto> BookingDtoAsync(int bookingId)
    {
        var x = await db.Bookings
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.Customer)
            .Include(b => b.ServiceRequest).ThenInclude(r => r.Category)
            .Include(b => b.Review)
            .FirstAsync(b => b.Id == bookingId);

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
            Description        = x.ServiceRequest.Description,
            CheckedInAt        = x.CheckedInAt,
            HasActiveVerificationCode = x.VerificationCodeHash != null && x.VerificationCodeExpiresAt > DateTime.UtcNow,
            VerificationCodeExpiresAt = x.VerificationCodeHash != null && x.VerificationCodeExpiresAt > DateTime.UtcNow ? x.VerificationCodeExpiresAt : null,
            Review             = x.Review != null ? new Karigor.Application.Reviews.DTOs.ReviewDto
            {
                Id             = x.Review.Id,
                BookingId      = x.Review.BookingId,
                WorkerId       = x.WorkerId,
                WorkerName     = x.Worker.User?.Email ?? $"Worker #{x.WorkerId}",
                CustomerId     = x.CustomerId,
                CustomerName   = x.Customer.FullName ?? "Customer",
                CategoryName   = x.ServiceRequest.Category.Name,
                Rating         = x.Review.Rating,
                Comment        = x.Review.Comment,
                WorkerResponse = x.Review.WorkerResponse,
                BookingDate    = x.ScheduledDate
            } : null,
            PaymentStatus  = x.PaymentStatus ?? "Unpaid",
            PlatformFee    = Math.Round(x.AgreedPrice * 0.02m, 2),
            ServiceCharge  = Math.Round(x.AgreedPrice * 0.04m, 2),
            WorkerAmount   = x.AgreedPrice - Math.Round(x.AgreedPrice * 0.06m, 2)
        };
    }

    private static QuotationDto ToDto(Quotation x, WorkerProfile? worker, int depth, bool hasSimultaneousJobWarning = false) =>
        new()
        {
            Id                          = x.Id,
            ServiceRequestId            = x.ServiceRequestId,
            WorkerId                    = x.WorkerId,
            WorkerName                  = worker?.User?.Email ?? $"Worker #{x.WorkerId}",
            WorkerBio                   = worker?.Bio,
            AverageRating               = worker?.AverageRating ?? 0.0,
            ProposedPrice               = x.ProposedPrice,
            Message                     = x.Message,
            Status                      = x.Status,
            ParentQuotationId           = x.ParentQuotationId,
            NegotiationDepth            = depth,
            ProposedBy                  = ProposerRole(x),
            ProposedByUserId            = x.ProposedByUserId,
            CreatedAt                  = x.CreatedAt,
            Version                    = Convert.ToBase64String(x.RowVersion),
            HasSimultaneousJobWarning   = hasSimultaneousJobWarning
        };
}
