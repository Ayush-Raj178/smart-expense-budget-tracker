import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Pencil, Trash2, Filter, Calendar, X, ShoppingCart, Ellipsis, Search, ChevronDown, ReceiptText, ArrowDownRight, Sigma, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TiltCard from '@/components/TiltCard';
import { expenseService } from '@/services/expenseService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { useNotifications } from '@/context/NotificationContext';

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Bills', 'Shopping', 'Other'];
const FILTER_CATEGORIES = ['All', ...CATEGORIES];

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

/* ── Presentation-only primitives, shared with the Dashboard design language ── */

const PANEL = 'relative overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-md';

const CardSheen = () => (
  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent dark:via-white/[0.09]" />
);

const AmbientCanvas = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px]">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-strong/70 to-transparent" />
    <div className="absolute -top-28 left-[14%] h-72 w-72 rounded-full bg-primary/[0.06] blur-[100px] dark:bg-primary/[0.10]" />
    <div className="absolute -top-36 right-[6%] h-80 w-80 rounded-full bg-secondary/[0.05] blur-[110px] dark:bg-secondary/[0.08]" />
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

const FilterChip = ({ children }) => (
  <span className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-primary/25 bg-primary/[0.08] px-2.5 py-1 text-[11px] font-semibold text-primary">
    <span className="truncate">{children}</span>
  </span>
);

