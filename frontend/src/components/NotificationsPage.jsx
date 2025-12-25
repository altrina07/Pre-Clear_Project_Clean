import { useState, useEffect } from 'react';
import { 
  Bell,
  Package, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  FileText, 
  Zap, 
  Loader,
  ArrowLeft,
  MessageCircle
} from 'lucide-react';
import { getNotifications, markAsRead, markAllAsRead } from '../api/notifications';
import { useNavigate } from 'react-router-dom';

export function NotificationsPage({ userRole, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 15 seconds
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      console.log('[NotificationsPage] Fetched notifications:', data);
      setNotifications(data || []);
    } catch (error) {
      console.error('[NotificationsPage] Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    console.log('[NotificationsPage] Clicked notification:', notification);
    
    // Mark as read
    try {
      if (!notification.isRead) {
        await markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    // Route based on notification type and role
    const shipmentId = notification.shipmentId || notification.ShipmentId;
    const role = userRole || localStorage.getItem('pc_role') || 'shipper';

    // Chat message notifications - open shipment with chat panel
    if (notification.type === 'chat_message' || notification.type === 'new_message') {
      if (role === 'shipper') {
        navigate(`/shipper/shipments/${shipmentId}?openChat=true`);
      } else if (role === 'broker') {
        navigate(`/broker/review/${shipmentId}?openChat=true`);
      }
      return;
    }

    // Document request notifications
    if (notification.type === 'document_request' || 
        notification.type === 'documents-requested') {
      navigate(`/shipper/shipments/${shipmentId}`);
      return;
    }

    // Broker-specific notifications
    if (notification.type === 'broker-approval-request' || 
        notification.type === 'ai-completed' ||
        notification.type === 'documents-uploaded' ||
        (role === 'broker' && shipmentId)) {
      navigate(`/broker/review/${shipmentId}`);
      return;
    }

    // Default routing by role
    if (shipmentId) {
      if (role === 'shipper') {
        navigate(`/shipper/shipments/${shipmentId}`);
      } else if (role === 'broker') {
        navigate(`/broker/review/${shipmentId}`);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleGoBack = () => {
    // Prefer parent navigation to update AppShell's currentPage state
    if (typeof onNavigate === 'function') {
      onNavigate('dashboard');
      return;
    }
    // Fallback: navigate to root
    navigate('/', { replace: true });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'broker-approval-request':
        return <Package className="w-6 h-6 text-blue-600" />;
      case 'shipment-created':
        return <Package className="w-6 h-6 text-blue-600" />;
      case 'broker-approved':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'broker-denied':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'token_generated':
      case 'token-generated':
        return <Zap className="w-6 h-6 text-yellow-600" />;
      case 'document_request':
      case 'documents-requested':
        return <FileText className="w-6 h-6 text-amber-600" />;
      case 'ai-completed':
        return <CheckCircle className="w-6 h-6 text-purple-600" />;
      case 'chat_message':
      case 'new_message':
        return <MessageCircle className="w-6 h-6 text-indigo-600" />;
      default:
        return <Bell className="w-6 h-6 text-slate-600" />;
    }
  };

  const getNotificationColors = (type) => {
    switch (type) {
      case 'broker-approval-request':
      case 'shipment-created':
        return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' };
      case 'broker-approved':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900' };
      case 'broker-denied':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900' };
      case 'token_generated':
      case 'token-generated':
        return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900' };
      case 'document_request':
      case 'documents-requested':
        return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' };
      case 'ai-completed':
        return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900' };
      case 'chat_message':
      case 'new_message':
        return { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900' };
      default:
        return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900' };
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
              <p className="text-slate-600 mt-1">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            </div>
            
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
          <div className="flex gap-1 p-1">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                filter === 'unread'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                filter === 'read'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Read ({notifications.length - unreadCount})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
            </h3>
            <p className="text-slate-600">
              {filter === 'all' 
                ? "You'll see updates about your shipments here"
                : `You don't have any ${filter} notifications`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const colors = getNotificationColors(notification.type);
              
              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-5 rounded-xl border-2 ${colors.bg} ${colors.border} hover:shadow-lg transition-all text-left`}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className={`font-semibold text-base ${colors.text}`}>
                          {notification.title}
                        </h3>
                        {!notification.isRead && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-600 text-white flex-shrink-0">
                            New
                          </span>
                        )}
                      </div>
                      
                      <p className={`text-sm ${colors.text} opacity-80 mb-3`}>
                        {notification.message}
                      </p>
                      
                      <p className="text-xs text-slate-500">
                        {new Date(notification.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Auto-refresh indicator */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            🔄 Auto-refreshing every 15 seconds
          </p>
        </div>
      </div>
    </div>
  );
}
