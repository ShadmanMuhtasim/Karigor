using System.Collections.Generic;
using System.Threading.Tasks;
using Karigor.Application.Sos.DTOs;

namespace Karigor.Application.Sos;

public interface ISosService
{
    Task<SosAlertDto> TriggerSosAsync(string customerUserId, int bookingId);
    Task<List<SosAlertDto>> GetSosAlertsAsync(string? status = null);
    Task<SosAlertDto> UpdateSosStatusAsync(string adminUserId, int alertId, UpdateSosStatusDto dto);
    Task<SosAlertDto> TerminateJobAsync(string adminUserId, int alertId, string? adminNotes);
}