const InsightTile = ({ icon: Icon, label, value, accent = 'neutral' }) => {
  const tint = accent === 'error'
    ? 'border-error/25 bg-error/[0.08]'
    : accent === 'primary'
      ? 'border-primary/25 bg-primary/[0.08]'
      : 'border-border-subtle bg-muted/60';
  const iconColor = accent === 'error' ? 'var(--error-icon-hex)' : accent === 'primary' ? 'var(--accent-primary-hex)' : 'var(--muted-icon-hex)';
  return (
    <div className={`${PANEL} flex items-center gap-3.5 p-4`}>
      <CardSheen />
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${tint} shadow-sm`}>
        <Icon className="h-[18px] w-[18px] shrink-0" color={iconColor} strokeWidth={1.9} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</span>
        <span className="mt-1 block truncate font-display text-[19px] font-bold leading-none tracking-heading text-text-primary tabular-nums">{value}</span>
      </span>
    </div>
  );
};

const Expenses = () => {
  const { fetchNotifications } = useNotifications();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    category: 'All',
    startDate: '',
    endDate: ''
  });
  const [formData, setFormData] = useState({
    category: 'Food',
    customCategory: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openActionId, setOpenActionId] = useState(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await expenseService.getExpenses();
      const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setExpenses(sorted);
    } catch (err) {
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const normalizedSearch = filters.search.trim().toLocaleLowerCase();
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = !normalizedSearch
      || (expense.description || '').toLocaleLowerCase().includes(normalizedSearch)
      || (expense.category || '').toLocaleLowerCase().includes(normalizedSearch);
    const matchesCategory = filters.category === 'All' || expense.category === filters.category;
    const matchesStartDate = !filters.startDate || new Date(expense.date) >= new Date(filters.startDate);
    const matchesEndDate = !filters.endDate || new Date(expense.date) <= new Date(filters.endDate);
    return matchesSearch && matchesCategory && matchesStartDate && matchesEndDate;
  });

  const expenseGroups = filteredExpenses.reduce((groups, expense) => {
    const dateKey = expense.date.split('T')[0];
    const existingGroup = groups.find(group => group.dateKey === dateKey);
    if (existingGroup) {
      existingGroup.expenses.push(expense);
      existingGroup.total += Number(expense.amount);
    } else {
      groups.push({ dateKey, expenses: [expense], total: Number(expense.amount) });
    }
    return groups;
  }, []);

  /* Presentation-only ledger summary — derived from the already-filtered list,
     no extra requests and no new state. */
  const hasActiveFilters = Boolean(filters.search || filters.category !== 'All' || filters.startDate || filters.endDate);
  const filteredTotal = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const filteredAverage = filteredExpenses.length > 0 ? filteredTotal / filteredExpenses.length : 0;
  const largestExpense = filteredExpenses.reduce(
    (largest, expense) => (Number(expense.amount || 0) > Number(largest?.amount || 0) ? expense : largest),
    null
  );

  const formatGroupDate = (dateKey) => {
    const target = new Date(`${dateKey}T00:00:00`);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (first, second) => first.getFullYear() === second.getFullYear()
      && first.getMonth() === second.getMonth()
      && first.getDate() === second.getDate();
    if (sameDay(target, today)) return 'Today';
    if (sameDay(target, yesterday)) return 'Yesterday';
    return target.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: target.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  };

  const handleAddExpense = () => {
    setEditingExpense(null);
    setFormData({
      category: 'Food',
      customCategory: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setFormError('');
    setShowModal(true);
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    const isPresetCategory = CATEGORIES.includes(expense.category);
    setFormData({
      category: isPresetCategory ? expense.category : 'Other',
      customCategory: isPresetCategory ? '' : expense.category,
      amount: expense.amount,
      description: expense.description,
      date: expense.date.split('T')[0]
    });
    setFormError('');
    setShowModal(true);
  };

  const handleDeleteExpense = (expense) => {
    setDeletingExpense(expense);
    setShowDeleteDialog(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const selectedCategory = formData.customCategory.trim() || formData.category;

    // Validation
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
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setFormError('Amount must be greater than 0');
      setSubmitting(false);
      return;
    }
    if (!formData.description.trim()) {
      setFormError('Description is required');
      setSubmitting(false);
      return;
    }
    if (!formData.date) {
      setFormError('Date is required');
      setSubmitting(false);
      return;
    }

    try {
      const expenseData = {
        category: selectedCategory,
        amount: parseFloat(formData.amount),
        description: formData.description.trim(),
        date: formData.date
      };

      if (editingExpense) {
        await expenseService.updateExpense(editingExpense.id, expenseData);
      } else {
        await expenseService.createExpense(expenseData);
        // Refetch notifications to update bell badge (budget alerts may be triggered)
        fetchNotifications();
      }

      setShowModal(false);
      fetchExpenses();
    } catch (err) {
      setFormError('Failed to save expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await expenseService.deleteExpense(deletingExpense.id);
      setShowDeleteDialog(false);
      setExpenses(prev => prev.filter(exp => exp.id !== deletingExpense.id));
    } catch (err) {
      setError('Failed to delete expense');
    }
  };

  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05
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
      height: 0,
      y: shouldReduceMotion ? 0 : -10,
      transition: { duration: 0.3, ease: "easeOut" }
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-canvas px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <AmbientCanvas />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className=""
        >
          <EyebrowChip>Ledger</EyebrowChip>
          <h1 className="font-display text-[27px] font-bold leading-[1.08] tracking-display text-text-primary sm:text-[33px]">Expenses</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{loading ? 'Loading your ledger…' : `${filteredExpenses.length} ${filteredExpenses.length === 1 ? 'transaction' : 'transactions'}`}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Button
            onClick={handleAddExpense}
            className="h-11 rounded-lg px-5 shadow-md ring-1 ring-inset ring-white/20 transition-[background-color,transform,box-shadow] duration-fast hover:-translate-y-0.5 hover:shadow-lg"
          >
            <Plus className="mr-2 h-4 w-4 flex-shrink-0" color="var(--primary-icon-hex)" strokeWidth={2.4} />
            Add Expense
          </Button>
        </motion.div>
      </div>

      <div className="relative z-10 mt-6 h-px w-full bg-gradient-to-r from-border-strong/70 via-border-subtle to-transparent" />

      {/* Ledger insight strip — derived entirely from the filtered ledger already in state */}
      {!loading && !error && filteredExpenses.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
          className="relative z-10 mt-6 grid gap-4 sm:grid-cols-3"
        >
          <InsightTile icon={Sigma} label={hasActiveFilters ? 'Filtered total' : 'Total spent'} value={formatCurrency(filteredTotal)} accent="primary" />
          <InsightTile icon={ArrowDownRight} label="Average transaction" value={formatCurrency(filteredAverage)} />
          <InsightTile icon={ReceiptText} label={largestExpense ? `Largest · ${largestExpense.category}` : 'Largest'} value={formatCurrency(largestExpense?.amount || 0)} accent="error" />
        </motion.div>
      ) : null}

      {/* Command bar + ledger read as one connected, low-intensity tilt surface. */}
      <TiltCard className="relative z-10 mt-6" tiltIntensity={1.25}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative overflow-hidden rounded-t-xl border border-border-subtle bg-surface shadow-md"
        >
        <CardSheen />
        <div className="relative flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-muted/70 shadow-sm">
              <Filter className="h-4 w-4 flex-shrink-0 text-text-muted" color="var(--muted-icon-hex)" strokeWidth={1.9} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Filters</span>
          </div>
          <div className="hidden h-8 w-px bg-border-subtle sm:block" />
          <div className="relative w-full sm:w-64 lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 flex-shrink-0 -translate-y-1/2" color="var(--muted-icon-hex)" />
            <Input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              aria-label="Search expenses by description or category"
              placeholder="Search description or category"
              className="h-10 bg-canvas pl-10 font-medium"
            />
          </div>
          <div className="relative">
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="h-10 cursor-pointer appearance-none rounded-md border border-border-strong bg-canvas px-3.5 pr-9 text-sm font-medium text-text-primary shadow-control outline-none transition-[border-color,box-shadow] duration-fast hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {FILTER_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <ChevronDown className="h-3.5 w-3.5 shrink-0" color="var(--muted-icon-hex)" strokeWidth={2.2} />
            </div>
          </div>
          <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-border-subtle bg-canvas/70 p-1 sm:flex sm:w-auto sm:gap-2">
            <div className="relative min-w-0">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 flex-shrink-0 -translate-y-1/2 text-text-muted" color="var(--muted-icon-hex)" />
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="h-9 w-full border-transparent bg-transparent pl-10 font-medium shadow-none sm:w-40"
              />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">to</span>
            <div className="relative min-w-0">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 flex-shrink-0 -translate-y-1/2 text-text-muted" color="var(--muted-icon-hex)" />
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="h-9 w-full border-transparent bg-transparent pl-10 font-medium shadow-none sm:w-40"
              />
            </div>
          </div>
          {(filters.search || filters.category !== 'All' || filters.startDate || filters.endDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ search: '', category: 'All', startDate: '', endDate: '' })}
              className="ml-auto rounded-lg transition-colors duration-fast"
            >
              <X className="mr-1 h-4 w-4 flex-shrink-0" color="var(--muted-icon-hex)" />
              Clear
            </Button>
          )}
        </div>

        {/* Active-filter readout — presentation only, reset stays on the Clear button */}
        {hasActiveFilters ? (
          <div className="relative flex flex-wrap items-center gap-2 border-t border-border-subtle bg-muted/40 px-4 py-2.5 sm:px-5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Active</span>
            {filters.search ? <FilterChip>“{filters.search}”</FilterChip> : null}
            {filters.category !== 'All' ? <FilterChip>{filters.category}</FilterChip> : null}
            {filters.startDate ? <FilterChip>From {filters.startDate}</FilterChip> : null}
            {filters.endDate ? <FilterChip>Until {filters.endDate}</FilterChip> : null}
            <span className="ml-auto text-[11px] font-medium tabular-nums text-text-muted">{filteredExpenses.length} of {expenses.length} shown</span>
          </div>
        ) : null}
        </motion.div>

      {loading ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="overflow-hidden rounded-b-xl border-x border-b border-border-subtle bg-surface shadow-md"
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border-subtle px-4 py-3.5 last:border-0 sm:px-5">
              <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-lg bg-muted" />
              <div className="min-w-0 flex-1 space-y-2"><div className="h-4 w-40 animate-pulse rounded bg-muted" /><div className="h-3 w-24 animate-pulse rounded-pill bg-muted" /></div>
              <div className="space-y-2 text-right"><div className="h-4 w-20 animate-pulse rounded bg-muted" /><div className="ml-auto h-3 w-14 animate-pulse rounded bg-muted" /></div>
            </div>
          ))}
        </motion.div>
      ) : error ? (
        <div className="rounded-b-xl border-x border-b border-error/25 bg-error/[0.06] px-6 py-14 text-center shadow-md">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-error/25 bg-error/[0.10] shadow-sm">
            <TriangleAlert className="h-5 w-5 shrink-0" color="var(--error-icon-hex)" strokeWidth={1.9} />
          </div>
          <p className="mb-5 text-sm font-semibold text-error">{error}</p>
          <Button onClick={fetchExpenses} variant="outline" className="rounded-lg">Retry</Button>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-b-xl border-x border-b border-border-subtle bg-surface px-6 py-16 text-center shadow-md"
        >
          <div className="pointer-events-none absolute left-1/2 top-4 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/[0.10]" />
          <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.14] to-primary/[0.02] shadow-sm">
            <ShoppingCart className="h-7 w-7 flex-shrink-0 text-primary dark:text-text-secondary" color="var(--icon-badge-foreground-hex)" strokeWidth={1.7} />
          </div>
          <h3 className="relative mb-2 font-display text-lg font-bold tracking-heading text-text-primary">No expenses found</h3>
          <p className="relative mx-auto mb-6 max-w-sm text-sm leading-relaxed text-text-muted">
            {filters.search || filters.category !== 'All' || filters.startDate || filters.endDate
              ? 'Try adjusting your filters or add a new expense.'
              : 'Start tracking your expenses by adding your first one.'}
          </p>
          <Button
            onClick={handleAddExpense}
            className="relative h-11 rounded-lg px-5 shadow-md ring-1 ring-inset ring-white/20"
          >
            <Plus className="mr-2 h-4 w-4 flex-shrink-0" color="var(--primary-icon-hex)" strokeWidth={2.4} />
            Add Your First Expense
          </Button>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          className="overflow-visible rounded-b-xl border-x border-b border-border-subtle bg-surface shadow-md"
        >
          <AnimatePresence>
            {expenseGroups.map((group) => (
              <section key={group.dateKey} className="border-b border-border-subtle last:border-0">
                <div className="relative flex items-center justify-between gap-3 border-l-2 border-primary/50 bg-gradient-to-r from-muted/70 to-muted/30 px-4 py-2 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-primary">{formatGroupDate(group.dateKey)}</h2>
                    <span className="rounded-pill border border-border-subtle bg-surface px-2 py-0.5 text-[10px] font-semibold tabular-nums text-text-muted">{group.expenses.length} {group.expenses.length === 1 ? 'transaction' : 'transactions'}</span>
                  </div>
                  <span className="shrink-0 font-display text-xs font-bold tabular-nums text-text-secondary">−{formatCurrency(group.total)}</span>
                </div>
                {group.expenses.map((expense) => {
                  const Icon = getCategoryIcon(expense.category);
                  const menuOpen = openActionId === expense.id;
                  return (
                    <motion.div key={expense.id} variants={itemVariants} exit="exit" layout className="group relative flex min-h-14 items-center gap-3 border-t border-border-subtle px-4 py-2.5 transition-colors duration-fast first:border-t-0 hover:bg-hover focus-within:bg-hover sm:px-5">
                      <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-primary/70 transition-transform duration-base ease-standard group-hover:scale-y-100" aria-hidden="true" />
                      <motion.div whileHover={shouldReduceMotion ? {} : { scale: 1.06 }} className={`iso-icon-container flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg shadow-sm ${getCategoryColor(expense.category)}`}>
                        <Icon className="iso-icon h-[17px] w-[17px] flex-shrink-0" color="var(--icon-badge-foreground-hex)" />
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold tracking-[-0.005em] text-text-primary">{expense.description}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${getCategoryColor(expense.category)}`} aria-hidden="true" />
                          {expense.category}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right"><p className="font-display text-sm font-bold tabular-nums text-text-primary">−{formatCurrency(expense.amount)}</p><p className="mt-0.5 text-[11px] font-medium tabular-nums text-text-muted">{formatDate(expense.date)}</p></div>
                      <div className="relative flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => setOpenActionId(menuOpen ? null : expense.id)} aria-label={`Actions for ${expense.description}`} aria-expanded={menuOpen} className="h-9 w-9 rounded-lg text-text-muted opacity-70 transition-opacity hover:bg-hover hover:text-text-primary hover:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
                          <Ellipsis className="h-4 w-4 flex-shrink-0" color="var(--muted-icon-hex)" />
                        </Button>
                        <AnimatePresence>{menuOpen ? <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 top-full z-20 mt-1.5 w-40 overflow-hidden rounded-xl border border-border-strong/70 bg-elevated/95 p-1.5 shadow-xl backdrop-blur-md">
                          <button type="button" onClick={() => { setOpenActionId(null); handleEditExpense(expense); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-text-secondary transition-colors duration-fast hover:bg-hover hover:text-text-primary"><Pencil className="h-4 w-4 flex-shrink-0" color="var(--accent-primary-hex)" />Edit</button>
                          <button type="button" onClick={() => { setOpenActionId(null); handleDeleteExpense(expense); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-error transition-colors duration-fast hover:bg-error/10"><Trash2 className="h-4 w-4 flex-shrink-0" color="var(--error-icon-hex)" />Delete</button>
                        </motion.div> : null}</AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </section>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      </TiltCard>

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
                    <ReceiptText className="h-[18px] w-[18px] shrink-0" color="var(--accent-primary-hex)" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold tracking-heading text-text-primary">
                      {editingExpense ? 'Edit Expense' : 'Add Expense'}
                    </h2>
                    <p className="mt-0.5 text-xs text-text-muted">{editingExpense ? 'Update this transaction' : 'Record a new transaction'}</p>
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
                {/* Amount takes the visual lead — it is the number that matters most. */}
                <div className="rounded-xl border border-border-subtle bg-surface/70 p-4 shadow-control">
                  <label htmlFor="expense-amount" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    Amount
                  </label>
                  <div className="relative">
                    <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-lg font-bold text-text-muted">₹</span>
                    <Input
                      id="expense-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
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
                      <label htmlFor="expense-category" className="mb-1.5 block text-xs font-semibold text-text-secondary">
                        Category preset
                      </label>
                      <div className="relative">
                        <select
                          id="expense-category"
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
                      <label htmlFor="expense-custom-category" className="mb-1.5 block text-xs font-semibold text-text-secondary">
                        Custom category <span className="font-normal text-text-muted">(optional)</span>
                      </label>
                      <Input
                        id="expense-custom-category"
                        type="text"
                        maxLength={100}
                        value={formData.customCategory}
                        onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                        placeholder="e.g. Healthcare"
                        aria-describedby="expense-category-help"
                        className="h-11 bg-canvas"
                      />
                    </div>
                    <p id="expense-category-help" className="text-xs leading-5 text-text-muted sm:col-span-2">A custom name overrides the preset and uses the neutral Other icon treatment.</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="expense-description" className="mb-1.5 block text-xs font-semibold text-text-secondary">
                    Description
                  </label>
                  <Input
                    id="expense-description"
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter description"
                    required
                    className="h-11 bg-canvas"
                  />
                </div>

                <div>
                  <label htmlFor="expense-date" className="mb-1.5 block text-xs font-semibold text-text-secondary">
                    Date
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" color="var(--muted-icon-hex)" />
                    <Input
                      id="expense-date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      className="h-11 bg-canvas pl-10"
                    />
                  </div>
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
                    {submitting ? 'Saving...' : editingExpense ? 'Update' : 'Add'}
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
                <h3 className="mb-2 font-display text-lg font-bold tracking-heading text-text-primary">Delete Expense?</h3>
                <p className="mb-6 text-sm leading-relaxed text-text-muted">
                  Are you sure you want to delete "{deletingExpense?.description}"? This action cannot be undone.
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

export default Expenses;
