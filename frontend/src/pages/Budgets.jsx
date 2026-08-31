import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Pencil, Trash2, ChevronDown, ChevronLeft, ChevronRight, X, PiggyBank, Ellipsis, CircleCheck, Search, ShieldCheck, TriangleAlert, Wallet, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TiltCard from '@/components/TiltCard';
import { budgetService } from '@/services/budgetService';
import { formatCurrency } from '@/utils/formatters';
import { getCategoryIcon } from '@/utils/categoryIcons';

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Bills', 'Shopping', 'Other'];

const getCategoryColor = (category) => {
  const colors = {
    'Food': 'border border-success/25 bg-success/10 text-success dark:border-success/30 dark:bg-success/15',
    'Transport': 'border border-secondary/25 bg-secondary/10 text-secondary dark:border-secondary/35 dark:bg-secondary/15',
    'Entertainment': 'border border-info/25 bg-info/10 text-info dark:border-info/30 dark:bg-info/15',
    'Bills': 'border border-warning/25 bg-warning/10 text-warning dark:border-warning/30 dark:bg-warning/15',
    'Shopping': 'border border-error/25 bg-error/10 text-error dark:border-error/30 dark:bg-error/15',
    'Other': 'border border-border-strong bg-muted text-text-secondary'
  };
  return colors[category] || 'border border-border-strong bg-muted text-text-secondary';
};

const getProgressColor = (percentage) => {
  if (percentage < 70) return 'bg-primary';
  if (percentage < 80) return 'bg-warning';
  return 'bg-error';
};

/* Presentation-only mirror of the thresholds above — no new rules, same 70/80 boundaries. */
const getHealthPresentation = (percentage) => {
  if (percentage < 70) {
    return { label: 'On track', Icon: ShieldCheck, chip: 'border-success/25 bg-success/[0.10] text-success', iconHex: 'var(--success-icon-hex)' };
  }
  if (percentage < 80) {
    return { label: 'Approaching limit', Icon: TriangleAlert, chip: 'border-warning/25 bg-warning/[0.10] text-warning', iconHex: 'var(--warning-icon-hex)' };
  }
  return { label: percentage >= 100 ? 'Over limit' : 'Almost at limit', Icon: TriangleAlert, chip: 'border-error/25 bg-error/[0.10] text-error', iconHex: 'var(--error-icon-hex)' };
};

/* ── Presentation primitives shared with the Dashboard design language ── */

const CardSheen = () => (
  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent dark:via-white/[0.09]" />
);

const AmbientCanvas = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[460px]">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-strong/70 to-transparent" />
    <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-primary/[0.06] blur-[100px] dark:bg-primary/[0.10]" />
    <div className="absolute -top-32 right-[12%] h-80 w-80 rounded-full bg-secondary/[0.05] blur-[110px] dark:bg-secondary/[0.08]" />
  </div>
);

const EyebrowChip = ({ children }) => (
  <div className="mb-3 inline-flex items-center gap-2 rounded-pill border border-border-subtle bg-surface/80 px-2.5 py-1 shadow-sm backdrop-blur-sm">
    <span className="relative grid h-1.5 w-1.5 place-items-center">
      <span className="absolute h-2.5 w-2.5 rounded-full bg-primary/25" />
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
    </span>
    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">{children}</span>
  </div>
);

const SummaryMetric = ({ icon: Icon, label, value, valueClass = 'text-text-primary', iconHex = 'var(--muted-icon-hex)' }) => (
  <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-canvas/60 px-3.5 py-3">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface shadow-sm">
      <Icon className="h-4 w-4 shrink-0" color={iconHex} strokeWidth={1.9} />
    </span>
    <span className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</span>
      <span className={`mt-0.5 block truncate font-display text-[15px] font-bold tracking-heading tabular-nums ${valueClass}`}>{value}</span>
    </span>
  </div>
);

