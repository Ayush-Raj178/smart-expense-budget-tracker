import axiosInstance from '../utils/axios';

const API_BASE_URL = '/api';

export const expenseService = {
  async getExpenses(filters = {}) {
    const response = await axiosInstance.get(`${API_BASE_URL}/expenses`, {
      params: filters,
    });
    return response.data;
  },

  async getExpense(id) {
    const response = await axiosInstance.get(`${API_BASE_URL}/expenses/${id}`);
    return response.data;
  },

  async createExpense(expenseData) {
    const response = await axiosInstance.post(`${API_BASE_URL}/expenses`, expenseData);
    return response.data;
  },

  async updateExpense(id, expenseData) {
    const response = await axiosInstance.put(`${API_BASE_URL}/expenses/${id}`, expenseData);
    return response.data;
  },

  async deleteExpense(id) {
    const response = await axiosInstance.delete(`${API_BASE_URL}/expenses/${id}`);
    return response.data;
  },
};
