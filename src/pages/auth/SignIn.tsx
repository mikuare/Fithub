import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useAuth } from '@/store/auth';
import { backendKind } from '@/lib/db';
import { GoogleButton } from './GoogleButton';

export default function SignIn() {
  const { signIn, busy, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => clearError, [clearError]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await signIn(email, password);
    if (ok) navigate('/', { replace: true });
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New to FitHub?{' '}
          <Link to="/signup" className="font-semibold text-brand-text hover:underline">Create an account</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div role="alert" className="flex items-start gap-2.5 p-3 rounded-xl bg-danger-soft border border-danger/30 text-sm text-danger">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          inputSize="lg"
        />

        <div className="relative">
          <Input
            label="Password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            inputSize="lg"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-[38px] h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:text-ink"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <Button type="submit" size="lg" block loading={busy} iconRight={<ArrowRight size={17} />}>
          Sign in
        </Button>

        {backendKind() === 'supabase' && (
          <>
            <Divider />
            <GoogleButton />
          </>
        )}
      </form>
    </AuthLayout>
  );
}

export function Divider() {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center" aria-hidden><div className="w-full border-t border-line" /></div>
      <div className="relative flex justify-center"><span className="bg-bg px-3 text-xs text-ink-3">or</span></div>
    </div>
  );
}
