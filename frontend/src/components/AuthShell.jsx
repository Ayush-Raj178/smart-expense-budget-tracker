import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BarChart3, ChevronDown, Landmark } from 'lucide-react';
import TiltCard from '@/components/TiltCard';

const shellMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
};

const AuthShell = ({ children, mode }) => (
  <main className="min-h-screen bg-canvas text-text-primary lg:grid lg:grid-cols-[38%_62%]">
    <aside className="relative hidden min-h-screen overflow-hidden border-r border-border-subtle bg-surface lg:flex lg:flex-col lg:justify-between lg:px-10 lg:py-10 xl:px-14 xl:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-primary/[0.06] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-20 h-[22rem] w-[22rem] rounded-full bg-secondary/[0.05] blur-3xl" />
      <div className="relative z-10 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border-strong bg-muted">
          <Landmark className="h-5 w-5 shrink-0" style={{ color: 'rgb(var(--accent-primary))' }} />
        </span>
        <div>
          <p className="text-[15px] font-bold tracking-heading">SmartBudget</p>
          <p className="text-xs text-text-muted">Expense tracker</p>
        </div>
      </div>

      <div className="relative z-10 max-w-md pb-8">
        <p className="max-w-sm text-balance font-display text-[clamp(2rem,3.2vw,3.75rem)] font-semibold leading-[1.06] tracking-display">A clearer view of where your money goes.</p>
        <p className="mt-5 max-w-sm text-pretty text-sm leading-6 text-text-secondary">Plan with confidence, understand your spending, and keep every financial decision in view.</p>

        <div className="relative mt-10 [perspective:1200px]">
          <div aria-hidden="true" className="absolute inset-x-3 inset-y-0 translate-y-3 rounded-xl border border-border-subtle bg-muted/55" />
          <div aria-hidden="true" className="absolute inset-x-1.5 inset-y-0 translate-y-1.5 rounded-xl border border-border-subtle bg-muted/80" />
          <TiltCard tiltIntensity={3} className="relative overflow-hidden rounded-xl border border-border-strong bg-canvas shadow-lg transition-[border-color,transform] duration-base hover:border-border-strong">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <span className="text-xs font-semibold text-text-secondary">Monthly plan</span>
            <BarChart3 className="h-4 w-4 shrink-0" style={{ color: 'rgb(var(--text-muted))' }} />
          </div>
          <div className="space-y-4 p-4">
            {[
              ['Essentials', '68%', '68%'],
              ['Lifestyle', '42%', '42%'],
              ['Savings', '76%', '76%'],
            ].map(([label, value, width], index) => (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{label}</span>
                  <span className="font-medium tabular-nums text-text-primary">{value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={index === 2 ? 'h-full rounded-full bg-primary' : 'h-full rounded-full bg-border-strong'} style={{ width }} />
                </div>
              </div>
            ))}
          </div>
          </TiltCard>
        </div>
      </div>

      <p className="relative z-10 text-xs text-text-muted">Private by design · Built for everyday clarity</p>
    </aside>

    <section className="flex min-h-screen items-start justify-center px-5 py-8 sm:px-8 sm:py-12 lg:items-center lg:px-12 lg:py-16">
      <motion.div {...shellMotion} className="w-full max-w-[420px]">
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-strong bg-surface">
            <Landmark className="h-[18px] w-[18px] shrink-0" style={{ color: 'rgb(var(--accent-primary))' }} />
          </span>
          <div><p className="text-sm font-bold tracking-heading">SmartBudget</p><p className="text-[11px] text-text-muted">Expense tracker</p></div>
        </div>

        {children}

        <details className="group mt-7 border-t border-border-subtle pt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-md py-2 text-xs font-medium text-text-muted outline-none transition-colors hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/30">
            <span>Additional sign-in methods coming soon</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" style={{ color: 'rgb(var(--text-muted))' }} />
          </summary>
          <p className="pt-2 text-xs leading-5 text-text-muted">Google, Apple, and GitHub sign-in are not available yet.</p>
        </details>

        <p className="mt-7 text-center text-[11px] leading-5 text-text-muted">
          By {mode === 'signup' ? 'creating an account' : 'continuing'}, you agree to our{' '}
          <Link to="/terms" className="font-medium text-primary hover:text-primary-hover">Terms of Service</Link>{' '}and{' '}
          <Link to="/privacy" className="font-medium text-primary hover:text-primary-hover">Privacy Policy</Link>.
        </p>
      </motion.div>
    </section>
  </main>
);

export default AuthShell;
