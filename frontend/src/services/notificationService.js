import axiosInstance from '../utils/axios';
import { NOTIFICATION_API_BASE_URL } from '@/config/api';

export const notificationService = {
  async getNotifications(config = {}) {
    const response = await axiosInstance.get(`${NOTIFICATION_API_BASE_URL}/notifications`, config);
    return response.data;
  },

  async markAsRead(id) {
    const response = await axiosInstance.put(`${NOTIFICATION_API_BASE_URL}/notifications/${id}/read`, {});
    return response.data;
  },

  async deleteNotification(id) {
    const response = await axiosInstance.delete(`${NOTIFICATION_API_BASE_URL}/notifications/${id}`);
    return response.data;
  },
};
