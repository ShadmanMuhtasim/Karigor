using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Karigor.Application.Notifications;
using Karigor.Application.Notifications.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karigor.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("Authenticated user has no sub claim.");

    // =========================================================================
    // 7.7 GET /api/notifications — List user notifications
    // =========================================================================
    [HttpGet]
    [ProducesResponseType(typeof(List<NotificationDto>), 200)]
    public async Task<IActionResult> GetNotifications()
    {
        var notifications = await _notificationService.GetUserNotificationsAsync(GetUserId());
        return Ok(notifications);
    }

    // =========================================================================
    // 7.8 PUT /api/notifications/{id}/read — Mark single notification read
    // =========================================================================
    [HttpPut("{id:int}/read")]
    [ProducesResponseType(typeof(NotificationDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> MarkRead(int id)
    {
        try
        {
            var notification = await _notificationService.MarkAsReadAsync(GetUserId(), id);
            return Ok(notification);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    // =========================================================================
    // PUT /api/notifications/read-all — Mark all notifications read
    // =========================================================================
    [HttpPut("read-all")]
    [ProducesResponseType(200)]
    public async Task<IActionResult> MarkAllRead()
    {
        await _notificationService.MarkAllAsReadAsync(GetUserId());
        return Ok(new { success = true });
    }
}
