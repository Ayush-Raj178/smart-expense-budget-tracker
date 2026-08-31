export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const formatMonth = (monthString) => {
  const date = new Date(monthString + '-01');
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'long',
  }).format(date);
};

export const formatPercentage = (value) => {
  return `${Math.round(value)}%`;
};

export const formatYearMonth = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getPreviousMonthDate = (date) => {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
};

export const calculateMonthOverMonthChange = (current, previous) => {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;

  if (previousValue === 0) {
    if (currentValue === 0) {
      return { type: 'neutral', label: '—' };
    }
    return { type: 'new', label: 'New' };
  }

  const change = ((currentValue - previousValue) / previousValue) * 100;
  const rounded = Math.round(Math.abs(change) * 10) / 10;

  if (change === 0) {
    return { type: 'neutral', label: '0%' };
  }

  if (change > 0) {
    return { type: 'up', label: `${rounded}%` };
  }

  return { type: 'down', label: `${rounded}%` };
};

export const sumExpensesForMonth = (expenses, year, month) => {
  return expenses
    .filter((expense) => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getFullYear() === year && expenseDate.getMonth() === month;
    })
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
};

const escapeCsvValue = (value) => {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const exportExpensesToCsv = (expenses, filename) => {
  const headers = ['Description', 'Category', 'Amount', 'Date'];
  const rows = expenses.map((expense) => [
    expense.description || '',
    expense.category || '',
    expense.amount ?? 0,
    expense.date || '',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const getExpenseExportFilename = (date = new Date()) => {
  const monthName = date.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
  return `expenses-${monthName}-${date.getFullYear()}.csv`;
};
