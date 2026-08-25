import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi, type NotificationDto } from '../../api/notificationApi';
import { signalRService } from '../../services/signalrService';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    fetchNotifications();

    // Listen for live notifications via SignalR
    const unsubscribe = signalRService.onNotification((newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);

      // Show floating toast in the middle top of screen
      setToastMessage(newNotif.message);
      setTimeout(() => setToastMessage(null), 6000);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const data = await notificationApi.getNotifications();
      setNotifications(data);
    } catch {
      // Ignored if not logged in
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: number) {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {}
  }

  async function handleMarkAllRead() {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
    } catch {}
  }

  function handleNotificationClick(n: NotificationDto) {
    if (!n.isRead) {
      handleMarkRead(n.id);
    }
    setIsOpen(false);

    if (n.type === 'NewMessage' || n.type === 'BookingCreated' || n.type === 'BookingStatusChanged') {
      if (n.relatedEntityId) {
        navigate(`/bookings/${n.relatedEntityId}`);
      } else {
        navigate(`/dashboard`);
      }
    } else if (n.type === 'NewQuotation' || n.type === 'QuotationCountered') {
      if (n.relatedEntityId) {
        navigate(`/requests/${n.relatedEntityId}`);
      } else {
        navigate(`/dashboard`);
      }
    }
  }

  function formatTimeAgo(dateStr: string) {
    try {
      const d = new Date(dateStr);
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return '';
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'NewMessage':
        return '💬';
      case 'NewQuotation':
        return '👷';
      case 'BookingCreated':
        return '🎉';
      case 'BookingStatusChanged':
        return '🔧';
      case 'QuotationCountered':
        return '⚖️';
      default:
        return '🔔';
    }
  }

  return (
    <>
      {/* Centered Top Notification Popup (Easily visible, no bounce, perfectly matching UI) */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-4 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex items-start gap-3.5 transition-all animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xl shrink-0 border border-sky-200 dark:border-sky-800/60 shadow-sm">
            🔔
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                New Notification
              </span>
              <span className="text-[10px] text-gray-400 font-medium">Just now</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
              {toastMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bell Button & Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          id="notification-bell-btn"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition focus:outline-none cursor-pointer"
          aria-label="Notifications"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>

          {unreadCount > 0 && (
            <span
              id="notification-unread-badge"
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center shadow-sm"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            id="notification-dropdown"
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden z-50 animate-in fade-in duration-150"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-850/50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-gray-900 dark:text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
              {loading ? (
                <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                  Loading notifications…
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                  <span className="text-2xl block mb-1">📭</span>
                  <p className="text-xs font-medium">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition cursor-pointer flex items-start gap-3 ${
                      !n.isRead ? 'bg-sky-50/40 dark:bg-sky-950/20' : ''
                    }`}
                  >
                    <div className="text-lg shrink-0 mt-0.5">{getNotificationIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${!n.isRead ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {n.message}
                      </p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
