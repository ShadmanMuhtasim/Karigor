using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karigor.Application.Notifications;
using Karigor.Application.Notifications.DTOs;
using Karigor.Application.Realtime;
using Karigor.Application.Sos.DTOs;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Application.Sos;

public class SosService : ISosService
{
    private readonly KarigorDbContext _db;
    private readonly IRealtimeNotifier _notifier;
    private readonly INotificationService _notificationService;

    public SosService(
        KarigorDbContext db,
        IRealtimeNotifier notifier,
        INotificationService notificationService)
    {
        _db = db;
        _notifier = notifier;
        _notificationService = notificationService;
    }

    public async Task<SosAlertDto> TriggerSosAsync(string customerUserId, int bookingId)
    {
        var customer = await _db.CustomerProfiles
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.UserId == customerUserId);

        if (customer is null)
            throw new KeyNotFoundException("Customer profile not found.");

        var booking = await _db.Bookings
            .Include(b => b.Customer).ThenInclude(c => c.User)
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.ServiceRequest).ThenInclude(sr => sr.Category)
            .FirstOrDefaultAsync(b => b.Id == bookingId);

        if (booking is null)
            throw new KeyNotFoundException($"Booking #{bookingId} not found.");

        if (booking.CustomerId != customer.Id)
            throw new InvalidOperationException("You can only trigger an SOS alert for your own bookings.");

        var status = booking.Status ?? string.Empty;
        var isActive = string.Equals(status, "Scheduled", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(status, "Confirmed", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(status, "InProgress", StringComparison.OrdinalIgnoreCase);

        if (!isActive)
        {
            throw new InvalidOperationException($"SOS can only be triggered for active bookings (Scheduled, Confirmed, or InProgress). Current status is '{status}'.");
        }

        // Check if an unresolved SOS alert already exists for this booking
        var existingAlert = await _db.SosAlerts
            .Include(a => a.Booking).ThenInclude(b => b.ServiceRequest).ThenInclude(sr => sr.Category)
            .Include(a => a.Customer).ThenInclude(c => c.User)
            .Include(a => a.Worker).ThenInclude(w => w.User)
            .Include(a => a.ResolvedByAdmin)
            .FirstOrDefaultAsync(a => a.BookingId == bookingId &&
                                      (a.Status == SosAlertStatus.Open || a.Status == SosAlertStatus.Contacted || a.Status == SosAlertStatus.Escalated));

        SosAlert alert;
        if (existingAlert != null)
        {
            alert = existingAlert;
            alert.TriggeredAt = DateTime.UtcNow; // refresh timestamp
            await _db.SaveChangesAsync();
        }
        else
        {
            alert = new SosAlert
            {
                BookingId = booking.Id,
                CustomerId = customer.Id,
                WorkerId = booking.WorkerId,
                TriggeredAt = DateTime.UtcNow,
                Status = SosAlertStatus.Open
            };

            _db.SosAlerts.Add(alert);
            await _db.SaveChangesAsync();
        }

        var dto = MapToDto(alert, booking);

        // 1. Real-time push to ALL connected Admins via SignalR "Admins" group
        await _notifier.NotifyAdminsAsync("SosAlertTriggered", dto);

        // 2. Persistent In-App Notification for every Admin user
        var adminRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Admin");
        if (adminRole != null)
        {
            var adminUserIds = await _db.UserRoles
                .Where(ur => ur.RoleId == adminRole.Id)
                .Select(ur => ur.UserId)
                .ToListAsync();

            foreach (var adminId in adminUserIds)
            {
                await _notificationService.CreateNotificationAsync(new CreateNotificationDto
                {
                    UserId = adminId,
                    Type = "SosAlert",
                    Message = $"🚨 EMERGENCY SOS: Customer {dto.CustomerName} triggered an SOS alert for Booking #{booking.Id} ({dto.ServiceCategoryName})!",
                    RelatedEntityId = alert.Id
                });
            }
        }

        return dto;
    }

    public async Task<List<SosAlertDto>> GetSosAlertsAsync(string? status = null)
    {
        var query = _db.SosAlerts
            .Include(a => a.Booking).ThenInclude(b => b.ServiceRequest).ThenInclude(sr => sr.Category)
            .Include(a => a.Customer).ThenInclude(c => c.User)
            .Include(a => a.Worker).ThenInclude(w => w.User)
            .Include(a => a.ResolvedByAdmin)
            .AsQueryable();

        if (string.IsNullOrWhiteSpace(status) || string.Equals(status, "unresolved", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(a => a.Status != SosAlertStatus.Resolved);
        }
        else if (!string.Equals(status, "all", StringComparison.OrdinalIgnoreCase) &&
                 Enum.TryParse<SosAlertStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(a => a.Status == parsedStatus);
        }

        var alerts = await query
            .OrderByDescending(a => a.TriggeredAt)
            .ToListAsync();

        return alerts.Select(a => MapToDto(a, a.Booking)).ToList();
    }

    public async Task<SosAlertDto> UpdateSosStatusAsync(string adminUserId, int alertId, UpdateSosStatusDto dto)
    {
        var alert = await _db.SosAlerts
            .Include(a => a.Booking).ThenInclude(b => b.ServiceRequest).ThenInclude(sr => sr.Category)
            .Include(a => a.Customer).ThenInclude(c => c.User)
            .Include(a => a.Worker).ThenInclude(w => w.User)
            .Include(a => a.ResolvedByAdmin)
            .FirstOrDefaultAsync(a => a.Id == alertId);

        if (alert is null)
            throw new KeyNotFoundException($"SOS alert #{alertId} not found.");

        if (!Enum.TryParse<SosAlertStatus>(dto.Status, true, out var newStatus))
            throw new InvalidOperationException($"Invalid SOS status '{dto.Status}'.");

        alert.Status = newStatus;

        if (!string.IsNullOrWhiteSpace(dto.AdminNotes))
        {
            alert.AdminNotes = string.IsNullOrWhiteSpace(alert.AdminNotes)
                ? dto.AdminNotes
                : $"{alert.AdminNotes}\n[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] {dto.AdminNotes}";
        }

        if (newStatus == SosAlertStatus.Resolved)
        {
            alert.ResolvedAt = DateTime.UtcNow;
            alert.ResolvedByAdminId = adminUserId;
        }

        await _db.SaveChangesAsync();

        return MapToDto(alert, alert.Booking);
    }

    public async Task<SosAlertDto> TerminateJobAsync(string adminUserId, int alertId, string? adminNotes)
    {
        var alert = await _db.SosAlerts
            .Include(a => a.Booking).ThenInclude(b => b.ServiceRequest).ThenInclude(sr => sr.Category)
            .Include(a => a.Customer).ThenInclude(c => c.User)
            .Include(a => a.Worker).ThenInclude(w => w.User)
            .Include(a => a.ResolvedByAdmin)
            .FirstOrDefaultAsync(a => a.Id == alertId);

        if (alert is null)
            throw new KeyNotFoundException($"SOS alert #{alertId} not found.");

        // 1. Cancel related booking
        if (alert.Booking != null)
        {
            alert.Booking.Status = "Cancelled";
        }

        // 2. Mark alert Resolved
        alert.Status = SosAlertStatus.Resolved;
        alert.ResolvedAt = DateTime.UtcNow;
        alert.ResolvedByAdminId = adminUserId;

        var notePrefix = "Job terminated by Administrator following emergency SOS safety alert.";
        var combinedNotes = string.IsNullOrWhiteSpace(adminNotes) ? notePrefix : $"{notePrefix} Details: {adminNotes}";
        alert.AdminNotes = string.IsNullOrWhiteSpace(alert.AdminNotes)
            ? combinedNotes
            : $"{alert.AdminNotes}\n[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] {combinedNotes}";

        await _db.SaveChangesAsync();

        // 3. Notify Customer & Worker of booking cancellation
        var customerUserId = alert.Customer?.UserId;
        if (!string.IsNullOrEmpty(customerUserId))
        {
            await _notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId = customerUserId,
                Type = "BookingCancelled",
                Message = $"Booking #{alert.BookingId} has been terminated and cancelled by Platform Administrators following your SOS report.",
                RelatedEntityId = alert.BookingId
            });
        }

        var workerUserId = alert.Worker?.UserId;
        if (!string.IsNullOrEmpty(workerUserId))
        {
            await _notificationService.CreateNotificationAsync(new CreateNotificationDto
            {
                UserId = workerUserId,
                Type = "BookingCancelled",
                Message = $"Booking #{alert.BookingId} has been terminated and cancelled by Platform Administrators for safety reasons.",
                RelatedEntityId = alert.BookingId
            });
        }

        // 4. Notify booking group via SignalR
        await _notifier.NotifyBookingGroupAsync(alert.BookingId, "BookingStatusChanged", new
        {
            BookingId = alert.BookingId,
            Status = "Cancelled",
            Reason = "Emergency safety termination by Administrator"
        });

        return MapToDto(alert, alert.Booking!);
    }

    private static SosAlertDto MapToDto(SosAlert alert, Booking booking)
    {
        var customerName = booking?.Customer?.FullName;
        if (string.IsNullOrWhiteSpace(customerName))
            customerName = alert.Customer?.FullName ?? "Customer";

        var workerName = booking?.Worker?.User?.Email?.Split('@')[0];
        if (string.IsNullOrWhiteSpace(workerName))
            workerName = alert.Worker?.User?.Email?.Split('@')[0] ?? $"Worker #{alert.WorkerId}";

        return new SosAlertDto
        {
            Id = alert.Id,
            BookingId = alert.BookingId,
            CustomerId = alert.CustomerId,
            CustomerName = customerName,
            CustomerPhone = booking?.Customer?.User?.PhoneNumber ?? alert.Customer?.User?.PhoneNumber,
            CustomerEmail = booking?.Customer?.User?.Email ?? alert.Customer?.User?.Email,
            WorkerId = alert.WorkerId,
            WorkerName = workerName,
            WorkerPhone = booking?.Worker?.User?.PhoneNumber ?? alert.Worker?.User?.PhoneNumber,
            WorkerEmail = booking?.Worker?.User?.Email ?? alert.Worker?.User?.Email,
            ServiceCategoryName = booking?.ServiceRequest?.Category?.Name ?? "Service",
            ServiceAddress = booking?.ServiceRequest?.Address ?? booking?.Customer?.Address ?? "Address not specified",
            AgreedPrice = booking?.AgreedPrice ?? 0m,
            ScheduledDate = booking?.ScheduledDate ?? alert.TriggeredAt,
            BookingStatus = booking?.Status ?? "Unknown",
            TriggeredAt = alert.TriggeredAt,
            Status = alert.Status.ToString(),
            AdminNotes = alert.AdminNotes,
            ResolvedAt = alert.ResolvedAt,
            ResolvedByAdminId = alert.ResolvedByAdminId,
            ResolvedByAdminEmail = alert.ResolvedByAdmin?.Email
        };
    }
}
