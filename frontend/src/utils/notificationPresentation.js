import { getCategoryIcon } from '@/utils/categoryIcons';

const BUDGET_USAGE_PATTERN = /₹\s*([\d,.]+)\s*\/\s*₹\s*([\d,.]+)/i;

const parseAmount = (value) => Number(value.replace(/,/g, ''));

const formatMonth = (month) => {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return month || 'Monthly plan';
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

export const getNotificationPresentation = (notification) => {
  const category = notification.category?.trim() || 'Other';
  const Icon = getCategoryIcon(category);
  const usageMatch = notification.message?.match(BUDGET_USAGE_PATTERN);
  const spent = usageMatch ? parseAmount(usageMatch[1]) : null;
  const limit = usageMatch ? parseAmount(usageMatch[2]) : null;
  const usagePercentage = spent !== null && limit > 0
    ? Math.round((spent / limit) * 100)
    : null;
  const isOverLimit = usagePercentage !== null && usagePercentage >= 100;

  return {
    Icon,
    category,
    monthLabel: formatMonth(notification.month),
    severity: isOverLimit ? 'alert' : 'warning',
    title: isOverLimit ? 'Monthly limit exceeded' : 'Budget approaching its limit',
    detail: usagePercentage !== null
      ? `₹${spent.toLocaleString('en-IN')} of ₹${limit.toLocaleString('en-IN')} spent`
      : notification.message,
    usageLabel: usagePercentage !== null ? `${usagePercentage}% used` : 'Budget alert',
  };
};
