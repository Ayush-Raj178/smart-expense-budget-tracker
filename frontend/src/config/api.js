const withoutTrailingSlash = (value = '') => value.trim().replace(/\/+$/, '');

const apiBaseUrl = (serviceUrl) => `${withoutTrailingSlash(serviceUrl)}/api`;

export const USER_API_BASE_URL = apiBaseUrl(import.meta.env.VITE_USER_SERVICE_URL);
export const EXPENSE_API_BASE_URL = apiBaseUrl(import.meta.env.VITE_EXPENSE_SERVICE_URL);
export const BUDGET_API_BASE_URL = apiBaseUrl(import.meta.env.VITE_BUDGET_SERVICE_URL);
export const NOTIFICATION_API_BASE_URL = apiBaseUrl(
  import.meta.env.VITE_NOTIFICATION_SERVICE_URL,
);
