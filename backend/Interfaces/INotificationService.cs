using PreClear.Api.Models;

namespace PreClear.Api.Interfaces
{
    public interface INotificationService
    {
        Task<Notification> CreateNotificationAsync(long userId, string type, string title, string message, long? shipmentId = null);
        Task<List<Notification>> GetUserNotificationsAsync(long userId, bool? isRead = null);
        Task<int> GetUnreadCountAsync(long userId);
        Task MarkAsReadAsync(long notificationId);
        Task MarkAllAsReadAsync(long userId);
    }
}
