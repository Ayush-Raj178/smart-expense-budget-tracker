import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/authService';
import { useFeatureFlags } from '@/context/FeatureFlagsContext';

const getApiMessage = (error, fallback) => error.response?.data?.message || fallback;
const GENERIC_STATUS = 'If this email is registered, a code has been sent.';

const panelMotion = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
  transition: { duration: 0.18 },
};

const ForgotPassword = () => {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const { otpVerificationEnabled, loading: featureFlagsLoading } = useFeatureFlags();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(
      () => setCooldown(value => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step !== 'success') return undefined;
    const timer = window.setTimeout(
      () => navigate('/login', {
        replace: true,
        state: {
          message: 'Your password was reset successfully. Sign in with your new password.',
          email,
          passwordReset: true,
        },
      }),
      1800,
    );
    return () => window.clearTimeout(timer);
  }, [email, navigate, step]);

  const requestCode = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await authService.forgotPassword(normalizedEmail);
      setEmail(response.email || normalizedEmail);
      setCooldown(response.resendAvailableInSeconds || 60);
      setStatus(response.message || GENERIC_STATUS);
      setStep('verify');
    } catch (requestError) {
      setError(getApiMessage(requestError, "We couldn't start password recovery. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authService.verifyPasswordResetOtp(email, otp);
      setStatus(response.message || 'Verification code confirmed');
      setStep('password');
    } catch (verificationError) {
      setError(getApiMessage(verificationError, 'That verification code is invalid or expired.'));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(email, otp, newPassword);
      setStep('success');
      setStatus('');
    } catch (resetError) {
      const message = getApiMessage(resetError, 'We could not reset your password. Please verify the code again.');
      if (resetError.response?.status === 400) {
        setStep('verify');
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setStatus('');
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (loading || cooldown > 0) return;
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const response = await authService.forgotPassword(email);
      setCooldown(response.resendAvailableInSeconds || 60);
      setStatus(response.message || GENERIC_STATUS);
      setOtp('');
      setStep('verify');
    } catch (requestError) {
      setError(getApiMessage(requestError, "We couldn't request another code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const changeEmail = () => {
    setStep('email');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setStatus('');
    setCooldown(0);
  };

  const mutedIconStyle = { color: 'rgb(var(--text-muted))' };

  if (featureFlagsLoading) {
    return (
      <AuthShell mode="login">
        <p className="text-sm text-text-secondary">Checking account recovery options…</p>
      </AuthShell>
    );
  }

  if (!otpVerificationEnabled) {
    return (
      <AuthShell mode="login">
        <motion.div {...panelMotion}>
          <Link to="/login" className="mb-7 inline-flex items-center gap-2 rounded-md p-0 text-xs font-semibold text-text-muted transition-colors duration-fast hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <ArrowLeft className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />
            Back to sign in
          </Link>
          <header>
            <span className="mb-5 grid h-11 w-11 place-items-center rounded-lg border border-border-strong bg-muted">
              <LockKeyhole className="h-5 w-5 shrink-0" color="var(--accent-primary-hex)" />
            </span>
            <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-heading text-text-primary">Password reset unavailable</h1>
            <p className="mt-2 text-sm leading-6 text-text-secondary">Password reset is currently unavailable in this demo deployment. Contact the app owner if you need help.</p>
          </header>
        </motion.div>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="login">
      <AnimatePresence mode="wait" initial={false}>
        {step === 'email' ? (
          <motion.div key="email" {...panelMotion}>
            <Link to="/login" className="mb-7 inline-flex items-center gap-2 rounded-md p-0 text-xs font-semibold text-text-muted transition-colors duration-fast hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <ArrowLeft className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />
              Back to sign in
            </Link>
            <header className="mb-7">
              <span className="mb-5 grid h-11 w-11 place-items-center rounded-lg border border-border-strong bg-muted">
                <LockKeyhole className="h-5 w-5 shrink-0" color="var(--accent-primary-hex)" />
              </span>
              <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-heading text-text-primary">Reset your password</h1>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Enter your account email and we’ll send a short-lived verification code.</p>
            </header>
            <form onSubmit={requestCode} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="recovery-email" className="text-sm font-medium text-text-primary">Email address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" style={mutedIconStyle} />
                  <Input id="recovery-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 bg-surface pl-10 text-text-primary placeholder:text-text-muted" required maxLength={254} />
                </div>
              </div>
              <AnimatePresence initial={false}>{error ? <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="rounded-md border border-error/35 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</motion.p> : null}</AnimatePresence>
              <Button type="submit" disabled={loading} className="h-11 w-full bg-primary font-semibold text-text-on-accent hover:bg-primary-hover">{loading ? 'Sending code…' : 'Continue with email'}</Button>
            </form>
          </motion.div>
        ) : null}

        {step === 'verify' ? (
          <motion.div key="verify" {...panelMotion}>
            <button type="button" onClick={changeEmail} className="mb-7 inline-flex items-center gap-2 rounded-md p-0 text-xs font-semibold text-text-muted transition-colors duration-fast hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <ArrowLeft className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />
              Change email address
            </button>
            <header className="mb-7">
              <span className="mb-5 grid h-11 w-11 place-items-center rounded-lg border border-border-strong bg-muted">
                <KeyRound className="h-5 w-5 shrink-0" color="var(--accent-primary-hex)" />
              </span>
              <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-heading text-text-primary">Check your email</h1>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Enter the six-digit verification code sent for <span className="font-semibold text-text-primary">{email}</span>.</p>
            </header>
            <form onSubmit={verifyCode} className="space-y-4">
              {status ? <p role="status" className="rounded-md border border-info/25 bg-info/10 px-3 py-2.5 text-xs leading-5 text-text-secondary">{status}</p> : null}
              <div className="space-y-2">
                <label htmlFor="recovery-otp" className="text-sm font-medium text-text-primary">Verification code</label>
                <Input id="recovery-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="h-14 bg-surface text-center font-mono text-xl font-semibold tracking-[0.35em] tabular-nums text-text-primary" required minLength={6} maxLength={6} />
              </div>
              <AnimatePresence initial={false}>{error ? <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="rounded-md border border-error/35 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</motion.p> : null}</AnimatePresence>
              <Button type="submit" disabled={loading || otp.length !== 6} className="h-11 w-full bg-primary font-semibold text-text-on-accent hover:bg-primary-hover">{loading ? 'Verifying code…' : 'Verify code'}</Button>
            </form>
            <p className="mt-5 text-center text-xs text-text-muted">Didn’t receive it? <button type="button" onClick={resendCode} disabled={loading || cooldown > 0} className="rounded-sm p-0 font-semibold text-primary transition-colors duration-fast enabled:hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:text-text-muted">{cooldown > 0 ? `Request again in ${cooldown}s` : 'Request another code'}</button></p>
          </motion.div>
        ) : null}

        {step === 'password' ? (
          <motion.div key="password" {...panelMotion}>
            <button type="button" onClick={() => { setStep('verify'); setOtp(''); setError(''); setStatus(''); }} className="mb-7 inline-flex items-center gap-2 rounded-md p-0 text-xs font-semibold text-text-muted transition-colors duration-fast hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <ArrowLeft className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />
              Use a different code
            </button>
            <header className="mb-7">
              <span className="mb-5 grid h-11 w-11 place-items-center rounded-lg border border-border-strong bg-muted">
                <LockKeyhole className="h-5 w-5 shrink-0" color="var(--accent-primary-hex)" />
              </span>
              <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-heading text-text-primary">Choose a new password</h1>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Code confirmed. Create a new password for <span className="font-semibold text-text-primary">{email}</span>.</p>
            </header>
            <form onSubmit={resetPassword} className="space-y-4">
              <p role="status" className="rounded-md border border-success/25 bg-success/10 px-3 py-2.5 text-xs leading-5 text-text-secondary">
                Your verification code is valid. It will be checked once more when you reset the password.
              </p>
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium text-text-primary">New password</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" style={mutedIconStyle} />
                  <Input id="new-password" type={showNewPassword ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" className="h-11 bg-surface px-10 text-text-primary placeholder:text-text-muted" required minLength={8} />
                  <button type="button" onClick={() => setShowNewPassword(value => !value)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showNewPassword} className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md p-0 text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55">
                    {showNewPassword ? <EyeOff className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" /> : <Eye className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium text-text-primary">Confirm new password</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" style={mutedIconStyle} />
                  <Input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your new password" className="h-11 bg-surface px-10 text-text-primary placeholder:text-text-muted" required minLength={8} />
                  <button type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword} className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md p-0 text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" /> : <Eye className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />}
                  </button>
                </div>
              </div>
              <AnimatePresence initial={false}>{error ? <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="rounded-md border border-error/35 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</motion.p> : null}</AnimatePresence>
              <Button type="submit" disabled={loading} className="h-11 w-full bg-primary font-semibold text-text-on-accent hover:bg-primary-hover">{loading ? 'Resetting password…' : 'Reset password'}</Button>
            </form>
          </motion.div>
        ) : null}

        {step === 'success' ? (
          <motion.div key="success" {...panelMotion} className="py-4 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl border border-success/30 bg-success/10">
              <CheckCircle2 className="h-7 w-7 shrink-0" color="var(--success-icon-hex)" />
            </span>
            <h1 className="mt-6 font-display text-[2rem] font-semibold leading-tight tracking-heading text-text-primary">Password reset</h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">Your new password is ready. Returning you to sign in…</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AuthShell>
  );
};

export default ForgotPassword;
