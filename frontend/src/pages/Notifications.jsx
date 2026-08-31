import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Check, Lightbulb, X, Activity, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/context/NotificationContext';
import { getNotificationPresentation } from '@/utils/notificationPresentation';

const parseTimestamp = (timestamp) => new Date(timestamp?.endsWith('Z') ? timestamp : `${timestamp}Z`);

const formatTimestamp = (timestamp) => {
  const date = parseTimestamp(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const isToday = (timestamp) => {
  const date = parseTimestamp(timestamp);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
};

const CardSheen = () => (
  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent dark:via-white/[0.09]" />
);

const NotificationRow = ({ notification, onRead, onDelete }) => {
  const { Icon, category, monthLabel, severity, title, detail, usageLabel } = getNotificationPresentation(notification);
  const isAlert = severity === 'alert';
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      onClick={() => !notification.read && onRead(notification.id)}
      tabIndex={notification.read ? -1 : 0}
      onKeyDown={(event) => {
        if (!notification.read && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onRead(notification.id);
        }
      }}
      className={`group relative flex gap-3.5 border-b border-border-subtle px-4 py-3.5 transition-colors duration-fast last:border-b-0 sm:gap-4 sm:px-5 ${notification.read ? 'bg-surface hover:bg-hover' : 'cursor-pointer bg-gradient-to-r from-primary/[0.045] to-transparent hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 dark:from-primary/[0.07]'}`}
    >
      {/* Severity rail doubles as the activity-stream spine. */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${isAlert ? 'bg-gradient-to-b from-error/70 via-error/45 to-transparent' : 'bg-gradient-to-b from-warning/70 via-warning/45 to-transparent'}`} />

      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-sm ${isAlert ? 'border border-error/25 bg-gradient-to-br from-error/[0.16] to-error/[0.04]' : 'border border-warning/25 bg-gradient-to-br from-warning/[0.16] to-warning/[0.04]'}`}>
        <Icon className="h-[18px] w-[18px] shrink-0" color={isAlert ? 'var(--error-icon-hex)' : 'var(--warning-icon-hex)'} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1 sm:pr-32">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${isAlert ? 'text-error' : 'text-warning'}`}>{category} budget</p>
          <span className="h-1 w-1 rounded-full bg-border-strong" aria-hidden="true" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{monthLabel}</p>
          {!notification.read ? <span className="relative grid h-1.5 w-1.5 shrink-0 place-items-center" aria-label="Unread"><span className="absolute h-2.5 w-2.5 rounded-full bg-primary/25" /><span className="h-1.5 w-1.5 rounded-full bg-primary" /></span> : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className={`text-sm leading-5 tracking-[-0.005em] text-text-primary ${notification.read ? 'font-medium' : 'font-semibold'}`}>{title}</h3>
          <span className={`rounded-pill border px-2 py-0.5 font-display text-[10px] font-bold tabular-nums ${isAlert ? 'border-error/25 bg-error/[0.10] text-error' : 'border-warning/25 bg-warning/[0.10] text-warning'}`}>{usageLabel}</span>
        </div>
        <p className="mt-1 text-sm leading-5 text-text-secondary">{detail}</p>
        <time className="mt-2 block text-[11px] font-medium tabular-nums text-text-muted sm:hidden">{formatTimestamp(notification.createdAt)}</time>
      </div>
      <div className="flex shrink-0 items-start gap-2 sm:absolute sm:right-4 sm:top-4">
        <time className="hidden whitespace-nowrap rounded-pill border border-border-subtle bg-muted/50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-text-muted sm:block">{formatTimestamp(notification.createdAt)}</time>
        <button
          type="button"
          aria-label={`Delete ${category} budget notification`}
          onClick={(event) => { event.stopPropagation(); onDelete(notification.id); }}
          className="-mt-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-muted opacity-100 transition-[color,background-color,opacity] duration-fast hover:bg-error/10 hover:text-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30 sm:-mt-1.5 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <X className="h-4 w-4 shrink-0" style={{ color: 'currentColor' }} />
        </button>
      </div>
    </motion.article>
  );
};

const Notifications = () => {
  const { notifications, loading, error, markAsRead, deleteNotification, markAllAsRead, fetchNotifications } = useNotifications();
  const [activeTab, setActiveTab] = useState('all');
  const filtered = activeTab === 'unread' ? notifications.filter((item) => !item.read) : notifications;
  const unreadCount = notifications.filter((item) => !item.read).length;
  const groups = [
    { label: 'Today', items: filtered.filter((item) => isToday(item.createdAt)) },
    { label: 'Earlier', items: filtered.filter((item) => !isToday(item.createdAt)) },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-canvas">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-strong/70 to-transparent" />
        <div className="absolute -top-28 left-[16%] h-72 w-72 rounded-full bg-primary/[0.06] blur-[100px] dark:bg-primary/[0.10]" />
        <div className="absolute -top-32 right-[10%] h-72 w-72 rounded-full bg-secondary/[0.05] blur-[110px] dark:bg-secondary/[0.08]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-pill border border-border-subtle bg-surface/80 px-2.5 py-1 shadow-sm backdrop-blur-sm">
              <span className="relative grid h-1.5 w-1.5 place-items-center">
                <span className="absolute h-2.5 w-2.5 rounded-full bg-primary/25" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Activity center</span>
            </div>
            <h1 className="font-display text-[27px] font-bold leading-[1.08] tracking-display text-text-primary sm:text-[33px]">Notifications</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">Budget alerts and account updates that need your attention.</p>
          </div>
          {unreadCount > 0 ? <Button variant="outline" size="sm" onClick={markAllAsRead} className="h-10 self-start rounded-lg border-border-strong bg-surface/80 text-text-secondary shadow-sm backdrop-blur-sm hover:bg-hover hover:text-text-primary sm:self-auto"><Check className="mr-2 h-4 w-4 shrink-0" style={{ color: 'rgb(var(--text-secondary))' }} />Mark all as read</Button> : null}
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-border-subtle bg-surface/90 p-1 shadow-md backdrop-blur-sm" role="tablist" aria-label="Notification filter">
            {['all', 'unread'].map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${activeTab === tab ? 'bg-elevated text-text-primary shadow-sm ring-1 ring-inset ring-border-subtle' : 'text-text-muted hover:text-text-primary'}`}>{tab}{tab === 'unread' && unreadCount > 0 ? <span className="ml-1.5 rounded-pill bg-primary/[0.12] px-1.5 py-0.5 font-display tabular-nums text-primary">{unreadCount}</span> : null}</button>)}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-border-subtle bg-surface/80 px-2.5 py-1 text-[11px] font-semibold text-text-muted shadow-sm backdrop-blur-sm">
              <Activity className="h-3.5 w-3.5 shrink-0" color="var(--muted-icon-hex)" strokeWidth={2} />
              <span className="tabular-nums">{notifications.length}</span> total
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${unreadCount > 0 ? 'border-primary/25 bg-primary/[0.08] text-primary' : 'border-border-subtle bg-surface/80 text-text-muted backdrop-blur-sm'}`}>
              <span className="tabular-nums">{unreadCount}</span> unread
            </span>
          </div>
        </div>

        <section className="relative min-h-[16rem] overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-md" aria-live="polite">
          <CardSheen />
          {loading ? <div className="divide-y divide-border-subtle">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="flex animate-pulse gap-4 px-5 py-4"><div className="h-10 w-10 shrink-0 rounded-xl bg-muted" /><div className="flex-1 space-y-2"><div className="h-3 w-24 rounded-pill bg-muted" /><div className="h-3.5 w-1/3 rounded bg-muted" /><div className="h-3 w-2/3 rounded bg-muted" /></div></div>)}</div> : error ? <div className="grid min-h-[16rem] place-items-center px-6 text-center"><div><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-error/25 bg-error/[0.10] shadow-sm"><Inbox className="h-5 w-5 shrink-0" color="var(--error-icon-hex)" strokeWidth={1.9} /></div><p className="text-sm font-semibold text-error">{error}</p><Button onClick={() => fetchNotifications(true)} variant="outline" size="sm" className="mt-4 rounded-lg border-border-strong bg-surface text-text-primary hover:bg-hover">Retry</Button></div></div> : filtered.length === 0 ? (
            <div className="grid min-h-[16rem] place-items-center px-6 py-8 text-center">
              <div className="relative max-w-md">
                <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/[0.10]" />
                <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.14] to-primary/[0.02] shadow-sm">
                  <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-surface" />
                  <BellRing className="h-7 w-7 shrink-0" strokeWidth={1.7} style={{ color: 'rgb(var(--text-secondary))' }} />
                </span>
                <h2 className="relative mt-4 font-display text-lg font-bold tracking-heading text-text-primary">{activeTab === 'unread' ? "You're all caught up" : 'No notifications yet'}</h2>
                <p className="relative mt-2 text-sm leading-6 text-text-secondary">{activeTab === 'unread' ? 'All your notifications have been read. New alerts will appear here when they need your attention.' : 'Budget alerts and important account updates will appear here as your activity grows.'}</p>
                <div className="relative mt-4 flex items-start gap-3 rounded-xl border border-info/20 bg-info/[0.06] p-3 text-left">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} style={{ color: 'rgb(var(--status-info))' }} />
                  <p className="text-xs leading-5 text-text-secondary">Tip: You’ll receive an alert when a category approaches its monthly limit, so you can adjust before overspending.</p>
                </div>
              </div>
            </div>
          ) : <AnimatePresence initial={false}>{groups.map((group) => <section key={group.label}><div className="flex items-center justify-between gap-3 border-y border-border-subtle bg-gradient-to-r from-muted/70 to-muted/25 px-5 py-2.5 first:border-t-0"><h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-primary">{group.label}</h2><span className="rounded-pill border border-border-subtle bg-surface px-2 py-0.5 text-[10px] font-semibold tabular-nums text-text-muted">{group.items.length} {group.items.length === 1 ? 'alert' : 'alerts'}</span></div>{group.items.map((notification) => <NotificationRow key={notification.id} notification={notification} onRead={markAsRead} onDelete={deleteNotification} />)}</section>)}</AnimatePresence>}
        </section>
      </div>
    </div>
  );
};

export default Notifications;
