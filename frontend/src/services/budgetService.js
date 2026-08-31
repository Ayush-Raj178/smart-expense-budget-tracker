import axiosInstance from '../utils/axios';
import { BUDGET_API_BASE_URL } from '@/config/api';

export const budgetService = {
  async getBudgets(filters = {}) {
    const response = await axiosInstance.get(`${BUDGET_API_BASE_URL}/budgets`, {
      params: filters,
    });
    return response.data;
  },

  async getBudget(id) {
    const response = await axiosInstance.get(`${BUDGET_API_BASE_URL}/budgets/${id}`);
    return response.data;
  },

  async createBudget(budgetData) {
    const response = await axiosInstance.post(`${BUDGET_API_BASE_URL}/budgets`, budgetData);
    return response.data;
  },

  async updateBudget(id, budgetData) {
    const response = await axiosInstance.put(`${BUDGET_API_BASE_URL}/budgets/${id}`, budgetData);
    return response.data;
  },

  async deleteBudget(id) {
    const response = await axiosInstance.delete(`${BUDGET_API_BASE_URL}/budgets/${id}`);
    return response.data;
  },
};
