using System.Collections.Generic;
using System.Threading.Tasks;
using Karigor.Application.Location.DTOs;
using Karigor.Application.Worker.DTOs;

namespace Karigor.Application.Location;

public interface ILocationService
{
    /// <summary>
    /// Finds workers near a given location within specified radius or worker service radius.
    /// Supports category, keyword, and rating filters.
    /// </summary>
    Task<List<NearbyWorkerDto>> GetNearbyWorkersAsync(NearbyWorkerParamsDto query);

    /// <summary>
    /// Updates the authenticated worker's latitude, longitude, and optional service coverage radius.
    /// </summary>
    Task<WorkerProfileDto> UpdateWorkerLocationAsync(string workerUserId, UpdateWorkerLocationDto dto);

    /// <summary>
    /// Finds open service requests near the authenticated worker that match their skills and coverage radius.
    /// </summary>
    Task<List<NearbyRequestDto>> GetNearbyRequestsForWorkerAsync(string workerUserId, NearbyRequestParamsDto? query);
}
