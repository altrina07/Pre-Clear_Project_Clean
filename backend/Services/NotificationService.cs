using Microsoft.EntityFrameworkCore;
using PreClear.Api.Data;
using PreClear.Api.Interfaces;
using PreClear.Api.Models;

namespace PreClear.Api.Services
{
    public class NotificationService : INotificationService
    {
        private readonly PreclearDbContext _context;
        private readonly IEmailService _emailService;
        private readonly ILogger<NotificationService> _logger;

        public NotificationService(PreclearDbContext context, IEmailService emailService, ILogger<NotificationService> logger)
        {
            _context = context;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task<Notification> CreateNotificationAsync(long userId, string type, string title, string message, long? shipmentId = null)
        {
            var redirectUrl = BuildRedirectUrl(type, shipmentId);

            var notification = new Notification
            {
                UserId = userId,
                Type = type,
                Title = title,
                Message = message,
                ShipmentId = shipmentId,
                RedirectUrl = redirectUrl,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            // Best-effort email alert so shipper/broker also receive inbox notifications
            await SendEmailIfPossible(userId, title, message);

            return notification;
        }

        private string? BuildRedirectUrl(string type, long? shipmentId)
        {
            if (!shipmentId.HasValue)
                return null;

            return type switch
            {
                "chat_message" or "new_message" => $"/shipments/{shipmentId}/chat",
                "document_request" or "documents-requested" => $"/shipments/{shipmentId}/documents",
                "broker-approval-request" or "shipment-created" or "ai-completed" => $"/shipments/{shipmentId}",
                "broker-approved" or "broker-denied" => $"/shipments/{shipmentId}",
                "token_generated" or "token-generated" => $"/shipments/{shipmentId}",
                "documents-uploaded" or "document_request_fulfilled" => $"/shipments/{shipmentId}",
                _ => $"/shipments/{shipmentId}"
            };
        }

        public async Task<List<Notification>> GetUserNotificationsAsync(long userId, bool? isRead = null)
        {
            var query = _context.Notifications.Where(n => n.UserId == userId);
            
            if (isRead.HasValue)
            {
                query = query.Where(n => n.IsRead == isRead.Value);
            }

            return await query
                .OrderByDescending(n => n.CreatedAt)
                .ToListAsync();
        }

        public async Task<int> GetUnreadCountAsync(long userId)
        {
            return await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .CountAsync();
        }

        public async Task MarkAsReadAsync(long notificationId)
        {
            var notification = await _context.Notifications.FindAsync(notificationId);
            if (notification != null)
            {
                notification.IsRead = true;
                await _context.SaveChangesAsync();
            }
        }

        public async Task MarkAllAsReadAsync(long userId)
        {
            var notifications = await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync();

            foreach (var notification in notifications)
            {
                notification.IsRead = true;
            }

            await _context.SaveChangesAsync();
        }

        private async Task SendEmailIfPossible(long userId, string subject, string body)
        {
            try
            {
                var userEmail = await _context.Users
                    .Where(u => u.Id == userId)
                    .Select(u => u.Email)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrWhiteSpace(userEmail))
                {
                    _logger.LogDebug("No email on file for user {UserId}; skipping email notification", userId);
                    return;
                }

                await _emailService.SendEmailAsync(userEmail, subject, body);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send email notification to user {UserId}", userId);
            }
        }
    }
}
