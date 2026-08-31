import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, HandCoins, Landmark, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TiltCard from '@/components/TiltCard';
import { expenseService } from '@/services/expenseService';
import { budgetService } from '@/services/budgetService';
import { notificationService } from '@/services/notificationService';
import { formatCurrency, formatYearMonth, getPreviousMonthDate, calculateMonthOverMonthChange, sumExpensesForMonth, exportExpensesToCsv, getExpenseExportFilename } from '@/utils/formatters';
import { getCategoryIcon } from '@/utils/categoryIcons';

const COLORS = [
  'var(--chart-entertainment)',
  'var(--chart-transport)',
  'var(--chart-food)',
  'var(--chart-shopping)',
  'var(--chart-bills)',
  'var(--chart-other)',
];

const CATEGORY_COLORS = {
  Entertainment: 'var(--chart-entertainment)',
  Transport: 'var(--chart-transport)',
  Food: 'var(--chart-food)',
  Shopping: 'var(--chart-shopping)',
  Bills: 'var(--chart-bills)',
  Other: 'var(--chart-other)',
};

const chartColor = (category, index = 0) => CATEGORY_COLORS[category] || COLORS[index % COLORS.length];

/* ── Presentation-only helpers ──────────────────────────────────────────── */

/* Card chrome shared by every panel: crisp surface on the cool canvas in
   light mode, layered midnight surface with a hairline sheen in dark. */
const PANEL = 'relative overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-md transition-[border-color,box-shadow] duration-base ease-standard hover:border-border-strong hover:shadow-lg';

/* Top-edge highlight — reads as an elevated surface in dark, invisible in light. */
const CardSheen = () => (
  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent dark:via-white/[0.09]" />
);

const SectionTitle = ({ title, hint }) => (
  <div className="flex min-w-0 items-center gap-3">
    <span className="h-8 w-[3px] flex-shrink-0 rounded-pill bg-gradient-to-b from-primary via-primary/70 to-primary/10" />
    <div className="min-w-0">
      <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-text-primary">{title}</h3>
      {hint && <p className="mt-0.5 truncate text-xs text-text-muted">{hint}</p>}
    </div>
  </div>
);