const Budgets = () => {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [deletingBudget, setDeletingBudget] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [budgetSearch, setBudgetSearch] = useState('');
  const [formData, setFormData] = useState({
    category: 'Food',
    customCategory: '',
    monthlyLimit: '',
    month: (() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    })()
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openActionId, setOpenActionId] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const fetchRequestIdRef = useRef(0);

  useEffect(() => {
    fetchBudgets();
  }, [selectedMonth]);

  const fetchBudgets = async ({ showLoading = true } = {}) => {
    const requestId = ++fetchRequestIdRef.current;
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const year = selectedMonth.getFullYear();
      const month = String(selectedMonth.getMonth() + 1).padStart(2, '0');
      const monthStr = `${year}-${month}`;
      const data = await budgetService.getBudgets({ month: monthStr });
      if (requestId === fetchRequestIdRef.current) {
        setBudgets(data);
      }
    } catch (err) {
      if (requestId === fetchRequestIdRef.current) {
        setError('Failed to load budgets');
      }
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleAddBudget = () => {
    setEditingBudget(null);
    const year = selectedMonth.getFullYear();
    const month = String(selectedMonth.getMonth() + 1).padStart(2, '0');
    setFormData({
      category: 'Food',
      customCategory: '',
      monthlyLimit: '',
      month: `${year}-${month}`
    });
    setFormError('');
    setSaveMessage('');
    setShowModal(true);
  };

  const handleEditBudget = (budget) => {
    setEditingBudget(budget);
    const isPresetCategory = CATEGORIES.includes(budget.category);
    setFormData({
      category: isPresetCategory ? budget.category : 'Other',
      customCategory: isPresetCategory ? '' : budget.category,
      monthlyLimit: budget.monthlyLimit,
      month: budget.month
    });
    setFormError('');
    setSaveMessage('');
    setShowModal(true);
  };

  const handleDeleteBudget = (budget) => {
    setDeletingBudget(budget);
    setShowDeleteDialog(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const selectedCategory = formData.customCategory.trim() || formData.category;

    if (!selectedCategory) {
      setFormError('Category is required');
      setSubmitting(false);
      return;
    }
    if (selectedCategory.length > 100) {
      setFormError('Category must be at most 100 characters');
      setSubmitting(false);
      return;
    }
    if (!formData.monthlyLimit || parseFloat(formData.monthlyLimit) <= 0) {
      setFormError('Monthly limit must be greater than 0');
      setSubmitting(false);
      return;
    }

    try {
      const budgetData = {
        category: selectedCategory,
        monthlyLimit: parseFloat(formData.monthlyLimit),
        month: formData.month
      };

      let savedBudget;
      let message;

      if (editingBudget) {
        savedBudget = await budgetService.updateBudget(editingBudget.id, budgetData);
        message = 'Budget updated';
      } else {
        const response = await budgetService.createBudget(budgetData);
        savedBudget = response.budget;
        message = response.message || (response.created
          ? 'Budget created'
          : `Budget limit increased to ${formatCurrency(savedBudget?.monthlyLimit || budgetData.monthlyLimit)}`);
      }

      if (savedBudget) {
        setBudgets((currentBudgets) => {
          const existingIndex = currentBudgets.findIndex((budget) => budget.id === savedBudget.id);
          if (existingIndex === -1) return [...currentBudgets, savedBudget];

          return currentBudgets.map((budget, index) => (
            index === existingIndex ? savedBudget : budget
          ));
        });
      }

      setShowModal(false);
      setSaveMessage(message);
      await fetchBudgets({ showLoading: false });
    } catch (err) {
      setFormError('Failed to save budget. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await budgetService.deleteBudget(deletingBudget.id);
      setShowDeleteDialog(false);
      setBudgets(prev => prev.filter(b => b.id !== deletingBudget.id));
    } catch (err) {
      setError('Failed to delete budget');
    }
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedMonth(newDate);
  };

  const formatMonth = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const totalLimit = budgets.reduce((sum, budget) => sum + Number(budget.monthlyLimit || 0), 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + Number(budget.currentSpent || 0), 0);
  const totalRemaining = totalLimit - totalSpent;
  const totalPercentage = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const normalizedBudgetSearch = budgetSearch.trim().toLocaleLowerCase();
  const filteredBudgets = budgets.filter((budget) => (
    !normalizedBudgetSearch || (budget.category || '').toLocaleLowerCase().includes(normalizedBudgetSearch)
  ));

  const overallHealth = getHealthPresentation(totalPercentage);
  const OverallHealthIcon = overallHealth.Icon;

  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.97,
      transition: { duration: 0.3, ease: "easeOut" }
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-canvas px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <AmbientCanvas />

      <div className="relative z-10 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className=""
        >
          <EyebrowChip>Allocation</EyebrowChip>
          <h1 className="font-display text-[27px] font-bold leading-[1.08] tracking-display text-text-primary sm:text-[33px]">Budgets</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">Set and track your monthly budgets</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex w-fit items-center justify-center gap-0.5 rounded-xl border border-border-subtle bg-surface/90 p-1 shadow-md backdrop-blur-sm md:justify-self-center"
        >
          <Button variant="ghost" size="sm" onClick={() => navigateMonth(-1)} aria-label="Previous month" className="h-9 w-9 rounded-lg px-0 text-text-muted hover:bg-hover hover:text-text-primary">
            <ChevronLeft className="h-[18px] w-[18px] flex-shrink-0" color="var(--muted-icon-hex)" strokeWidth={2.1} />
          </Button>
          <span className="min-w-40 px-3 py-1.5 text-center">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-text-muted">Plan month</span>
            <span className="mt-0.5 block text-sm font-bold tracking-heading text-text-primary">{formatMonth(selectedMonth)}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigateMonth(1)} aria-label="Next month" className="h-9 w-9 rounded-lg px-0 text-text-muted hover:bg-hover hover:text-text-primary">
            <ChevronRight className="h-[18px] w-[18px] flex-shrink-0" color="var(--muted-icon-hex)" strokeWidth={2.1} />
          </Button>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="md:justify-self-end"
        >
          <Button
            onClick={handleAddBudget}
            className="h-11 rounded-lg px-5 shadow-md ring-1 ring-inset ring-white/20 transition-[background-color,transform,box-shadow] duration-fast hover:-translate-y-0.5 hover:shadow-lg"
          >
            <Plus className="mr-2 h-4 w-4 flex-shrink-0" color="var(--primary-icon-hex)" strokeWidth={2.4} />
            Add Budget
          </Button>
        </motion.div>
      </div>

      <div className="relative z-10 mt-6 h-px w-full bg-gradient-to-r from-border-strong/70 via-border-subtle to-transparent" />

      <AnimatePresence>
        {saveMessage ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="status"
            aria-live="polite"
            className="relative z-10 mt-5 flex items-center gap-2.5 overflow-hidden rounded-xl border border-success/25 bg-success/[0.08] px-4 py-3 text-sm font-semibold text-success shadow-sm"
          >
            <span className="absolute inset-y-0 left-0 w-0.5 bg-success/70" aria-hidden="true" />
            <CircleCheck className="h-4 w-4 flex-shrink-0" color="var(--success-icon-hex)" strokeWidth={2.1} />
            {saveMessage}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative z-10">
      {loading ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <motion.div key={i} variants={itemVariants} className="min-h-60 rounded-xl border border-border-subtle bg-surface p-5 shadow-md">
              <div className="flex items-center gap-3"><div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-muted" /><div className="space-y-2"><div className="h-4 w-24 animate-pulse rounded bg-muted" /><div className="h-2.5 w-32 animate-pulse rounded bg-muted" /></div></div>
              <div className="mt-8 h-9 w-36 animate-pulse rounded bg-muted" />
              <div className="mt-6 h-2 w-full animate-pulse rounded-pill bg-muted" />
              <div className="mt-7 h-12 w-full animate-pulse rounded-lg bg-muted" />
            </motion.div>
          ))}
        </motion.div>
      ) : error ? (
        <div className="mt-6 rounded-xl border border-error/25 bg-error/[0.06] px-6 py-14 text-center shadow-md">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-error/25 bg-error/[0.10] shadow-sm">
            <TriangleAlert className="h-5 w-5 shrink-0" color="var(--error-icon-hex)" strokeWidth={1.9} />
          </div>
          <p className="mb-5 text-sm font-semibold text-error">{error}</p>
          <Button onClick={() => fetchBudgets()} variant="outline" className="rounded-lg">Retry</Button>
        </div>
      ) : budgets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mt-6 overflow-hidden rounded-xl border border-border-subtle bg-surface px-6 py-16 text-center shadow-md"
        >
          <div className="pointer-events-none absolute left-1/2 top-4 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/[0.10]" />
          <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.14] to-primary/[0.02] shadow-sm">
            <PiggyBank className="h-7 w-7 flex-shrink-0 text-primary dark:text-text-secondary" color="var(--icon-badge-foreground-hex)" strokeWidth={1.7} />
          </div>
          <h3 className="relative mb-2 font-display text-lg font-bold tracking-heading text-text-primary">No budgets found</h3>
          <p className="relative mx-auto mb-6 max-w-sm text-sm leading-relaxed text-text-muted">
            Start tracking your spending by creating your first budget.
          </p>
          <Button
            onClick={handleAddBudget}
            className="relative h-11 rounded-lg px-5 shadow-md ring-1 ring-inset ring-white/20"
          >
            <Plus className="mr-2 h-4 w-4 flex-shrink-0" color="var(--primary-icon-hex)" strokeWidth={2.4} />
            Create Your First Budget
          </Button>
        </motion.div>
      ) : (
        <>
          {/* Budget health — the month's allocation read at a glance. */}
          <motion.section
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative mt-6 overflow-hidden rounded-xl border border-border-subtle bg-surface px-4 py-5 shadow-md sm:px-6 sm:py-6"
            aria-label={`${formatMonth(selectedMonth)} budget summary`}
          >
            <CardSheen />
            <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-primary/[0.06] blur-[90px] dark:bg-primary/[0.12]" />

            <div className="relative mb-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{formatMonth(selectedMonth)} plan</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${overallHealth.chip}`}>
                    <OverallHealthIcon className="h-3 w-3 shrink-0" color={overallHealth.iconHex} strokeWidth={2.3} />
                    {overallHealth.label}
                  </span>
                </div>
                <p className="mt-2.5 font-display text-[34px] font-bold leading-none tracking-display text-text-primary tabular-nums sm:text-[40px]">{formatCurrency(totalSpent)}</p>
                <p className="mt-2 text-xs font-medium text-text-muted">Spent across {budgets.length} {budgets.length === 1 ? 'category' : 'categories'} of {formatCurrency(totalLimit)} allocated</p>
              </div>
              <div className="grid w-full gap-2.5 sm:grid-cols-3 lg:w-auto lg:min-w-[27rem]">
                <SummaryMetric
                  icon={Wallet}
                  label="Remaining"
                  value={totalRemaining < 0 ? `−${formatCurrency(Math.abs(totalRemaining))}` : formatCurrency(totalRemaining)}
                  valueClass={totalRemaining < 0 ? 'text-error' : 'text-text-primary'}
                  iconHex={totalRemaining < 0 ? 'var(--error-icon-hex)' : 'var(--accent-primary-hex)'}
                />
                <SummaryMetric icon={Target} label="Monthly limit" value={formatCurrency(totalLimit)} />
                <SummaryMetric icon={PiggyBank} label="Utilised" value={`${totalPercentage}%`} />
              </div>
            </div>

            <div className="relative flex items-center gap-3">
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-pill bg-muted shadow-control">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(totalPercentage, 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full rounded-pill bg-gradient-to-r from-primary/70 via-primary to-primary shadow-[0_0_12px_rgb(var(--accent-primary)/0.35)]" />
                <span aria-hidden="true" className="absolute left-[70%] top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong/35 ring-2 ring-muted/70" />
                <span aria-hidden="true" className="absolute left-[80%] top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong/35 ring-2 ring-muted/70" />
              </div>
              <span className="w-12 text-right font-display text-sm font-bold tabular-nums text-text-primary">{totalPercentage}%</span>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            aria-label="Budget category filters"
            className="relative mt-4 overflow-hidden rounded-xl border border-border-subtle bg-surface px-4 py-3.5 shadow-md sm:px-5"
          >
            <CardSheen />
            <div className="relative flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-8 w-[3px] flex-shrink-0 rounded-pill bg-gradient-to-b from-primary via-primary/70 to-primary/10" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold tracking-[-0.01em] text-text-primary">Category allocation</span>
                  <span className="mt-0.5 block text-xs text-text-muted">Search and review each category plan</span>
                </span>
              </div>
              <div className="relative w-full sm:ml-2 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" color="var(--muted-icon-hex)" />
                <Input
                  type="search"
                  value={budgetSearch}
                  onChange={(event) => setBudgetSearch(event.target.value)}
                  aria-label="Search budgets by category"
                  placeholder="Search budget categories"
                  className="h-10 bg-canvas pl-10 font-medium"
                />
              </div>
              {budgetSearch ? <Button type="button" variant="outline" size="sm" onClick={() => setBudgetSearch('')} className="rounded-lg"><X className="mr-1 h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />Clear</Button> : null}
              <span className="ml-auto rounded-pill border border-border-subtle bg-muted/60 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-text-muted">{filteredBudgets.length} of {budgets.length} categories</span>
            </div>
          </motion.section>

          {filteredBudgets.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center shadow-sm">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-border-subtle bg-muted/70 shadow-sm">
                <Search className="h-5 w-5 shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} />
              </div>
              <h3 className="mt-4 font-display text-base font-bold tracking-heading text-text-primary">No matching budget categories</h3>
              <p className="mt-1.5 text-sm text-text-muted">Try a different category name for {formatMonth(selectedMonth)}.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setBudgetSearch('')} className="mt-5 rounded-lg">Clear search</Button>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
              {filteredBudgets.map((budget) => {
              const Icon = getCategoryIcon(budget.category);
              const percentage = budget.monthlyLimit > 0
                ? Math.round((budget.currentSpent / budget.monthlyLimit) * 100)
                : 0;
              const progressColor = getProgressColor(percentage);
              const remaining = Number(budget.monthlyLimit) - Number(budget.currentSpent);
              const menuOpen = openActionId === budget.id;

              return (
                <motion.div key={budget.id} variants={itemVariants} exit="exit" layout>
                  <TiltCard className="group h-full" tiltIntensity={4}>
                    <article className="relative flex min-h-60 h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface p-5 shadow-md transition-[border-color,box-shadow,background-color] duration-base ease-standard hover:border-border-strong hover:shadow-lg focus-within:border-border-strong focus-within:shadow-lg">
                      <CardSheen />
                      <span aria-hidden="true" className={`pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full blur-3xl ${percentage < 70 ? 'bg-primary/[0.07] dark:bg-primary/[0.12]' : percentage < 80 ? 'bg-warning/[0.07] dark:bg-warning/[0.12]' : 'bg-error/[0.07] dark:bg-error/[0.12]'}`} />

                      <div className="relative flex min-w-0 items-center gap-3 pr-10">
                        <motion.div whileHover={shouldReduceMotion ? {} : { scale: 1.05 }} className={`iso-icon-container flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl shadow-sm ${getCategoryColor(budget.category)}`}><Icon className="iso-icon h-[19px] w-[19px] flex-shrink-0" color="var(--icon-badge-foreground-hex)" /></motion.div>
                        <div className="min-w-0"><h3 className="truncate font-display text-[15px] font-bold tracking-heading text-text-primary">{budget.category}</h3><p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">Monthly category plan</p></div>
                      </div>

                      <div className="relative mt-7 flex items-end justify-between gap-3">
                        <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Spent this month</p><p className="mt-1.5 font-display text-[27px] font-bold leading-none tracking-display tabular-nums text-text-primary">{formatCurrency(budget.currentSpent)}</p></div>
                        <span className={`shrink-0 rounded-pill border px-2.5 py-1 font-display text-xs font-bold tabular-nums ${percentage < 70 ? 'border-primary/25 bg-primary/[0.10] text-primary' : percentage < 80 ? 'border-warning/25 bg-warning/[0.10] text-warning' : 'border-error/25 bg-error/[0.10] text-error'}`}>{percentage}%</span>
                      </div>

                      <div className="relative mt-auto pt-5">
                        <div className="relative h-2 overflow-visible rounded-pill bg-muted shadow-control"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(percentage, 100)}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className={`h-full rounded-pill ${progressColor}`} />{percentage >= 80 ? <span aria-hidden="true" className="absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-text-primary ring-2 ring-surface" style={{ left: `${Math.min(percentage, 99)}%` }} /> : null}</div>
                        <div className="mt-3.5 grid grid-cols-2 gap-4 rounded-lg border border-border-subtle bg-canvas/55 p-3 text-[11px]"><div><p className="font-medium uppercase tracking-[0.1em] text-text-muted">Remaining</p><p className={`mt-1 font-display text-sm font-bold tabular-nums ${remaining < 0 ? 'text-error' : 'text-text-primary'}`}>{remaining < 0 ? `−${formatCurrency(Math.abs(remaining))}` : formatCurrency(remaining)}</p></div><div className="border-l border-border-subtle pl-4 text-right"><p className="font-medium uppercase tracking-[0.1em] text-text-muted">Monthly limit</p><p className="mt-1 font-display text-sm font-bold tabular-nums text-text-primary">{formatCurrency(budget.monthlyLimit)}</p></div></div>
                      </div>

                      <div className="absolute right-3 top-3"><Button variant="ghost" size="icon" onClick={() => setOpenActionId(menuOpen ? null : budget.id)} aria-label={`Actions for ${budget.category} budget`} aria-expanded={menuOpen} className="h-9 w-9 rounded-lg text-text-muted hover:bg-hover hover:text-text-primary md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"><Ellipsis className="h-4 w-4 flex-shrink-0" color="var(--muted-icon-hex)" /></Button><AnimatePresence>{menuOpen ? <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 top-full z-30 mt-1.5 w-40 overflow-hidden rounded-xl border border-border-strong/70 bg-elevated/95 p-1.5 shadow-xl backdrop-blur-md"><button type="button" onClick={() => { setOpenActionId(null); handleEditBudget(budget); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-secondary transition-colors duration-fast hover:bg-hover hover:text-text-primary"><Pencil className="h-4 w-4 flex-shrink-0" color="var(--accent-primary-hex)" />Edit</button><button type="button" onClick={() => { setOpenActionId(null); handleDeleteBudget(budget); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-error transition-colors duration-fast hover:bg-error/10"><Trash2 className="h-4 w-4 flex-shrink-0" color="var(--error-icon-hex)" />Delete</button></motion.div> : null}</AnimatePresence></div>
                    </article>
                  </TiltCard>
                </motion.div>
              );
              })}
              </AnimatePresence>
            </motion.div>
          )}
        </>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-canvas/80 p-4 backdrop-blur-md"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative my-auto w-full max-w-md overflow-hidden rounded-2xl border border-border-strong/60 bg-elevated shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/[0.08] blur-3xl dark:bg-primary/[0.13]" />

              <div className="relative flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.16] to-primary/[0.03] shadow-sm">
                    <PiggyBank className="h-[18px] w-[18px] shrink-0" color="var(--accent-primary-hex)" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold tracking-heading text-text-primary">
                      {editingBudget ? 'Edit Budget' : 'Add Budget'}
                    </h2>
                    <p className="mt-0.5 text-xs text-text-muted">{editingBudget ? 'Adjust this category allocation' : 'Allocate a monthly limit to a category'}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModal(false)}
                  className="h-9 w-9 shrink-0 rounded-lg px-0 text-text-muted hover:bg-hover hover:text-text-primary"
                >
                  <X className="h-4 w-4 flex-shrink-0" color="var(--muted-icon-hex)" />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="relative space-y-5 p-5 sm:p-6">
                {/* The limit is the number that defines the plan — give it the lead. */}
                <div className="rounded-xl border border-border-subtle bg-surface/70 p-4 shadow-control">
                  <label htmlFor="budget-limit" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    Monthly Limit
                  </label>
                  <div className="relative">
                    <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-lg font-bold text-text-muted">₹</span>
                    <Input
                      id="budget-limit"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.monthlyLimit}
                      onChange={(e) => setFormData({ ...formData, monthlyLimit: e.target.value })}
                      placeholder="0.00"
                      required
                      className="h-14 bg-canvas pl-9 font-display text-2xl font-bold tracking-heading tabular-nums"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border-subtle bg-surface/70 p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Category</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="budget-category" className="mb-1.5 block text-xs font-semibold text-text-secondary">
                        Category preset
                      </label>
                      <div className="relative">
                        <select
                          id="budget-category"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="h-11 w-full appearance-none rounded-md border border-border-strong bg-canvas px-3 py-2 pr-10 text-sm font-medium leading-5 text-text-primary shadow-control outline-none transition-colors duration-fast hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                          required={!formData.customCategory.trim()}
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" color="var(--muted-icon-hex)" strokeWidth={2.2} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="budget-custom-category" className="mb-1.5 block text-xs font-semibold text-text-secondary">
                        Custom category <span className="font-normal text-text-muted">(optional)</span>
                      </label>
                      <Input
                        id="budget-custom-category"
                        type="text"
                        maxLength={100}
                        value={formData.customCategory}
                        onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                        placeholder="e.g. Healthcare"
                        aria-describedby="budget-category-help"
                        className="h-11 bg-canvas"
                      />
                    </div>
                    <p id="budget-category-help" className="text-xs leading-5 text-text-muted sm:col-span-2">A custom name overrides the preset and uses the neutral Other icon treatment.</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="budget-month" className="mb-1.5 block text-xs font-semibold text-text-secondary">
                    Month
                  </label>
                  <Input
                    id="budget-month"
                    type="month"
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    required
                    className="h-11 bg-canvas"
                  />
                </div>

                {formError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5 rounded-xl border border-error/25 bg-error/[0.09] p-3.5 text-sm font-medium text-error"
                  >
                    <TriangleAlert className="mt-px h-4 w-4 shrink-0" color="var(--error-icon-hex)" strokeWidth={2.1} />
                    <span>{formError}</span>
                  </motion.div>
                )}

                <div className="flex gap-3 border-t border-border-subtle pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="h-11 flex-1 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-11 flex-1 rounded-lg shadow-md ring-1 ring-inset ring-white/20"
                  >
                    {submitting ? 'Saving...' : editingBudget ? 'Update' : 'Add'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-md"
            onClick={() => setShowDeleteDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border-strong/60 bg-elevated p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-error/45 to-transparent" />
              <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-error/[0.08] blur-3xl" />
              <div className="relative text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-error/25 bg-gradient-to-br from-error/[0.16] to-error/[0.04] shadow-sm">
                  <Trash2 className="h-6 w-6 flex-shrink-0 text-error" color="var(--error-icon-hex)" strokeWidth={1.8} />
                </div>
                <h3 className="mb-2 font-display text-lg font-bold tracking-heading text-text-primary">Delete Budget?</h3>
                <p className="mb-6 text-sm leading-relaxed text-text-muted">
                  Are you sure you want to delete the budget for "{deletingBudget?.category}"? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(false)}
                    className="h-11 flex-1 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmDelete}
                    className="h-11 flex-1 rounded-lg shadow-md ring-1 ring-inset ring-white/20"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Budgets;
