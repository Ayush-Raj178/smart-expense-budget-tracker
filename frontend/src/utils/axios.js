import axios from 'axios';

const axiosInstance = axios.create();

const isPublicAuthRequest = (url = '') => url.includes('/api/auth/');

// Request interceptor to add JWT token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token && !isPublicAuthRequest(config.url)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (isPublicAuthRequest(config.url)) {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isPublicAuthRequest(error.config?.url)) {
      localStorage.removeItem('jwt_token');
      // Use window.location for 401 to ensure auth state is cleared
      // This is safer than trying to use React Router in an interceptor
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
