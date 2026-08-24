using System.Collections.Generic;
using System.Threading.Tasks;
using Karigor.Application.Customer.DTOs;

namespace Karigor.Application.Customer;

/// <summary>
/// All Customer module operations.
/// Customer operations resolve CustomerProfile internally via ApplicationUser.Id (JWT sub) —
/// no client-supplied CustomerProfile ID is trusted.
/// </summary>
public interface ICustomerService
{
    // ── Profile ──────────────────────────────────────────────────────────────
    Task<CustomerProfileDto> GetProfileAsync(string userId);
    Task<CustomerProfileDto> UpdateProfileAsync(string userId, UpdateCustomerProfileDto dto);

    // ── Service Requests ─────────────────────────────────────────────────────
    Task<ServiceRequestDto> CreateServiceRequestAsync(string userId, CreateServiceRequestDto dto);
    Task<List<ServiceRequestDto>> GetServiceRequestsAsync(string userId, string? status = null);
    Task<ServiceRequestDto> GetServiceRequestByIdAsync(string userId, int requestId);

    // ── Worker Discovery ─────────────────────────────────────────────────────
    Task<List<WorkerSearchResultDto>> SearchWorkersAsync(WorkerSearchParamsDto query);
    Task<WorkerPublicDetailDto> GetWorkerPublicProfileAsync(int workerId);

    // ── Dashboard ────────────────────────────────────────────────────────────
    Task<CustomerDashboardStatsDto> GetDashboardStatsAsync(string userId);
}

