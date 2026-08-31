import { motion } from 'framer-motion';

const NotificationItem = ({ notification }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`notification-item ${notification.isRead ? 'read' : 'unread'}`}
    >
      <p>{notification.message}</p>
      <span className="notification-date">
        {new Date(notification.createdAt).toLocaleDateString()}
      </span>
    </motion.div>
  );
};

export default NotificationItem;
