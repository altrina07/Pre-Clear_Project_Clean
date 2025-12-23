import { useState, useEffect } from 'react';
import { 
  FileText, 
  Package, 
  CheckCircle, 
  Zap, 
  X, 
  Loader,
  AlertCircle,
  MessageCircle
} from 'lucide-react';
import { getNotifications, markAsRead, markAllAsRead } from '../../api/notifications';
import { shipmentsStore } from '../../store/shipmentsStore';

export function ShipperNotifications({ onNavigate, currentUserId }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewedNotifications, setViewedNotifications] = useState(new Set());

  // Fetch notifications from backend API on mount and every 15 seconds
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const data = await getNotifications();
        console.log('[ShipperNotifications] Fetched notifications:', data);
        
        if (Array.isArray(data)) {
          setNotifications(data);
          setError(null);
        }
      } catch (err) {
        console.error('[ShipperNotifications] Failed to fetch notifications:', err);
        setError('Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications(); // Initial fetch
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15s

    return () => clearInterval(interval);
  }, []);

  // Get unread notifications
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const unreadCount = unreadNotifications.length;

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    console.log('[ShipperNotifications] Clicked notification:', notification);
    
    // Mark as read
    try {
      if (!notification.isRead) {
        await markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    // Route based on notification type
    const shipment = notification.shipmentId 
      ? shipmentsStore.getShipmentById(notification.shipmentId)
      : null;

    // Chat message - navigate to shipment with chat open
    if (notification.type === 'chat_message' || notification.type === 'new_message') {
      console.log('[ShipperNotifications] Routing to shipment with chat panel open');
      onNavigate('shipment-details', { ...shipment, openChat: true });
      return;
    }

    switch (notification.type) {
      case 'shipment-created':
        console.log('[ShipperNotifications] Routing to shipment details for newly created shipment');
        onNavigate('shipment-details', shipment);
        break;

      case 'broker-approved':
        console.log('[ShipperNotifications] Routing to shipment details - broker approved');
        onNavigate('shipment-details', shipment);
        break;

      case 'token_generated':
      case 'token-generated':
        console.log('[ShipperNotifications] Routing to token view');
        onNavigate('shipment-details', shipment);
        break;

      case 'document_request':
      case 'documents-requested':
        console.log('[ShipperNotifications] Routing to shipment details - documents requested');
        onNavigate('shipment-details', shipment);
        break;

      case 'broker-denied':
        console.log('[ShipperNotifications] Routing to shipment details - broker denied');
        onNavigate('shipment-details', shipment);
        break;

      default:
        if (shipment) {
          console.log('[ShipperNotifications] Routing to shipment details for unknown type');
          onNavigate('shipment-details', shipment);
        }
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Get icon for notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'shipment-created':
        return <Package className="w-6 h-6 text-blue-600" />;
      case 'broker-approved':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'broker-denied':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      case 'token_generated':
      case 'token-generated':
        return <Zap className="w-6 h-6 text-yellow-600" />;
      case 'document_request':
      case 'documents-requested':
        return <FileText className="w-6 h-6 text-amber-600" />;
      case 'chat_message':
      case 'new_message':
        return <MessageCircle className="w-6 h-6 text-indigo-600" />;
      default:
        return <Package className="w-6 h-6 text-slate-600" />;
    }
  };

  // Get display title based on type
  const getNotificationTitle = (notification) => {
    switch (notification.type) {
      case 'shipment-created':
        return 'Shipment Created';
      case 'broker-approved':
        return 'Shipment Approved by Broker';
      case 'broker-denied':
        return 'Shipment Rejected by Broker';
      case 'token_generated':
      case 'token-generated':
        return 'Preclear Token Generated';
      case 'document_request':
      case 'documents-requested':
        return 'Additional Documents Requested';
      case 'chat_message':
      case 'new_message':
        return 'New Message';
      default:
        return notification.title || 'Notification';
    }
  };

  // Get color scheme based on type
  const getNotificationColors = (type) => {
    switch (type) {
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
      case 'chat_message':
      case 'new_message':
        return { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900' };
      default:
        return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900' };
    }
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-5 h-5 text-blue-600 animate-spin" />
          <span className="ml-2 text-slate-600">Loading notifications...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 bg-red-50">
        <p className="text-red-900">Error: {error}</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col items-center justify-center py-8">
          <Package className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-600 text-center">No notifications yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-slate-900 font-semibold text-lg">Notifications</h2>
          <p className="text-slate-600 text-sm mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {notifications.map((notification) => {
          const colors = getNotificationColors(notification.type);
          const displayTitle = getNotificationTitle(notification);
          
          return (
            <button
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`w-full p-4 rounded-lg border-2 ${colors.bg} ${colors.border} hover:shadow-md transition-all text-left`}
            >
              <div className="flex gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className={`font-semibold text-sm ${colors.text}`}>
                      {displayTitle}
                    </h3>
                    {!notification.isRead && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white flex-shrink-0">
                        New
                      </span>
                    )}
                  </div>
                  
                  <p className={`text-sm ${colors.text} opacity-80 mb-2`}>
                    {notification.message}
                  </p>
                  
                  <p className="text-xs text-slate-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewedNotifications(prev => new Set([...prev, notification.id]));
                  }}
                  className="flex-shrink-0 text-slate-400 hover:text-slate-600 mt-0.5"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          💡 Notifications update automatically. Click any notification to view details and take action.
        </p>
      </div>
    </div>
  );
}
