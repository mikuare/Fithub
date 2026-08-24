import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, AlertTriangle, Dumbbell, Store, UserRoundCog } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Divider } from './SignIn';
import { GoogleButton } from './GoogleButton';
import { Button } from '@/components/ui/Button';
import { Input, ChoiceCard, Checkbox } from '@/components/ui/Field';
import { useAuth } from '@/store/auth';
import { backendKind } from '@/lib/db';
import { passwordStrength } from '@/lib/crypto';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

const ROLES: Array<{ value: Role; title: string; description: string; icon: typeof Dumbbell }> = [
  { value: 'member', title: 'Gym Member', description: 'Train with a personal programme, track progress and build habits.', icon: Dumbbell },
  { value: 'trainer', title: 'Trainer / Coach', description: 'Manage assigned clients, build programmes and review their progress.', icon: UserRoundCog },
];

/*
 * Staff, manager and admin are deliberately not on this list. A sign-up form
 * cannot be allowed to hand out access to other people's data — the server
 * clamps self-registration to member or trainer regardless of what is sent.
 * Manager comes from creating a gym; staff is granted by that gym's manager.
 */

export default function SignUp() {
  const { signUp, busy, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'role' | 'details'>('role');
  const [role, setRole] = useState<Role>('member');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => clearError, [clearError]);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const canSubmit = fullName.trim().length >= 2 && emailValid && password.length >= 8 && accepted;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    const ok = await signUp({ email, password, full_name: fullName, role });
    if (ok) navigate('/onboarding', { replace: true });
  };

  return (
    <AuthLayout
      title={step === 'role' ? 'How will you use FitHub?' : 'Create your account'}
      subtitle={
        step === 'role'
          ? 'This sets what you can see and do. You can change it later in your profile.'
          : 'Next you will set up your fitness profile — it takes about three minutes.'
      }
      footer={
        <>
          Already have an account?{' '}
          <Link to="/signin" className="font-semibold text-brand-text hover:underline">Sign in</Link>
        </>
      }
    >
      {step === 'role' ? (
        <div className="space-y-2.5">
          {ROLES.map((r) => (
            <ChoiceCard
              key={r.value}
              selected={role === r.value}
              onSelect={() => setRole(r.value)}
              title={r.title}
              description={r.description}
              icon={<r.icon size={18} />}
            />
          ))}
          <Button size="lg" block className="mt-4" onClick={() => setStep('details')} iconRight={<ArrowRight size={17} />}>
            Continue
          </Button>
          <p className="flex items-start gap-2 pt-1 text-2xs text-ink-3 leading-relaxed">
            <Store size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Running a gym? Sign up here first, then create your gym from{' '}
              <span className="font-semibold text-ink-2">My Gym</span> — that is what makes you its
              manager. Front-desk staff are added by the gym's manager.
            </span>
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && (
            <div role="alert" className="flex items-start gap-2.5 p-3 rounded-xl bg-danger-soft border border-danger/30 text-sm text-danger">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="button" onClick={() => setStep('role')} className="text-xs text-ink-3 hover:text-ink-2">
            ← Signing up as <span className="font-semibold text-ink-2">{ROLES.find((r) => r.value === role)?.title}</span>
          </button>

          <Input
            label="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)}
            autoComplete="name" placeholder="Alex Rivera" inputSize="lg"
            error={touched && fullName.trim().length < 2 ? 'Enter your name.' : undefined}
          />

          <Input
            label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" inputMode="email" placeholder="you@example.com" inputSize="lg"
            error={touched && !emailValid ? 'Enter a valid email address.' : undefined}
          />

          <div>
            <div className="relative">
              <Input
                label="Password" type={show ? 'text' : 'password'} required value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
                placeholder="At least 8 characters" inputSize="lg"
                error={touched && password.length < 8 ? 'Use at least 8 characters.' : undefined}
              />
              <button
                type="button" onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-[38px] h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:text-ink"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {password.length > 0 && (
              <div className="mt-2.5">
                <div className="flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors',
                        i < strength.score
                          ? strength.score <= 1 ? 'bg-danger' : strength.score <= 2 ? 'bg-warn' : 'bg-success'
                          : 'bg-surface-3',
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-2xs text-ink-3">
                  <span className="font-semibold text-ink-2">{strength.label}.</span>{' '}
                  {strength.issues.length ? strength.issues.join(' · ') : 'This is a strong password.'}
                </p>
              </div>
            )}
          </div>

          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            label={
              <>
                I understand FitHub gives general fitness guidance only and is not a substitute for
                professional medical advice.
              </>
            }
          />

          <Button type="submit" size="lg" block loading={busy} disabled={!canSubmit} iconRight={<ArrowRight size={17} />}>
            Create account
          </Button>

          {backendKind() === 'supabase' && (
            <>
              <Divider />
              <GoogleButton />
            </>
          )}
        </form>
      )}
    </AuthLayout>
  );
}
