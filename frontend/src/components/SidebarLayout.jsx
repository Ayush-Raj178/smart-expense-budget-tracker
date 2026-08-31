import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellRing, BellRing as Bell, Check, ChevronDown, CreditCard, Gauge, LifeBuoy, LogOut, Menu, Moon, PiggyBank, ReceiptText, Sun, UserRoundPen, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useTheme } from '@/context/ThemeContext';
import { getNotificationPresentation } from '@/utils/notificationPresentation';
import ProfileUtilityModals from '@/components/ProfileUtilityModals';

const navItems = [
  { id: 'dashboard', icon: Gauge, label: 'Dashboard', path: '/dashboard' },
  { id: 'expenses', icon: ReceiptText, label: 'Expenses', path: '/expenses' },
  { id: 'budgets', icon: PiggyBank, label: 'Budgets', path: '/budgets' },
];

const menuMotion = {
  initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18, ease: [0.2, 0, 0, 1] },
};

const formatRelativeTime = (value) => {
  if (!value) return '';
  const utc = value.endsWith('Z') ? value : `${value}Z`;
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(utc).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
};

const getInitials = (name) => {
  const parts = (name || 'User').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';
};

/* Section label used to group the profile menu without adding chrome. */
const MenuGroupLabel = ({ children }) => (
  <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{children}</p>
);

const SidebarLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profilePanel, setProfilePanel] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    const closeMenus = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setNotificationOpen(false);
    };
    document.addEventListener('mousedown', closeMenus);
    return () => document.removeEventListener('mousedown', closeMenus);
  }, []);

  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  const navigateTo = (path) => { navigate(path); setMobileNavOpen(false); };
  const activeNav = navItems.find(item => item.path === location.pathname)?.id;
  const filteredNotifications = activeTab === 'unread' ? notifications.filter(item => !item.read) : notifications;
  const previewNotifications = filteredNotifications.slice(0, 5);
  const userInitials = getInitials(user?.name);

  /* Profile completeness, read straight off the signed-in user already in context. */
  const profileFields = [
    { label: 'Name', done: Boolean(user?.name) },
    { label: 'Email', done: Boolean(user?.email) },
    { label: 'Phone', done: Boolean(user?.phoneNumber) },
  ];
  const completedProfileFields = profileFields.filter(field => field.done).length;
  const profileCompletion = Math.round((completedProfileFields / profileFields.length) * 100);

  const openNotification = async (notification) => {
    if (!notification.read) await markAsRead(notification.id);
    setNotificationOpen(false);
    navigate('/notifications');
  };

  const openProfilePanel = (panel) => {
    setProfileOpen(false);
    setProfilePanel(panel);
  };

  const sidebar = (
    <div className="relative flex h-full flex-col bg-surface">
      <div aria-hidden="true" className="pointer-events-none absolute -left-10 top-24 h-64 w-40 rounded-full bg-primary/[0.05] blur-[70px] dark:bg-primary/[0.10]" />
      <div className="relative flex h-16 items-center justify-between border-b border-border-subtle px-5">
        <button onClick={() => navigateTo('/dashboard')} className="flex items-center gap-3 rounded-lg p-1 text-left transition-colors duration-fast hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-solid text-sm font-bold tracking-heading text-text-on-accent shadow-md ring-1 ring-inset ring-white/25 dark:bg-gradient-to-br dark:from-primary/[0.22] dark:to-primary/[0.06] dark:text-primary dark:ring-primary/30">SB</span>
          <span><span className="block font-display text-[15px] font-bold tracking-heading text-text-primary">SmartBudget</span><span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Expense tracker</span></span>
        </button>
        <button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" className="rounded-lg p-2 text-text-muted transition-colors duration-fast hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"><X className="h-5 w-5 shrink-0" color="var(--muted-icon-hex)" /></button>
      </div>
      <nav className="relative flex-1 space-y-1 px-3 py-5" aria-label="Primary navigation">
        <div className="mb-3 flex items-center gap-2 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Workspace</p>
          <span className="h-px flex-1 bg-gradient-to-r from-border-subtle to-transparent" />
        </div>
        {navItems.map(({ id, icon: Icon, label, path }) => {
          const active = activeNav === id;
          return <button key={id} onClick={() => navigateTo(path)} aria-current={active ? 'page' : undefined} className={`relative flex h-11 w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-0 text-sm transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${active ? 'bg-gradient-to-r from-primary/[0.13] to-primary/[0.02] font-semibold text-primary shadow-sm ring-1 ring-inset ring-primary/20' : 'font-medium text-text-secondary hover:bg-hover hover:text-text-primary'}`}>
            {active ? <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-pill bg-gradient-to-b from-primary via-primary/70 to-primary/20" /> : null}
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors duration-fast ${active ? 'border border-primary/25 bg-primary/[0.10]' : 'border border-transparent group-hover:border-border-subtle'}`}>
              <Icon className="h-[17px] w-[17px] shrink-0" color={active ? 'var(--accent-primary-hex)' : 'var(--muted-icon-hex)'} strokeWidth={1.9} />
            </span>
            <span className="truncate">{label}</span>{active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgb(var(--accent-primary)/0.6)]" /> : null}
          </button>;
        })}
      </nav>
      <div className="relative border-t border-border-subtle p-3">
        <div className="relative mb-2 flex items-center gap-3 overflow-hidden rounded-xl border border-border-subtle bg-gradient-to-br from-muted/80 to-muted/30 p-3 shadow-sm">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent dark:via-white/[0.09]" />
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/25 bg-gradient-to-br from-primary/[0.16] to-primary/[0.03] font-display text-xs font-bold tracking-heading text-primary shadow-sm">{userInitials}</span>
          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-text-primary">{user?.name || 'User'}</span><span className="block truncate text-[11px] text-text-muted">{user?.email || 'Personal workspace'}</span></span>
        </div>
        <button onClick={logout} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 py-0 text-sm font-semibold text-error transition-colors duration-fast hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"><LogOut className="h-[17px] w-[17px] shrink-0" color="var(--error-icon-hex)" strokeWidth={1.9} />Sign out</button>
      </div>
    </div>
  );

  return <div className="app-shell min-h-screen bg-canvas text-text-primary">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border-subtle lg:block">{sidebar}</aside>
    <AnimatePresence>{mobileNavOpen ? <>
      <motion.button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-canvas/75 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNavOpen(false)} />
      <motion.aside className="fixed inset-y-0 left-0 z-50 w-[min(19rem,86vw)] border-r border-border-subtle shadow-xl lg:hidden" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.26, ease: [0.2, 0, 0, 1] }}>{sidebar}</motion.aside>
    </> : null}</AnimatePresence>

    <div className="min-h-screen lg:pl-64">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border-subtle bg-surface/85 px-4 backdrop-blur-xl sm:px-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border-strong/50 to-transparent" />
        <button onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" className="grid h-10 w-10 place-items-center rounded-lg p-0 text-text-secondary transition-colors duration-fast hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"><Menu className="h-5 w-5 shrink-0" color="var(--muted-icon-hex)" /></button>
        <div className="relative ml-auto flex items-center gap-2">
          <div className="relative" ref={notificationRef}>
            <button onClick={() => { setNotificationOpen(open => !open); setProfileOpen(false); }} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={notificationOpen} className={`relative grid h-10 w-10 place-items-center rounded-lg border border-solid p-0 text-text-secondary shadow-control transition-colors duration-fast hover:border-primary/40 hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${notificationOpen ? 'border-primary/45 bg-hover' : 'border-border-strong bg-surface'}`}><BellRing className="h-[18px] w-[18px] shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} />{unreadCount ? <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-error px-1 font-display text-[10px] font-bold tabular-nums text-text-on-accent shadow-sm ring-2 ring-surface">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}</button>
            <AnimatePresence>{notificationOpen ? <motion.div {...menuMotion} className="absolute right-0 top-full mt-2.5 w-[min(23.75rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-strong/70 bg-elevated shadow-xl ring-1 ring-inset ring-border-subtle/40 backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="relative flex items-center gap-3 border-b border-border-subtle px-4 py-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/25 bg-gradient-to-br from-primary/[0.16] to-primary/[0.03] shadow-sm"><BellRing className="h-4 w-4 shrink-0" color="var(--accent-primary-hex)" strokeWidth={1.9} /></span>
                <div className="min-w-0"><p className="font-display text-sm font-bold tracking-heading text-text-primary">Activity</p><p className="mt-0.5 text-[11px] text-text-muted">{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</p></div>
              </div>
              <div className="flex items-center justify-between border-b border-border-subtle bg-muted/30 px-4 py-2"><div className="flex gap-1 rounded-lg border border-border-subtle bg-surface p-1">{['all', 'unread'].map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-md px-3 py-1 text-[11px] font-semibold capitalize transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${activeTab === tab ? 'bg-elevated text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}>{tab}</button>)}</div>{unreadCount ? <button onClick={markAllAsRead} className="rounded-md p-0 text-[11px] font-semibold text-primary transition-colors duration-fast hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Mark all read</button> : null}</div>
              <div className="max-h-80 overflow-y-auto">{previewNotifications.length === 0 ? <div className="px-5 py-10 text-center"><span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-border-subtle bg-muted/60 shadow-sm"><Bell className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} /></span><p className="text-sm font-semibold text-text-primary">No notifications here</p><p className="mt-1 text-xs text-text-muted">Budget alerts will appear in this list.</p></div> : previewNotifications.map(notification => {
                const presentation = getNotificationPresentation(notification);
                const NotificationCategoryIcon = presentation.Icon;
                const isAlert = presentation.severity === 'alert';
                return <button key={notification.id} onClick={() => openNotification(notification)} className={`relative flex w-full gap-3 border-b border-solid border-border-subtle px-4 py-3 text-left transition-colors duration-fast last:border-b-0 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${notification.read ? '' : 'bg-gradient-to-r from-primary/[0.05] to-transparent dark:from-primary/[0.08]'}`}><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${isAlert ? 'bg-gradient-to-b from-error/70 via-error/40 to-transparent' : 'bg-gradient-to-b from-warning/70 via-warning/40 to-transparent'}`} /><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-sm ${isAlert ? 'border border-error/25 bg-gradient-to-br from-error/[0.16] to-error/[0.04]' : 'border border-warning/25 bg-gradient-to-br from-warning/[0.16] to-warning/[0.04]'}`}><NotificationCategoryIcon className="h-4 w-4 shrink-0" color={isAlert ? 'var(--error-icon-hex)' : 'var(--warning-icon-hex)'} strokeWidth={1.9} /></span><span className="min-w-0 flex-1"><span className={`block truncate text-[10px] font-bold uppercase tracking-[0.14em] ${isAlert ? 'text-error' : 'text-warning'}`}>{presentation.category} budget</span><span className={`mt-0.5 block truncate text-sm text-text-primary ${notification.read ? 'font-medium' : 'font-semibold'}`}>{presentation.title}</span><span className="mt-0.5 block truncate text-xs text-text-secondary">{presentation.detail} · {presentation.usageLabel}</span><span className="mt-1 block text-[10px] font-medium tabular-nums text-text-muted">{formatRelativeTime(notification.createdAt)}</span></span>{!notification.read ? <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /> : null}</button>;
              })}</div>
              <button onClick={() => { setNotificationOpen(false); navigate('/notifications'); }} className="w-full border-t border-solid border-border-subtle bg-muted/25 px-4 py-3 text-center text-xs font-semibold text-primary transition-colors duration-fast hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">View all notifications</button>
            </motion.div> : null}</AnimatePresence>
          </div>

          <div className="relative" ref={profileRef}>
            <button onClick={() => { setProfileOpen(open => !open); setNotificationOpen(false); }} aria-label="Open profile menu" aria-expanded={profileOpen} className={`flex h-10 items-center gap-2 rounded-lg border border-solid px-1.5 py-0 transition-colors duration-fast hover:border-border-subtle hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-2 ${profileOpen ? 'border-border-subtle bg-hover' : 'border-transparent'}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary/25 bg-gradient-to-br from-primary/[0.16] to-primary/[0.03] font-display text-[11px] font-bold tracking-heading text-primary shadow-sm">{userInitials}</span><span className="hidden max-w-32 truncate text-sm font-semibold text-text-primary md:block">{user?.name || 'User'}</span><ChevronDown className={`hidden h-4 w-4 shrink-0 transition-transform duration-fast md:block ${profileOpen ? 'rotate-180' : ''}`} color="var(--muted-icon-hex)" /></button>
            <AnimatePresence>{profileOpen ? <motion.div {...menuMotion} className="absolute right-0 top-full mt-2.5 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-strong/70 bg-elevated shadow-xl ring-1 ring-inset ring-border-subtle/40 backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-primary/[0.07] blur-3xl dark:bg-primary/[0.12]" />

              <div className="relative border-b border-border-subtle px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.18] to-primary/[0.03] font-display text-xs font-bold tracking-heading text-primary shadow-md">{userInitials}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-display text-sm font-bold tracking-heading text-text-primary">{user?.name || 'User'}</span><span className="mt-0.5 block truncate text-xs text-text-secondary">{user?.email || ''}</span></span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-pill border border-border-subtle bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Personal workspace</span>
                </div>

                {/* Profile completeness — computed from the fields already on the account. */}
                <div className="mt-2.5 rounded-lg border border-border-subtle bg-surface p-2.5 shadow-control">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Profile completion</p>
                    <span className="font-display text-[11px] font-bold tabular-nums text-text-primary">{profileCompletion}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-muted shadow-control">
                    <div className="h-full rounded-pill bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-slow ease-standard" style={{ width: `${profileCompletion}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {profileFields.map(field => (
                      <span key={field.label} className={`inline-flex items-center gap-1 rounded-pill border px-1.5 py-0.5 text-[10px] font-semibold ${field.done ? 'border-success/25 bg-success/[0.10] text-success' : 'border-border-subtle bg-muted/60 text-text-muted'}`}>
                        {field.done ? <Check className="h-2.5 w-2.5 shrink-0" color="var(--success-icon-hex)" strokeWidth={3} /> : <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full border border-border-strong" />}
                        {field.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative p-2">
                <MenuGroupLabel>Account</MenuGroupLabel>
                <button onClick={() => openProfilePanel('edit-profile')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-fast hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-subtle bg-muted/70 shadow-sm"><UserRoundPen className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">Edit profile</span><span className="mt-0.5 block text-xs text-text-muted">Name, email, and phone</span></span>
                  <ChevronDown className="h-4 w-4 shrink-0 -rotate-90" color="var(--muted-icon-hex)" />
                </button>
                <button onClick={() => { setProfileOpen(false); navigate('/notifications'); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-fast hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-subtle bg-muted/70 shadow-sm"><BellRing className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">Notifications</span><span className="mt-0.5 block text-xs text-text-muted">Review budget alerts</span></span>
                  {unreadCount ? <span className="rounded-pill border border-primary/25 bg-primary/[0.10] px-2 py-0.5 font-display text-[11px] font-bold tabular-nums text-primary">{unreadCount}</span> : <ChevronDown className="h-4 w-4 shrink-0 -rotate-90" color="var(--muted-icon-hex)" />}
                </button>

                <MenuGroupLabel>Preferences</MenuGroupLabel>
                <button onClick={toggleTheme} aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`} aria-pressed={isDark} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-fast hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-subtle bg-muted/70 shadow-sm">{isDark ? <Moon className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} /> : <Sun className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} />}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">Appearance</span><span className="mt-0.5 block text-xs text-text-muted">{isDark ? 'Dark theme' : 'Light theme'}</span></span>
                  <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-pill border transition-colors duration-fast ${isDark ? 'border-primary bg-primary shadow-[0_0_10px_rgb(var(--accent-primary)/0.45)]' : 'border-border-strong bg-muted'}`}><span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-elevated shadow-sm transition-transform duration-fast ${isDark ? 'translate-x-[17px]' : 'translate-x-0.5'}`} /></span>
                </button>

                <MenuGroupLabel>Help &amp; plan</MenuGroupLabel>
                <button onClick={() => openProfilePanel('support')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-fast hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-subtle bg-muted/70 shadow-sm"><LifeBuoy className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">Support</span><span className="mt-0.5 block text-xs text-text-muted">Help and product guidance</span></span>
                  <ChevronDown className="h-4 w-4 shrink-0 -rotate-90" color="var(--muted-icon-hex)" />
                </button>
                {/* Non-interactive on purpose: no billing backend exists, so this is a
                    clearly-labelled visual placeholder rather than a dead button. */}
                <div aria-disabled="true" className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-left opacity-65">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-subtle bg-muted/50"><CreditCard className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">Plan &amp; billing</span><span className="mt-0.5 block text-xs text-text-muted">Not connected to a billing service</span></span>
                  <span className="rounded-pill border border-border-subtle bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">Soon</span>
                </div>
              </div>
              <div className="relative border-t border-border-subtle bg-muted/25 p-1.5"><button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-error transition-colors duration-fast hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-error/40"><LogOut className="h-4 w-4 shrink-0" color="var(--error-icon-hex)" strokeWidth={1.9} />Sign out</button></div>
            </motion.div> : null}</AnimatePresence>
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
    </div>
    <ProfileUtilityModals activePanel={profilePanel} onClose={() => setProfilePanel(null)} user={user} />
  </div>;
};

export default SidebarLayout;
