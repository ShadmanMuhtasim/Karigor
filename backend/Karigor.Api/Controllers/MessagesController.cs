using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Karigor.Application.Messaging;
using Karigor.Application.Messaging.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karigor.Api.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly IMessagingService _messagingService;

    public MessagesController(IMessagingService messagingService)
    {
        _messagingService = messagingService;
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("Authenticated user has no sub claim.");

    // =========================================================================
    // 7.3 POST /api/messages — Send chat message
    // =========================================================================
    [HttpPost]
    [ProducesResponseType(typeof(MessageDto), 201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(401)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var message = await _messagingService.SendMessageAsync(GetUserId(), dto);
            return StatusCode(201, message);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    // =========================================================================
    // 7.4 GET /api/messages/booking/{bookingId} — Get chat history for booking
    // =========================================================================
    [HttpGet("booking/{bookingId:int}")]
    [ProducesResponseType(typeof(List<MessageDto>), 200)]
    [ProducesResponseType(403)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetBookingMessages(int bookingId)
    {
        try
        {
            var messages = await _messagingService.GetBookingMessagesAsync(GetUserId(), bookingId);
            return Ok(messages);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = ex.Message });
        }
    }

    // =========================================================================
    // 7.5 GET /api/messages/conversations — List active conversations
    // =========================================================================
    [HttpGet("conversations")]
    [ProducesResponseType(typeof(List<ConversationSummaryDto>), 200)]
    public async Task<IActionResult> GetConversations()
    {
        var conversations = await _messagingService.GetConversationsAsync(GetUserId());
        return Ok(conversations);
    }

    // =========================================================================
    // PUT /api/messages/booking/{bookingId}/read — Mark booking messages read
    // =========================================================================
    [HttpPut("booking/{bookingId:int}/read")]
    [ProducesResponseType(200)]
    public async Task<IActionResult> MarkMessagesRead(int bookingId)
    {
        await _messagingService.MarkMessagesAsReadAsync(GetUserId(), bookingId);
        return Ok(new { success = true });
    }
}