/* Compact axis labels keep the trend chart from being crowded by long numbers. */
const compactAxisValue = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${n}`;
};

const TooltipShell = ({ children }) => (
  <div className="min-w-[150px] rounded-xl border border-border-strong/70 bg-elevated/95 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
    {children}
  </div>
);

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <TooltipShell>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary shadow-[0_0_0_3px_rgb(var(--accent-primary)/0.18)]" />
        <span className="text-xs text-text-secondary">Spent</span>
        <span className="ml-auto font-display text-sm font-bold text-text-primary tabular-nums">
          {formatCurrency(payload[0].value || 0)}
        </span>
      </div>
    </TooltipShell>
  );
};

const SliceTooltip = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0];
  const swatch = slice.payload?.fill || slice.color || 'rgb(var(--accent-primary))';
  return (
    <TooltipShell>
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ backgroundColor: swatch }} />
        <span className="text-xs font-medium text-text-secondary">{slice.name}</span>
        <span className="ml-auto font-display text-sm font-bold text-text-primary tabular-nums">
          {formatCurrency(slice.value || 0)}
        </span>
      </div>
    </TooltipShell>
  );
};

const MonthChangeIndicator = ({ change, variant = 'default', loading = false }) => {
  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <div className="h-6 w-[72px] rounded-pill bg-muted animate-pulse" />
        <span className="text-[11px] font-medium text-text-muted">since last month</span>
      </div>
    );
  }

  const suffixClass = variant === 'hero' ? 'text-text-secondary' : 'text-text-muted';

  if (change.type === 'new' || change.type === 'neutral') {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`inline-flex items-center rounded-pill border border-border-subtle bg-muted/70 px-2.5 py-1 text-xs font-semibold tabular-nums ${variant === 'hero' ? 'text-text-primary' : 'text-text-secondary'}`}>
          {change.label}
        </span>
        <span className={`text-[11px] font-medium ${suffixClass}`}>since last month</span>
      </div>
    );
  }

  const isUp = change.type === 'up';
  const colorClass = isUp ? 'text-success' : 'text-error';
  const tintClass = isUp ? 'border-success/25 bg-success/[0.10]' : 'border-error/25 bg-error/[0.10]';
  const Arrow = isUp ? TrendingUp : TrendingDown;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      <div className={`inline-flex items-center rounded-pill border px-2.5 py-1 text-xs font-semibold tabular-nums ${tintClass} ${colorClass}`}>
        <Arrow className="mr-1.5 h-3.5 w-3.5 shrink-0" color="currentColor" strokeWidth={2.4} />
        <span>{change.label}</span>
      </div>
      <span className={`text-[11px] font-medium ${suffixClass}`}>since last month</span>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const heroCardRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  // Scroll hooks
  const { scrollY } = useScroll();
  const { scrollYProgress } = useScroll({
    target: heroCardRef,
    offset: ["start start", "end start"]
  });

  // Background slow scroll
  const bgY = useTransform(scrollY, [0, 500], [0, 60]);
  const yTransform = shouldReduceMotion ? 0 : bgY;

  // Hero Card scroll transitions
  const cardScale = useTransform(scrollYProgress, [0, 1], [1, 0.98]);
  const cardOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.9]);

  const scaleVal = shouldReduceMotion ? 1 : cardScale;
  const opacityVal = shouldReduceMotion ? 1 : cardOpacity;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    totalSpent: 0,
    activeBudgets: 0,
    unreadNotifications: 0,
    topCategory: { name: 'Food', amount: 0 },
    expensesByCategory: [],
    spendingTrend: [],
    recentExpenses: [],
    budgets: [],
    budgetMonthChange: { type: 'neutral', label: '—' },
    spentMonthChange: { type: 'neutral', label: '—' },
    currentMonthExpenses: [],
  });
  const [exporting, setExporting] = useState(false);
  const [exportToast, setExportToast] = useState(null);
  const [animatedValues, setAnimatedValues] = useState({
    totalSpent: 0,
    activeBudgets: 0,
    unreadNotifications: 0
  });
  const [timePeriod, setTimePeriod] = useState('monthly');

  const handleViewDetails = () => {
    navigate('/expenses');
  };

  const handleExportReport = async () => {
    setExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      exportExpensesToCsv(data.currentMonthExpenses, getExpenseExportFilename());
      setExportToast('Report exported');
      setTimeout(() => setExportToast(null), 3000);
    } catch (err) {
      console.error('Failed to export report:', err);
    } finally {
      setExporting(false);
    }
  };

  // Count up animation
  useEffect(() => {
    if (!loading) {
      const duration = 800;
      const startTime = performance.now();
      const startValues = { ...animatedValues };
      const targetValues = {
        totalSpent: data.totalSpent,
        activeBudgets: data.activeBudgets,
        unreadNotifications: data.unreadNotifications
      };

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        setAnimatedValues({
          totalSpent: startValues.totalSpent + (targetValues.totalSpent - startValues.totalSpent) * easeOut,
          activeBudgets: Math.round(startValues.activeBudgets + (targetValues.activeBudgets - startValues.activeBudgets) * easeOut),
          unreadNotifications: Math.round(startValues.unreadNotifications + (targetValues.unreadNotifications - startValues.unreadNotifications) * easeOut)
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [loading, data.totalSpent, data.activeBudgets, data.unreadNotifications]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch all data in parallel using axios instance (token attached automatically)
        const now = new Date();
        const currentMonthStr = formatYearMonth(now);
        const previousMonthDate = getPreviousMonthDate(now);
        const previousMonthStr = formatYearMonth(previousMonthDate);

        const [expenses, budgets, previousMonthBudgets, notifications] = await Promise.all([
          expenseService.getExpenses().catch(err => {
            console.error('Failed to fetch expenses:', err);
            return [];
          }),
          budgetService.getBudgets({ month: currentMonthStr }).catch(err => {
            console.error('Failed to fetch budgets:', err);
            return [];
          }),
          budgetService.getBudgets({ month: previousMonthStr }).catch(err => {
            console.error('Failed to fetch previous month budgets:', err);
            return [];
          }),
          notificationService.getNotifications().catch(err => {
            console.error('Failed to fetch notifications:', err);
            return [];
          })
        ]);

        // Compute stats from real data
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const previousMonth = previousMonthDate.getMonth();
        const previousYear = previousMonthDate.getFullYear();

        // Filter expenses for current month
        const currentMonthExpenses = expenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
        });

        // Calculate total spent this month
        const totalSpent = currentMonthExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const previousMonthSpent = sumExpensesForMonth(expenses, previousYear, previousMonth);

        const budgetMonthChange = calculateMonthOverMonthChange(budgets.length, previousMonthBudgets.length);
        const spentMonthChange = calculateMonthOverMonthChange(totalSpent, previousMonthSpent);

        // Calculate expenses by category
        const categoryTotals = currentMonthExpenses.reduce((acc, expense) => {
          const category = expense.category || 'Other';
          acc[category] = (acc[category] || 0) + (expense.amount || 0);
          return acc;
        }, {});

        const expensesByCategory = Object.entries(categoryTotals).map(([name, value]) => ({
          name,
          value
        }));

        // Find top category
        const topCategory = expensesByCategory.length > 0
          ? expensesByCategory.reduce((max, cat) => cat.value > max.value ? cat : max, expensesByCategory[0])
          : { name: 'None', value: 0 };

        // Calculate spending trend based on time period
        let spendingTrend = [];
        if (timePeriod === 'monthly') {
          // Last 6 months
          for (let i = 5; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            const monthExpenses = expenses.filter(expense => {
              const expenseDate = new Date(expense.date);
              return expenseDate.getMonth() === date.getMonth() && expenseDate.getFullYear() === date.getFullYear();
            });
            const monthTotal = monthExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
            spendingTrend.push({
              month: date.toLocaleDateString('en-US', { month: 'short' }),
              amount: monthTotal
            });
          }
        } else {
          // Last 8 weeks with actual date ranges
          for (let i = 7; i >= 0; i--) {
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() - (i * 7));
            weekEnd.setHours(23, 59, 59, 999);
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 6);
            weekStart.setHours(0, 0, 0, 0);

            const weekExpenses = expenses.filter(expense => {
              const expenseDate = new Date(expense.date);
              return expenseDate >= weekStart && expenseDate <= weekEnd;
            });
            const weekTotal = weekExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

            // Format date range label
            const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const label = formatDate(weekStart) + '-' + formatDate(weekEnd);

            spendingTrend.push({
              month: label,
              amount: weekTotal
            });
          }

          // Trim leading zero-weeks to avoid flat line at start
          let firstNonZeroIndex = 0;
          for (let i = 0; i < spendingTrend.length; i++) {
            if (spendingTrend[i].amount > 0) {
              firstNonZeroIndex = i;
              break;
            }
          }
          // Keep at most 2 leading zero weeks for context
          if (firstNonZeroIndex > 2) {
            spendingTrend = spendingTrend.slice(firstNonZeroIndex - 2);
          }
        }

        // Get recent expenses (last 5)
        const recentExpenses = expenses
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5);

        // Count unread notifications
        const unreadNotifications = notifications.filter(n => !n.read).length;

        // Calculate budget progress
        const budgetsWithProgress = budgets.map(budget => {
          const categoryExpenses = currentMonthExpenses.filter(
            expense => expense.category === budget.category
          );
          const currentSpent = categoryExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
          return {
            ...budget,
            currentSpent,
            monthlyLimit: budget.monthlyLimit || budget.limit
          };
        });

        setData({
          totalSpent,
          activeBudgets: budgets.length,
          unreadNotifications,
          topCategory,
          expensesByCategory,
          spendingTrend,
          recentExpenses,
          budgets: budgetsWithProgress,
          budgetMonthChange,
          spentMonthChange,
          currentMonthExpenses,
        });
      } catch (err) {
        console.error('Dashboard data fetch error:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Recalculate spending trend when time period changes
  useEffect(() => {
    const recalculateTrend = async () => {
      try {
        const expenses = await expenseService.getExpenses().catch(err => {
          console.error('Failed to fetch expenses:', err);
          return [];
        });

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        let spendingTrend = [];
        if (timePeriod === 'monthly') {
          // Last 6 months
          for (let i = 5; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            const monthExpenses = expenses.filter(expense => {
              const expenseDate = new Date(expense.date);
              return expenseDate.getMonth() === date.getMonth() && expenseDate.getFullYear() === date.getFullYear();
            });
            const monthTotal = monthExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
            spendingTrend.push({
              month: date.toLocaleDateString('en-US', { month: 'short' }),
              amount: monthTotal
            });
          }
        } else {
          // Last 8 weeks with actual date ranges
          for (let i = 7; i >= 0; i--) {
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() - (i * 7));
            weekEnd.setHours(23, 59, 59, 999);
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 6);
            weekStart.setHours(0, 0, 0, 0);

            const weekExpenses = expenses.filter(expense => {
              const expenseDate = new Date(expense.date);
              return expenseDate >= weekStart && expenseDate <= weekEnd;
            });
            const weekTotal = weekExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

            // Format date range label
            const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const label = formatDate(weekStart) + '-' + formatDate(weekEnd);

            spendingTrend.push({
              month: label,
              amount: weekTotal
            });
          }

          // Trim leading zero-weeks to avoid flat line at start
          let firstNonZeroIndex = 0;
          for (let i = 0; i < spendingTrend.length; i++) {
            if (spendingTrend[i].amount > 0) {
              firstNonZeroIndex = i;
              break;
            }
          }
          // Keep at most 2 leading zero weeks for context
          if (firstNonZeroIndex > 2) {
            spendingTrend = spendingTrend.slice(firstNonZeroIndex - 2);
          }
        }

        setData(prev => ({ ...prev, spendingTrend }));
      } catch (err) {
        console.error('Failed to recalculate trend:', err);
      }
    };

    recalculateTrend();
  }, [timePeriod]);

  const getCategoryColor = (category) => {
    const colors = {
      'Food': 'bg-success/10 border border-success/25 text-success',
      'Transport': 'bg-secondary/10 border border-secondary/25 text-secondary',
      'Entertainment': 'bg-info/10 border border-info/25 text-info',
      'Bills': 'bg-warning/10 border border-warning/25 text-warning',
      'Shopping': 'bg-error/10 border border-error/25 text-error',
      'Other': 'bg-muted border border-border-subtle text-text-secondary'
    };
    return colors[category] || colors.Other;
  };

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-canvas flex items-center justify-center px-6">
        <div className={`${PANEL} w-full max-w-sm p-8 text-center`}>
          <CardSheen />
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-error/25 bg-error/[0.08]">
            <WalletCards className="h-5 w-5 shrink-0" color="var(--error-icon-hex)" strokeWidth={1.8} />
          </div>
          <p className="text-error mb-4 text-sm font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="text-primary hover:underline text-sm font-semibold">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-canvas px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      {/* Ambient canvas depth — decorative, parallaxes slowly on scroll */}
      <motion.div style={{ y: yTransform }} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[460px]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-strong/70 to-transparent" />
        <div className="absolute -top-28 left-[18%] h-72 w-72 rounded-full bg-primary/[0.07] blur-[100px] dark:bg-primary/[0.11]" />
        <div className="absolute -top-36 right-[4%] h-80 w-80 rounded-full bg-secondary/[0.05] blur-[110px] dark:bg-secondary/[0.09]" />
      </motion.div>

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}
        className="relative z-10 mb-7"
      >
        <div className="mb-3 inline-flex items-center gap-2 rounded-pill border border-border-subtle bg-surface/80 px-2.5 py-1 shadow-sm backdrop-blur-sm">
          <span className="relative grid h-1.5 w-1.5 place-items-center">
            <span className="absolute h-2.5 w-2.5 rounded-full bg-primary/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Smart Budget</span>
        </div>
        <h1 className="font-display text-[27px] font-bold leading-[1.08] tracking-display text-text-primary sm:text-[33px]">Dashboard Overview</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">Track your expenses, budgets, and trends — all in one place.</p>
        <div className="mt-6 h-px w-full bg-gradient-to-r from-border-strong/70 via-border-subtle to-transparent" />
      </motion.div>

      {loading ? (
        <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface p-6 shadow-md">
              <CardSheen />
              <div className="animate-pulse space-y-4">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl bg-muted" />
                  <div className="h-6 w-28 rounded-pill bg-muted" />
                </div>
                <div className="h-10 w-2/3 rounded-lg bg-muted" />
                <div className="h-6 w-1/2 rounded-pill bg-muted" />
                <div className="h-28 rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.035
              }
            }
          }}
          className="space-y-6 relative z-10"
        >

          {/* UNIFIED GRID: 3-col asymmetric layout                             */}
          {/* Row 1: Active Budgets · Total Spent (hero) · Expense Breakdown    */}
          {/* Row 2: Budget Overview · Spending Trend (spans 2)                 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:grid-rows-[auto_1fr]">

            {/* ── COL 1, ROW 1: Active Budgets ── */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
              }}
            >
              <TiltCard className={`${PANEL} h-full p-5`} tiltIntensity={4}>
                <CardSheen />
                <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/[0.10]" />
                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.16] to-primary/[0.03] shadow-sm">
                      <Landmark className="h-[21px] w-[21px] shrink-0" color="var(--accent-primary-hex)" strokeWidth={1.8} />
                    </div>
                    <span className="rounded-pill border border-border-subtle bg-muted/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Active Budgets</span>
                  </div>
                  <div className="mt-auto pt-6">
                    <p className="font-display text-[38px] font-bold leading-none tracking-display text-text-primary tabular-nums">{animatedValues.activeBudgets}</p>
                    <MonthChangeIndicator change={data.budgetMonthChange} loading={loading} />
                  </div>
                </div>
              </TiltCard>
            </motion.div>

            {/* ── COL 2, ROW 1: Total Spent This Month (Hero) ── */}
            <motion.div
              ref={heroCardRef}
              style={{ scale: scaleVal, opacity: opacityVal }}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
              }}
              className="h-full"
            >
              <TiltCard className={`${PANEL} h-full p-5 hover:border-primary/40`} tiltIntensity={4}>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-transparent to-secondary/[0.05]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/[0.10] blur-3xl dark:bg-primary/[0.15]" />
                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-pill border border-primary/25 bg-primary/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Total Spent This Month</span>
                    <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.18] to-primary/[0.04] shadow-sm">
                      <HandCoins className="h-[21px] w-[21px] shrink-0" color="var(--accent-primary-hex)" strokeWidth={1.8} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="font-display text-[38px] font-bold leading-none tracking-display text-text-primary tabular-nums sm:text-[42px]">{formatCurrency(animatedValues.totalSpent ?? 0)}</p>
                    <MonthChangeIndicator change={data.spentMonthChange} variant="hero" loading={loading} />
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2.5 pt-4">
                    <button
                      type="button"
                      onClick={handleViewDetails}
                      className="primary-action inline-flex items-center gap-1.5 rounded-lg bg-accent-solid px-4 py-2.5 text-xs font-semibold text-text-on-accent shadow-md ring-1 ring-inset ring-white/20 transition-all duration-fast hover:bg-accent-solid-hover hover:shadow-lg"
                    >
                      <span>View Details</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" color="currentColor" strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={handleExportReport}
                      disabled={exporting}
                      className="rounded-lg border border-border-strong bg-surface/80 px-4 py-2.5 text-xs font-semibold text-text-primary shadow-sm backdrop-blur-sm transition-all duration-fast hover:border-primary/40 hover:bg-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {exporting ? 'Exporting...' : 'Export Report'}
                    </button>
                  </div>
                </div>
              </TiltCard>
            </motion.div>

            {/* ── COL 3, ROW 1: Expense Breakdown ── */}
            <div className="contents">

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
                }}
                className={`${PANEL} flex min-h-0 flex-col p-5`}
              >
                <CardSheen />
                <div className="relative z-10 mb-2.5 flex-shrink-0">
                  <SectionTitle title="Expense Breakdown" hint="By category, this month" />
                </div>
                <div className="relative z-10 flex-shrink-0">
                  <ResponsiveContainer width="100%" height={154}>
                    <PieChart>
                      <Pie
                        data={data.expensesByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={66}
                        paddingAngle={2}
                        cornerRadius={5}
                        labelLine={false}
                        fill="rgb(var(--accent-primary))"
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {data.expensesByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={chartColor(entry.name, index)} stroke="rgb(var(--bg-surface))" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<SliceTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-text-muted">Total</p>
                      <p className="mt-1 font-display text-[17px] font-bold leading-none tracking-heading text-text-primary tabular-nums">{formatCurrency(data.totalSpent)}</p>
                    </div>
                  </div>
                </div>
                <div className="relative z-10 mt-2.5 grid min-h-0 flex-1 grid-cols-2 gap-x-4 gap-y-0.5 overflow-hidden border-t border-border-subtle pt-2.5">
                  {data.expensesByCategory.slice(0, 6).map((cat, index) => (
                    <div key={cat.name} className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1.5 transition-colors duration-fast hover:bg-hover">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px] shadow-sm" style={{ backgroundColor: chartColor(cat.name, index) }}></span>
                        <span className="truncate text-xs font-medium text-text-secondary">{cat.name}</span>
                      </div>
                      <span className="flex-shrink-0 text-xs font-semibold text-text-primary tabular-nums">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── COL 1, ROW 2: Budget Overview ── */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
                }}
                className={`${PANEL} flex min-h-0 flex-col p-6 lg:col-start-1 lg:row-start-2`}
              >
                <CardSheen />
                <div className="relative z-10 mb-4 flex flex-shrink-0 items-center justify-between gap-3">
                  <SectionTitle title="Budget Overview" />
                  <a href="/budgets" className="group inline-flex flex-shrink-0 items-center gap-1.5 rounded-pill border border-border-subtle bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors duration-fast hover:border-primary/40 hover:bg-hover">
                    <span>See All</span>
                    <ArrowRight className="h-3 w-3 shrink-0 transition-transform duration-base group-hover:translate-x-0.5" color="var(--accent-primary-hex)" />
                  </a>
                </div>
                {data.budgets.length > 0 ? (
                  <div className="relative z-10 flex-1 min-h-0 flex flex-col">
                    <div className="relative flex-shrink-0">
                      <div className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.07] blur-2xl dark:bg-primary/[0.12]" />
                      <ResponsiveContainer width="100%" height={158}>
                        <PieChart>
                          <defs>
                            <linearGradient id="budgetGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(var(--accent-primary))" stopOpacity={0.95} /><stop offset="100%" stopColor="rgb(var(--accent-primary))" stopOpacity={0.5} /></linearGradient>
                          </defs>
                          <Pie
                            data={[
                              { name: 'Spent', value: data.budgets.reduce((sum, b) => sum + (b.currentSpent || 0), 0) },
                              { name: 'Remaining', value: data.budgets.reduce((sum, b) => sum + (b.monthlyLimit || 0), 0) - data.budgets.reduce((sum, b) => sum + (b.currentSpent || 0), 0) }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={70}
                            paddingAngle={2}
                            cornerRadius={5}
                            labelLine={false}
                            fill="rgb(var(--accent-primary))"
                            dataKey="value"
                            isAnimationActive={false}
                          >
                            <Cell fill="url(#budgetGradient)" stroke="rgb(var(--bg-surface))" strokeWidth={2} />
                            <Cell fill="rgb(var(--bg-muted))" stroke="rgb(var(--bg-surface))" strokeWidth={2} />
                          </Pie>
                          <Tooltip content={<SliceTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                        <p className="font-display text-[26px] font-bold leading-none tracking-display text-text-primary tabular-nums">
                          {Math.round((data.budgets.reduce((sum, b) => sum + (b.currentSpent || 0), 0) / Math.max(data.budgets.reduce((sum, b) => sum + (b.monthlyLimit || 0), 0), 1)) * 100)}%
                        </p>
                        <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-text-muted">Used</p>
                      </div>
                    </div>
                    <div className="mt-4 flex-1 min-h-0 space-y-3 overflow-hidden border-t border-border-subtle pt-4">
                      {data.budgets.slice(0, 3).map((budget, index) => (
                        <div key={budget.id}>
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px] shadow-sm" style={{ backgroundColor: chartColor(budget.category, index) }}></span>
                              <span className="truncate text-xs font-medium text-text-secondary">{budget.category}</span>
                            </div>
                            <span className="flex-shrink-0 text-xs font-semibold text-text-primary tabular-nums">{formatCurrency(budget.currentSpent || 0)}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-pill bg-muted shadow-control">
                            <div
                              className="h-full rounded-pill transition-[width] duration-slow ease-standard"
                              style={{
                                width: `${Math.min(Math.max(((budget.currentSpent || 0) / Math.max(budget.monthlyLimit || 0, 1)) * 100, 0), 100)}%`,
                                backgroundColor: chartColor(budget.category, index),
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10 text-center py-6 flex-1 flex flex-col items-center justify-center">
                    <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl border border-border-subtle bg-gradient-to-br from-muted to-surface shadow-sm"><WalletCards className="h-5 w-5 shrink-0 text-text-muted" color="var(--muted-icon-hex)" /></div>
                    <p className="text-sm font-medium text-text-secondary">No budgets set yet</p>
                    <a href="/budgets" className="mt-2 inline-block text-xs font-semibold text-primary hover:text-primary-hover">
                      Create your first budget
                    </a>
                  </div>
                )}
              </motion.div>

            </div>

            {/* ── COLS 2+3, ROW 2: Spending Trend ── */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
              }}
              className={`${PANEL} p-6 lg:col-span-2 lg:col-start-2 lg:row-start-2`}
            >
              <CardSheen />
              <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-[420px] rounded-full bg-primary/[0.05] blur-[90px] dark:bg-primary/[0.09]" />
              <div className="relative z-10 mb-6 flex flex-wrap items-start justify-between gap-4">
                <SectionTitle title="Spending Trend" hint={timePeriod === 'monthly' ? 'Last 6 months' : 'Last 8 weeks'} />
                <div className="flex items-center gap-3">
                  <span className="hidden items-center gap-2 rounded-pill border border-border-subtle bg-muted/60 px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary sm:inline-flex">
                    <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_3px_rgb(var(--accent-primary)/0.18)]" />
                    Spending
                  </span>
                  <div className="relative">
                    <select
                      value={timePeriod}
                      onChange={(e) => setTimePeriod(e.target.value)}
                      className="appearance-none rounded-lg border border-border-strong bg-elevated py-2 pl-3.5 pr-9 text-xs font-semibold text-text-primary shadow-sm outline-none transition-colors duration-fast hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 shrink-0" color="var(--muted-icon-hex)" strokeWidth={2.2} />
                  </div>
                </div>
              </div>
              <div className="relative z-10">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={data.spendingTrend} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(var(--accent-primary))" stopOpacity={0.32} />
                        <stop offset="55%" stopColor="rgb(var(--accent-primary))" stopOpacity={0.09} />
                        <stop offset="100%" stopColor="rgb(var(--accent-primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgb(var(--border-subtle))" strokeDasharray="2 6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      dy={10}
                      minTickGap={12}
                      interval="preserveStartEnd"
                      tick={{ fill: 'rgb(var(--text-muted))', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={46}
                      dx={-4}
                      tickFormatter={compactAxisValue}
                      tick={{ fill: 'rgb(var(--text-muted))', fontSize: 11, fontWeight: 600 }}
                    />
                    <Tooltip
                      content={<TrendTooltip />}
                      cursor={{ stroke: 'rgb(var(--border-strong))', strokeWidth: 1, strokeDasharray: '3 4' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="rgb(var(--accent-primary))"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      fill="url(#trendGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: 'rgb(var(--accent-primary))', stroke: 'rgb(var(--bg-surface))', strokeWidth: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

          </div>

          {/* ROW 3: Recent Expenses Table */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
            }}
            className={`${PANEL} hover:border-border-subtle hover:shadow-md`}
          >
            <CardSheen />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle px-6 py-5">
              <SectionTitle title="Recent Expenses" hint="Your latest transactions" />
              <a href="/expenses" className="group inline-flex flex-shrink-0 items-center gap-1.5 rounded-pill border border-border-subtle bg-surface px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors duration-fast hover:border-primary/40 hover:bg-hover">
                <span>See More</span>
                <ArrowRight className="h-3 w-3 shrink-0 transition-transform duration-base group-hover:translate-x-0.5" color="var(--accent-primary-hex)" />
              </a>
            </div>
            <div className="relative z-10 overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border-subtle">
                    <th className="px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Description</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Category</th>
                    <th className="px-4 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Amount</th>
                    <th className="px-6 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentExpenses.map((expense, index) => {
                    const CategoryIcon = getCategoryIcon(expense.category);
                    return (
                    <motion.tr
                      key={expense.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="group border-b border-border-subtle transition-colors duration-fast last:border-0 hover:bg-hover"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <div className={`w-10 h-10 flex-shrink-0 rounded-xl ${getCategoryColor(expense.category)} grid place-items-center shadow-sm iso-icon-container`}>
                            {CategoryIcon && <CategoryIcon className="w-[18px] h-[18px] iso-icon" />}
                          </div>
                          <span className="text-sm font-semibold tracking-[-0.005em] text-text-primary">{expense.description}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-semibold ${getCategoryColor(expense.category)}`}>{expense.category}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-display text-sm font-bold text-error tabular-nums">-{formatCurrency(expense.amount || 0)}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-medium text-text-muted tabular-nums">{new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      )}

      {exportToast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-border-strong bg-elevated/95 px-4 py-3 text-sm font-semibold text-text-primary shadow-xl backdrop-blur-md"
        >
          <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border border-success/30 bg-success/[0.12]">
            <Check className="h-3.5 w-3.5 shrink-0" color="var(--success-icon-hex)" strokeWidth={3} />
          </span>
          {exportToast}
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;
