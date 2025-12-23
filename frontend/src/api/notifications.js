import http from './http';

// Normalize notification fields from backend (PascalCase to camelCase)
function normalizeNotification(notif) {
  return {
    id: notif.id || notif.Id,
    type: notif.type || notif.Type,
    title: notif.title || notif.Title,
    message: notif.message || notif.Message,
    shipmentId: notif.shipmentId || notif.ShipmentId,
    isRead: notif.isRead ?? notif.IsRead ?? false,
    createdAt: notif.createdAt || notif.CreatedAt,
    userId: notif.userId || notif.UserId,
  };
}

// Get all notifications for the current user
export async function getNotifications(isRead = null) {
  const params = isRead !== null ? { isRead } : {};
  const resp = await http.get('/notifications', { params });
  const notifications = Array.isArray(resp.data) ? resp.data : [];
  return notifications.map(normalizeNotification);
}

// Get unread notification count
export async function getUnreadCount() {
  const resp = await http.get('/notifications/unread-count');
  return resp.data;
}

// Mark a notification as read
export async function markAsRead(notificationId) {
  const resp = await http.put(`/notifications/${notificationId}/read`);
  return resp.data;
}

// Mark all notifications as read
export async function markAllAsRead() {
  const resp = await http.put('/notifications/mark-all-read');
  return resp.data;
}
