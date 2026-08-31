import api from '@/utils/axios';

const API_BASE_URL = '/api';

export const authService = {
  async signup(name, email, password) {
    const response = await api.post(`${API_BASE_URL}/auth/signup`, {
      name,
      email,
      password,
    });
    return response.data;
  },

  async verifySignupOtp(email, otp) {
    const response = await api.post(`${API_BASE_URL}/auth/signup/verify`, { email, otp });
    return response.data;
  },

  async resendSignupOtp(email) {
    const response = await api.post(`${API_BASE_URL}/auth/signup/resend`, { email });
    return response.data;
  },

  async forgotPassword(email) {
    const response = await api.post(`${API_BASE_URL}/auth/forgot-password`, { email });
    return response.data;
  },

  async verifyPasswordResetOtp(email, otp) {
    const response = await api.post(`${API_BASE_URL}/auth/forgot-password/verify`, {
      email,
      otp,
    });
    return response.data;
  },

  async resetPassword(email, otp, newPassword) {
    const response = await api.post(`${API_BASE_URL}/auth/reset-password`, {
      email,
      otp,
      newPassword,
    });
    return response.data;
  },

  async login(email, password) {
    const response = await api.post(`${API_BASE_URL}/auth/login`, {
      email,
      password,
    });
    return response.data;
  },

  async getCurrentUser(token) {
    const response = await api.get(`${API_BASE_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  async updateProfile({ name, phoneNumber }) {
    const response = await api.put(`${API_BASE_URL}/users/me`, { name, phoneNumber });
    return response.data;
  },

  async requestEmailChange(newEmail) {
    const response = await api.post(`${API_BASE_URL}/users/me/email/request`, { newEmail });
    return response.data;
  },

  async verifyEmailChange(newEmail, otp) {
    const response = await api.post(`${API_BASE_URL}/users/me/email/verify`, { newEmail, otp });
    return response.data;
  },
};
