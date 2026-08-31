import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, User } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useFeatureFlags } from '@/context/FeatureFlagsContext';
import { authService } from '@/services/authService';

const getApiMessage = (error, fallback) => error.response?.data?.message || fallback;

const Signup = () => {
  const [step, setStep] = useState('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const { login } = useAuth();
  const { otpVerificationEnabled, loading: featureFlagsLoading } = useFeatureFlags();
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleDetailsSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    if (!termsAccepted) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }
    setLoading(true);
    try {
      const response = await authService.signup(name, email, password);
      if (response.token) {
        login(response.token, response.user);
        navigate('/dashboard');
        return;
      }
      setEmail(response.email || email.trim().toLowerCase());
      setCooldown(response.resendAvailableInSeconds || 60);
      setStatus('We sent a 6-digit verification code to your email.');
      setStep('otp');
    } catch (requestError) {
      setError(getApiMessage(requestError, "We couldn't send a verification code to this email address — please check it's correct."));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authService.verifySignupOtp(email, otp);
      login(response.token, response.user);
      navigate('/dashboard');
    } catch (verificationError) {
      setError(getApiMessage(verificationError, 'We could not verify that code.'));
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (cooldown > 0 || loading) return;
    setError('');
    setStatus('');
    setLoading(true);
    try {
      const response = await authService.resendSignupOtp(email);
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

  const returnToDetails = () => {
    setStep('details');
    setOtp('');
    setError('');
    setStatus('');
  };

  const iconStyle = { color: 'rgb(var(--text-muted))' };
  return (
    <AuthShell mode="signup">
      <AnimatePresence mode="wait" initial={false}>
        {step === 'details' ? (
          <motion.div key="details" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}>
            <header className="mb-7">
              <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-heading text-text-primary">Create your account</h1>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Start building a clearer financial picture.</p>
            </header>
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div className="space-y-2"><label htmlFor="name" className="text-sm font-medium text-text-primary">Full name</label><div className="relative"><User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" style={iconStyle} /><Input id="name" type="text" autoComplete="name" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} className="h-11 bg-surface pl-10 text-text-primary placeholder:text-text-muted" required maxLength={100} /></div></div>
              <div className="space-y-2"><label htmlFor="signup-email" className="text-sm font-medium text-text-primary">Email address</label><div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" style={iconStyle} /><Input id="signup-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 bg-surface pl-10 text-text-primary placeholder:text-text-muted" required maxLength={254} /></div></div>
              <div className="space-y-2"><label htmlFor="signup-password" className="text-sm font-medium text-text-primary">Password</label><div className="relative"><Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" style={iconStyle} /><Input id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Create a password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 bg-surface px-10 text-text-primary placeholder:text-text-muted" required minLength={8} /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md p-0 text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55">{showPassword ? <EyeOff className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" /> : <Eye className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />}</button></div><p className="text-xs text-text-muted">Use at least 8 characters.</p></div>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border-subtle bg-surface px-3.5 py-3 transition-colors duration-fast hover:border-border-strong hover:bg-hover">
                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-strong" style={{ accentColor: 'rgb(var(--accent-primary))' }} required />
                <span className="text-xs leading-5 text-text-secondary">I agree to the <Link to="/terms" className="font-semibold text-primary hover:text-primary-hover">Terms of Service</Link> and <Link to="/privacy" className="font-semibold text-primary hover:text-primary-hover">Privacy Policy</Link>.</span>
              </label>
              <AnimatePresence initial={false}>{error ? <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="rounded-md border border-error/35 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</motion.div> : null}</AnimatePresence>
              <Button type="submit" disabled={loading || featureFlagsLoading} className="h-11 w-full bg-primary font-semibold text-text-on-accent hover:bg-primary-hover">{featureFlagsLoading ? 'Checking account options…' : loading ? (otpVerificationEnabled ? 'Sending verification code…' : 'Creating account…') : otpVerificationEnabled ? 'Continue with email' : 'Create account'}</Button>
            </form>
            <p className="mt-6 text-center text-sm text-text-secondary">Already have an account?{' '}<Link to="/login" className="font-semibold text-primary hover:text-primary-hover hover:underline">Sign in</Link></p>
          </motion.div>
        ) : (
          <motion.div key="otp" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.18 }}>
            <button type="button" onClick={returnToDetails} className="mb-7 inline-flex items-center gap-2 rounded-md p-0 text-xs font-semibold text-text-muted transition-colors duration-fast hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><ArrowLeft className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />Change account details</button>
            <header className="mb-7">
              <span className="mb-5 grid h-11 w-11 place-items-center rounded-lg border border-border-strong bg-muted"><KeyRound className="h-5 w-5 shrink-0" color="var(--accent-primary-hex)" /></span>
              <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-heading text-text-primary">Check your email</h1>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Enter the 6-digit code sent to <span className="font-semibold text-text-primary">{email}</span>. It expires in 10 minutes.</p>
            </header>
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div className="space-y-2"><label htmlFor="signup-otp" className="text-sm font-medium text-text-primary">Verification code</label><Input id="signup-otp" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="h-14 bg-surface text-center font-mono text-xl font-semibold tracking-[0.35em] tabular-nums text-text-primary" required minLength={6} maxLength={6} /></div>
              {status ? <p role="status" className="rounded-md border border-success/25 bg-success/10 px-3 py-2.5 text-sm text-text-secondary">{status}</p> : null}
              <AnimatePresence initial={false}>{error ? <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="rounded-md border border-error/35 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</motion.div> : null}</AnimatePresence>
              <Button type="submit" disabled={loading || otp.length !== 6} className="h-11 w-full bg-primary font-semibold text-text-on-accent hover:bg-primary-hover">{loading ? 'Verifying…' : 'Verify and create account'}</Button>
            </form>
            <p className="mt-5 text-center text-xs text-text-muted">Didn’t receive it? <button type="button" onClick={resendOtp} disabled={cooldown > 0 || loading} className="rounded-sm p-0 font-semibold text-primary transition-colors duration-fast enabled:hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:text-text-muted">{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button></p>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
};

export default Signup;
