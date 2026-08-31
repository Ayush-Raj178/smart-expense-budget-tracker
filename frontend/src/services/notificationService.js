import axiosInstance from '../utils/axios';

const API_BASE_URL = '/api';

export const notificationService = {
  async getNotifications(config = {}) {
    const response = await axiosInstance.get(`${API_BASE_URL}/notifications`, config);
    return response.data;
  },

  async markAsRead(id) {
    const response = await axiosInstance.put(`${API_BASE_URL}/notifications/${id}/read`, {});
    return response.data;
  },

  async deleteNotification(id) {
    const response = await axiosInstance.delete(`${API_BASE_URL}/notifications/${id}`);
    return response.data;
  },
};
