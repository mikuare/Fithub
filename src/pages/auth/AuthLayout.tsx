import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/AppShell';
import { MuscleMap } from '@/components/MuscleMap';
import { backendKind } from '@/lib/db';
import { Database, HardDrive, BatteryCharging, PersonStanding, Sparkles } from 'lucide-react';

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const kind = backendKind();
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-bg">
      {/* Form column */}
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/welcome" className="inline-flex items-center gap-2.5 self-start">
          <Logo />
          <span className="font-bold text-lg tracking-tight">FitHub</span>
        </Link>

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-3xl font-black tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-ink-3 leading-relaxed">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-6 text-sm text-ink-3">{footer}</div>

            <p className="mt-8 flex items-start gap-2 text-2xs text-ink-3 leading-relaxed border-t border-line pt-5">
              {kind === 'supabase' ? <Database size={14} className="shrink-0 mt-0.5" /> : <HardDrive size={14} className="shrink-0 mt-0.5" />}
              <span>
                {kind === 'supabase'
                  ? 'Connected to a Supabase project. Accounts, data and permissions are enforced by the database.'
                  : 'Running in local mode: your account and training data are stored in this browser only, and never leave this device. Add Supabase credentials to your .env for multi-device sync and Google sign-in.'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Brand column */}
      <div className="hidden lg:flex relative items-center justify-center overflow-hidden border-l border-line bg-bg-elev">
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--c-line-strong)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-line-strong)) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden
        />
        <div
          className="absolute -bottom-52 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, rgb(var(--c-brand)) 0%, transparent 65%)' }}
          aria-hidden
        />
        <div className="relative max-w-md px-10">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-text">The FitHub loop</p>
          <h2 className="mt-4 text-4xl font-black tracking-tighter leading-[1.05]">
            Plan. Train. Record.<br />Recover. Improve.
          </h2>
          <p className="mt-5 text-ink-2 leading-relaxed">
            Every session you log makes the next suggestion better — the programme, the loads, the
            rest days and the weekly review all come from your own history.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              ['107', 'exercises with form guidance, mistakes and alternatives'],
              ['0', 'setup required — a full programme is generated for you'],
              ['1', 'question the dashboard answers first: what do I do today?'],
            ].map(([stat, label]) => (
              <li key={label} className="flex items-baseline gap-4">
                <span className="text-3xl font-black tabular text-brand-text w-14 shrink-0">{stat}</span>
                <span className="text-sm text-ink-2 leading-snug">{label}</span>
              </li>
            ))}
          </ul>

          {/* A taste of what is inside */}
          <div className="mt-10 card p-4 shadow-lift flex items-center gap-4">
            <MuscleMap
              view="front" size={64} className="shrink-0"
              heat={{ chest: 34, shoulders: 58, triceps: 61, quads: 92, hamstrings: 95, glutes: 90, core: 70, calves: 88, biceps: 84, back: 82, lats: 82, forearms: 90, traps: 76, obliques: 72, lower_back: 80 }}
            />
            <div className="min-w-0">
              <p className="text-2xs uppercase tracking-widest text-ink-3">Body Map</p>
              <p className="mt-1 text-sm font-semibold leading-snug">Chest is still recovering from Tuesday — legs are fresh.</p>
              <p className="mt-1 text-2xs text-ink-3 leading-relaxed">
                Computed from your own sets. One of the things waiting on the other side of this form.
              </p>
            </div>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-2xs text-ink-3">
            <li className="inline-flex items-center gap-1.5"><BatteryCharging size={13} className="text-brand-text" /> Free core, forever</li>
            <li className="inline-flex items-center gap-1.5"><PersonStanding size={13} className="text-brand-text" /> Body Map in Plus</li>
            <li className="inline-flex items-center gap-1.5"><Sparkles size={13} className="text-brand-text" /> FitCoach in Pro</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
