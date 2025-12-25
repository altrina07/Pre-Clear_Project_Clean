import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { getUnreadCount } from '../api/notifications';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  // Fetch unread count on mount and every 15 seconds for real-time updates
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const data = await getUnreadCount();
      console.log('[NotificationBell] Unread count:', data);
      setUnreadCount(data.count || 0);
    } catch (error) {
      console.error('[NotificationBell] Failed to fetch unread count:', error);
    }
  };

  const handleClick = () => {
    // Navigate to notifications page
    const userRole = localStorage.getItem('pc_role') || 'shipper';
    if (userRole === 'broker') {
      navigate('/broker/notifications');
    } else {
      navigate('/shipper/notifications');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="relative p-2 text-slate-600 hover:text-slate-900 transition-colors"
      title="View notifications"
    >{unreadCount > 0 && (
<span className="absolute -top-1 -right-1 inline-flex items-center justify-center 
w-4 h-4 
text-[5px] font-xs text-white 
bg-red-600 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      <Bell className="w-7 h-7 "/>
      
    </button>
  );
}