using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PreClear.Api.Interfaces;

namespace PreClear.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationService _notificationService;

        public NotificationsController(INotificationService notificationService)
        {
            _notificationService = notificationService;
        }

        private long? GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(userIdClaim, out var userId) ? userId : null;
        }

        // GET: api/notifications
        [HttpGet]
        public async Task<IActionResult> GetNotifications([FromQuery] bool? isRead = null)
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { error = "not_authenticated" });
            }

            var notifications = await _notificationService.GetUserNotificationsAsync(userId.Value, isRead);
            return Ok(notifications);
        }

        // GET: api/notifications/unread-count
        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { error = "not_authenticated" });
            }

            var count = await _notificationService.GetUnreadCountAsync(userId.Value);
            return Ok(new { count });
        }

        // PUT: api/notifications/{id}/read
        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkAsRead(long id)
        {
            await _notificationService.MarkAsReadAsync(id);
            return Ok(new { message = "Notification marked as read" });
        }

        // PUT: api/notifications/mark-all-read
        [HttpPut("mark-all-read")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { error = "not_authenticated" });
            }

            await _notificationService.MarkAllAsReadAsync(userId.Value);
            return Ok(new { message = "All notifications marked as read" });
        }
    }
}
