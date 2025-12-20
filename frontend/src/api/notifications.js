import http from './http';

// Get all notifications for the current user
export async function getNotifications(isRead = null) {
  const params = isRead !== null ? { isRead } : {};
  const resp = await http.get('/notifications', { params });
  return resp.data;
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
