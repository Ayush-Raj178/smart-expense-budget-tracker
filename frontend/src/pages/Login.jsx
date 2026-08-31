import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/authService';

const Login = () => {
  const location = useLocation();
  const resetEmail = location.state?.passwordReset && typeof location.state?.email === 'string'
    ? location.state.email
    : '';
  const [email, setEmail] = useState(resetEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const successMessage = location.state?.message;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formData = new FormData(event.currentTarget);
      const submittedEmail = String(formData.get('email') || '').trim().toLowerCase();
      const submittedPassword = String(formData.get('password') || '');
      const response = await authService.login(submittedEmail, submittedPassword);
      login(response.token, response.user || { name: response.name, email: response.email });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.status === 401 ? 'Invalid email or password' : 'An error occurred. Please try again.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell mode="login">
      <header className="mb-8">
        <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-heading text-text-primary">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Sign in to continue to your financial overview.</p>
      </header>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-text-primary">Email address</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" style={{ color: 'rgb(var(--text-muted))' }} />
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 bg-surface pl-10 text-text-primary placeholder:text-text-muted" required />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="password" className="text-sm font-medium text-text-primary">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-primary transition-colors hover:text-primary-hover hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2" style={{ color: 'rgb(var(--text-muted))' }} />
            <Input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 bg-surface px-10 text-text-primary placeholder:text-text-muted" required />
            <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md p-0 text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55">
              {showPassword ? <EyeOff className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" /> : <Eye className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />}
            </button>
          </div>
        </div>
        {successMessage ? <p role="status" className="rounded-md border border-success/25 bg-success/10 px-3 py-2.5 text-sm leading-5 text-text-secondary">{successMessage}</p> : null}
        <AnimatePresence initial={false}>{error ? <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="rounded-md border border-error/35 bg-error/10 px-3 py-2.5 text-sm text-error">{error}</motion.div> : null}</AnimatePresence>
        <Button type="submit" disabled={loading} className="h-11 w-full bg-primary font-semibold text-text-on-accent hover:bg-primary-hover">{loading ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-secondary">New to SmartBudget?{' '}<Link to="/signup" className="font-semibold text-primary hover:text-primary-hover hover:underline">Create an account</Link></p>
    </AuthShell>
  );
};

export default Login;
