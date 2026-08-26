using System;
using System.Collections.Generic;

namespace Karigor.Application.Admin.DTOs;

public class AdminStatsDto
{
    public int TotalUsers { get; set; }
    public int TotalCustomers { get; set; }
    public int TotalWorkers { get; set; }
    public int VerifiedWorkers { get; set; }
    public int PendingVerifications { get; set; }
    public int TotalServiceRequests { get; set; }
    public int OpenServiceRequests { get; set; }
    public int TotalBookings { get; set; }
    public int CompletedBookings { get; set; }
    public int InProgressBookings { get; set; }
    public int CancelledBookings { get; set; }
    public decimal TotalPlatformVolume { get; set; }
    public double AveragePlatformRating { get; set; }
    public int TotalReviews { get; set; }
    public int TotalCategories { get; set; }
}

public class PendingWorkerDto
{
    public int WorkerId { get; set; }
    public string UserId { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string? FullName { get; set; }
    public string? Bio { get; set; }
    public decimal HourlyRate { get; set; }
    public string VerificationStatus { get; set; } = null!;
    public double AverageRating { get; set; }
    public double ServiceRadiusKm { get; set; }
    public List<string> Skills { get; set; } = new();
    public List<WorkerVerificationDocumentDto> Documents { get; set; } = new();
}

public class WorkerVerificationDocumentDto
{
    public int Id { get; set; }
    public string DocumentType { get; set; } = null!;
    public string FileUrl { get; set; } = null!;
    public string Status { get; set; } = null!;
}

public class VerifyWorkerDto
{
    public string Status { get; set; } = "Verified"; // "Verified" or "Rejected"
    public string? Note { get; set; }
}

public class AdminUserDto
{
    public string Id { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string Role { get; set; } = null!;
    public string? FullName { get; set; }
    public bool IsSuspended { get; set; }
    public DateTimeOffset? LockoutEnd { get; set; }
    public int? WorkerProfileId { get; set; }
    public int? CustomerProfileId { get; set; }
}

public class UserSuspensionDto
{
    public bool Suspend { get; set; }
    public string? Reason { get; set; }
}

public class AdminBookingDto
{
    public int Id { get; set; }
    public int ServiceRequestId { get; set; }
    public string CategoryName { get; set; } = null!;
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = null!;
    public string CustomerEmail { get; set; } = null!;
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = null!;
    public string WorkerEmail { get; set; } = null!;
    public decimal AgreedPrice { get; set; }
    public DateTime ScheduledDate { get; set; }
    public string Status { get; set; } = null!;
    public string? Address { get; set; }
    public bool HasReview { get; set; }
    public int? ReviewRating { get; set; }
}

public class AdminReviewDto
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public string CategoryName { get; set; } = null!;
    public int WorkerId { get; set; }
    public string WorkerName { get; set; } = null!;
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = null!;
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public string? WorkerResponse { get; set; }
    public DateTime BookingDate { get; set; }
}

public class ModerateReviewDto
{
    public string? Comment { get; set; }
    public string? WorkerResponse { get; set; }
}

public class AdminCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string? IconUrl { get; set; }
    public int WorkerCount { get; set; }
    public int RequestCount { get; set; }
}

public class CreateCategoryDto
{
    public string Name { get; set; } = null!;
    public string? IconUrl { get; set; }
}

public class UpdateCategoryDto
{
    public string Name { get; set; } = null!;
    public string? IconUrl { get; set; }
}
