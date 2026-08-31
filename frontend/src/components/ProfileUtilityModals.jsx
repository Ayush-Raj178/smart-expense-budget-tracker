import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpenText, CheckCircle2, Info, KeyRound, LifeBuoy, Mail, MessageCircleMore, Phone, TriangleAlert, UserRoundPen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useFeatureFlags } from '@/context/FeatureFlagsContext';
import { authService } from '@/services/authService';

const dialogMotion = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 6 },
  transition: { duration: 0.18, ease: [0.2, 0, 0, 1] },
};

const getApiMessage = (error, fallback) => error.response?.data?.message || fallback;

const FieldLabel = ({ htmlFor, children, hint }) => (
  <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3 text-xs font-semibold text-text-secondary">
    <span>{children}</span>
    {hint ? <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">{hint}</span> : null}
  </label>
);

const ProfileUtilityModals = ({ activePanel, onClose, user }) => {
  const { login, updateUser } = useAuth();
  const { otpVerificationEnabled, loading: featureFlagsLoading } = useFeatureFlags();
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' });
  const [phase, setPhase] = useState('details');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (activePanel === 'edit-profile') {
      setDraft({ name: user?.name || '', email: user?.email || '', phone: user?.phoneNumber || '' });
      setPhase('details');
      setOtp('');
      setCooldown(0);
      setError('');
      setStatus('');
    }
  }, [activePanel, user?.email, user?.name, user?.phoneNumber]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    setLoading(true);
    const newEmail = draft.email.trim().toLowerCase();
    const emailChanged = otpVerificationEnabled && !featureFlagsLoading
      && newEmail !== (user?.email || '').trim().toLowerCase();
    let profileSaved = false;
    try {
      const updated = await authService.updateProfile({ name: draft.name, phoneNumber: draft.phone.trim() || null });
      updateUser(updated);
      profileSaved = true;
      if (emailChanged) {
        const response = await authService.requestEmailChange(newEmail);
        setCooldown(response.resendAvailableInSeconds || 60);
        setPhase('email-otp');
        setStatus(`Name and phone saved. We sent a verification code to ${response.email || newEmail}.`);
      } else {
        setStatus('Your profile was updated successfully.');
      }
    } catch (requestError) {
      const message = getApiMessage(requestError, "We couldn't send a verification code to this email address — please check it's correct.");
      setError(profileSaved ? `Name and phone were saved, but the email change could not start: ${message}` : message);
      const retryAfter = Number(requestError.response?.headers?.['retry-after']);
      if (retryAfter > 0) setCooldown(retryAfter);
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authService.verifyEmailChange(draft.email.trim().toLowerCase(), otp);
      login(response.token, response.user);
      setDraft(current => ({ ...current, email: response.user.email }));
      setPhase('details');
      setOtp('');
      setStatus('Your new email is verified and active.');
    } catch (verificationError) {
      setError(getApiMessage(verificationError, 'We could not verify that code.'));
    } finally {
      setLoading(false);
    }
  };

  const resendEmailCode = async () => {
    if (loading || cooldown > 0) return;
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const response = await authService.requestEmailChange(draft.email.trim().toLowerCase());
      setCooldown(response.resendAvailableInSeconds || 60);
      setStatus('A new verification code is on its way.');
    } catch (resendError) {
      setError(getApiMessage(resendError, "We couldn't resend the verification code. Please check the email address and try again."));
      const retryAfter = Number(resendError.response?.headers?.['retry-after']);
      if (retryAfter > 0) setCooldown(retryAfter);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {activePanel ? (
        <motion.div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-canvas/80 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.section {...dialogMotion} role="dialog" aria-modal="true" aria-labelledby={`${activePanel}-title`} className="relative my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-border-strong/60 bg-elevated shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-60 w-60 rounded-full bg-primary/[0.08] blur-3xl dark:bg-primary/[0.13]" />

            <header className="relative flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.16] to-primary/[0.03] shadow-sm">
                  {activePanel === 'edit-profile' ? <UserRoundPen className="h-[19px] w-[19px] shrink-0" color="var(--accent-primary-hex)" strokeWidth={1.9} /> : <LifeBuoy className="h-[19px] w-[19px] shrink-0" color="var(--accent-primary-hex)" strokeWidth={1.9} />}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id={`${activePanel}-title`} className="font-display text-lg font-bold tracking-heading text-text-primary">{activePanel === 'edit-profile' ? 'Account settings' : 'Support'}</h2>
                    {activePanel === 'support' ? <span className="rounded-pill border border-border-subtle bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">UI preview</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{activePanel === 'edit-profile' ? (phase === 'email-otp' ? 'Confirm your new email address' : 'Profile and contact information') : 'Help resources and product guidance'}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog" className="h-9 w-9 shrink-0 rounded-lg hover:bg-hover"><X className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" /></Button>
            </header>

            {activePanel === 'edit-profile' ? (
              phase === 'details' ? (
                <form onSubmit={handleProfileSubmit} className="relative space-y-5 p-5 sm:p-6">
                  <div className="space-y-4 rounded-xl border border-border-subtle bg-surface/70 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Identity</p>
                    <div><FieldLabel htmlFor="profile-name">Name</FieldLabel><div className="relative"><UserRoundPen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" color="var(--muted-icon-hex)" /><Input id="profile-name" value={draft.name} onChange={(event) => setDraft(current => ({ ...current, name: event.target.value }))} autoComplete="name" className="h-11 bg-canvas pl-10 font-medium" required maxLength={100} /></div></div>
                    <div><FieldLabel htmlFor="profile-email" hint={otpVerificationEnabled && !featureFlagsLoading ? 'Verified change' : 'Demo mode'}>Email</FieldLabel><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" color="var(--muted-icon-hex)" /><Input id="profile-email" type="email" value={draft.email} onChange={(event) => setDraft(current => ({ ...current, email: event.target.value }))} autoComplete="email" className="h-11 bg-canvas pl-10 font-medium" required maxLength={254} disabled={!otpVerificationEnabled || featureFlagsLoading} /></div><p className="mt-1.5 text-xs leading-5 text-text-muted">{otpVerificationEnabled && !featureFlagsLoading ? 'A change is applied only after you verify a code sent to the new address.' : featureFlagsLoading ? 'Checking whether email verification is available.' : 'Email changes are currently unavailable in this demo deployment. Contact the app owner if you need help.'}</p></div>
                    <div><FieldLabel htmlFor="profile-phone" hint="Optional">Phone number</FieldLabel><div className="relative"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" color="var(--muted-icon-hex)" /><Input id="profile-phone" type="tel" value={draft.phone} onChange={(event) => setDraft(current => ({ ...current, phone: event.target.value }))} autoComplete="tel" placeholder="Add a phone number" className="h-11 bg-canvas pl-10 font-medium" maxLength={30} /></div><p className="mt-1.5 text-xs leading-5 text-text-muted">Phone changes save directly. SMS verification is not available yet.</p></div>
                  </div>
                  {status ? <p role="status" className="relative flex gap-2.5 overflow-hidden rounded-xl border border-success/25 bg-success/[0.08] px-4 py-3 text-xs leading-5 text-text-secondary"><span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-success/70" /><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" color="var(--success-icon-hex)" strokeWidth={2} />{status}</p> : null}
                  {error ? <p role="alert" className="relative flex gap-2.5 overflow-hidden rounded-xl border border-error/25 bg-error/[0.09] px-4 py-3 text-xs leading-5 text-error"><span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-error/70" /><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" color="var(--error-icon-hex)" strokeWidth={2.1} />{error}</p> : null}
                  <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-lg">Cancel</Button><Button type="submit" disabled={loading} className="h-11 rounded-lg px-5 shadow-md ring-1 ring-inset ring-white/20">{loading ? 'Saving…' : 'Save changes'}</Button></div>
                </form>
              ) : (
                <form onSubmit={verifyEmail} className="relative space-y-5 p-5 sm:p-6">
                  {/* Two-step progress: the details step is already saved at this point. */}
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-pill border border-success/25 bg-success/[0.10] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-success"><CheckCircle2 className="h-3 w-3 shrink-0" color="var(--success-icon-hex)" strokeWidth={2.4} />Details saved</span>
                    <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-border-strong to-border-subtle" />
                    <span className="inline-flex items-center gap-1.5 rounded-pill border border-primary/25 bg-primary/[0.10] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Verify email</span>
                  </div>
                  <div className="flex gap-3 rounded-xl border border-info/20 bg-info/[0.07] px-4 py-3.5"><KeyRound className="mt-0.5 h-4 w-4 shrink-0" color="var(--accent-primary-hex)" strokeWidth={2} /><p className="text-xs leading-5 text-text-secondary">Enter the 6-digit code sent to <span className="font-semibold text-text-primary">{draft.email.trim().toLowerCase()}</span>. Your current email remains active until verification succeeds.</p></div>
                  <div className="rounded-xl border border-border-subtle bg-surface/70 p-4 shadow-control"><label htmlFor="profile-email-otp" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Verification code</label><Input id="profile-email-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="h-16 bg-canvas text-center font-mono text-2xl font-bold tracking-[0.35em] tabular-nums" required minLength={6} maxLength={6} /></div>
                  {status ? <p role="status" className="relative overflow-hidden rounded-xl border border-success/25 bg-success/[0.08] px-4 py-3 text-xs leading-5 text-text-secondary"><span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-success/70" />{status}</p> : null}
                  {error ? <p role="alert" className="relative overflow-hidden rounded-xl border border-error/25 bg-error/[0.09] px-4 py-3 text-xs leading-5 text-error"><span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-error/70" />{error}</p> : null}
                  <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-5"><button type="button" onClick={resendEmailCode} disabled={loading || cooldown > 0} className="rounded-md text-xs font-semibold text-primary transition-colors duration-fast enabled:hover:text-primary-hover disabled:cursor-not-allowed disabled:text-text-muted">{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button><div className="flex gap-3"><Button type="button" variant="outline" onClick={() => { setPhase('details'); setOtp(''); setError(''); }} className="h-11 rounded-lg">Back</Button><Button type="submit" disabled={loading || otp.length !== 6} className="h-11 rounded-lg px-5 shadow-md ring-1 ring-inset ring-white/20">{loading ? 'Verifying…' : 'Verify email'}</Button></div></div>
                </form>
              )
            ) : (
              <div className="relative p-5 sm:p-6">
                <div className="flex gap-3 rounded-xl border border-info/20 bg-info/[0.07] px-4 py-3.5"><Info className="mt-0.5 h-4 w-4 shrink-0" color="var(--accent-primary-hex)" strokeWidth={2} /><p className="text-xs leading-5 text-text-secondary">Support destinations are still a UI preview and are not connected to a help-desk backend.</p></div>
                <div className="mt-5 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
                  <div className="pointer-events-none h-px bg-gradient-to-r from-transparent to-transparent dark:via-white/[0.09]" />
                  <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-muted/70 shadow-sm"><BookOpenText className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">Help center</span><span className="mt-0.5 block text-xs text-text-muted">Guides for budgets, expenses, and alerts</span></span><span className="shrink-0 rounded-pill border border-border-subtle bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">Coming soon</span></div>
                  <div className="flex items-center gap-3 px-4 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-muted/70 shadow-sm"><MessageCircleMore className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" strokeWidth={1.9} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">Contact support</span><span className="mt-0.5 block text-xs text-text-muted">Send an account or product question</span></span><span className="shrink-0 rounded-pill border border-border-subtle bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">Coming soon</span></div>
                </div>
                <div className="mt-5 flex justify-end border-t border-border-subtle pt-5"><Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-lg">Close</Button></div>
              </div>
            )}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default ProfileUtilityModals;
