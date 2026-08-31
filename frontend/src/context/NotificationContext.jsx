import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/context/AuthContext';

const NotificationContext = createContext(null);
const MAX_RETRIES = 3;
const POLLING_INTERVAL_MS = 30_000;

export const NotificationProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isFetchingRef = useRef(false);
  const requestControllerRef = useRef(null);
  const retryCountRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const fetchNotifications = useCallback(async (forceRetry = false, { silent = false } = {}) => {
    if (!user?.token) {
      setNotifications([]);
      setError(null);
      setLoading(false);
      retryCountRef.current = 0;
      hasLoadedRef.current = false;
      return;
    }

    // Prevent duplicate simultaneous requests
    if (isFetchingRef.current && !forceRetry) {
      console.log('Fetch already in progress, skipping duplicate request');
      return;
    }

    // Check retry limit for consecutive failures
    if (retryCountRef.current >= MAX_RETRIES && !forceRetry) {
      console.log('Max retries reached, waiting for manual retry');
      return;
    }

    if (forceRetry) requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      isFetchingRef.current = true;
      if (!silent) setLoading(true);
      const data = await notificationService.getNotifications({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setNotifications(data || []);
      setError(null);
      hasLoadedRef.current = true;
      retryCountRef.current = 0; // Reset retry count on success
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || controller.signal.aborted) return;
      retryCountRef.current++;
      if (!silent || !hasLoadedRef.current) setError('Failed to load notifications');
      console.error('Failed to fetch notifications:', err);

      // Don't auto-retry on consecutive failures - let user manually retry
      if (retryCountRef.current >= MAX_RETRIES) {
        console.log('Max retries reached, stopping auto-retry');
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        if (!silent) setLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, [user?.token]);

  const markAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === id ? { ...notif, read: true } : notif
        )
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await Promise.all(
        notifications.filter(n => !n.read).map(n => notificationService.markAsRead(n.id))
      );
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user?.token) {
      setNotifications([]);
      setError(null);
      setLoading(false);
      retryCountRef.current = 0;
      hasLoadedRef.current = false;
      return;
    }
    fetchNotifications(true);

    const refreshSilently = () => fetchNotifications(false, { silent: true });
    const pollingId = window.setInterval(refreshSilently, POLLING_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshSilently();
    };

    window.addEventListener('focus', refreshSilently);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(pollingId);
      window.removeEventListener('focus', refreshSilently);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      isFetchingRef.current = false;
    };
  }, [authLoading, fetchNotifications, user?.token]);

  const value = {
    notifications,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    unreadCount: notifications.filter(n => !n.read).length
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
