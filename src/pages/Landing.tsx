import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Dumbbell, Timer, TrendingUp, Target, BatteryCharging, Apple,
  Flag, UserRoundCog, BookOpen, ShieldCheck, Sparkles, ChevronDown, Check,
  PersonStanding, Smartphone, CreditCard,
} from 'lucide-react';
import { Logo } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { MuscleMap } from '@/components/MuscleMap';
import { ProgressRing } from '@/components/ui/Progress';
import { PLANS, formatPrice, priceFor, yearlySavingsPct } from '@/lib/billing/plans';
import { HEALTH_DISCLAIMER } from '@/lib/defaults';
import { cn } from '@/lib/utils';
import type { BillingCycle } from '@/types';

const FEATURES = [
  { icon: BookOpen, title: 'Smart workout planning', body: 'A programme built from your goal, experience, equipment and the days you can actually train — then adjusted as you log.' },
  { icon: Dumbbell, title: 'Guided exercises', body: 'Over 100 movements with step-by-step form cues, common mistakes, safety notes and swap-in alternatives.' },
  { icon: Timer, title: 'Workout timer', body: 'Rest, interval and HIIT timers that keep running accurately while you move around the app.' },
  { icon: TrendingUp, title: 'Progress tracking', body: 'Strength trends, personal records, body measurements and consistency — charted so you can read them at a glance.' },
  { icon: Target, title: 'Fitness goals', body: 'Measurable goals with milestones and honest pace tracking, updated automatically from what you log.' },
  { icon: BatteryCharging, title: 'Recovery monitoring', body: 'A daily readiness score from your own sleep, energy, soreness and stress — with advice that sometimes says rest.' },
  { icon: Apple, title: 'Nutrition guidance', body: 'Meal, water and macro logging with estimated targets you can override at any time.' },
  { icon: Flag, title: 'Gym challenges', body: 'Individual, friend and gym-wide challenges. Leaderboards are opt-in, never automatic.' },
  { icon: UserRoundCog, title: 'Trainer support', body: 'Coaches see programmes, history and progress for the clients assigned to them — and nobody else.' },
  { icon: PersonStanding, title: 'Body Map', body: 'A living heat map of every muscle — fresh, recovering or fatigued — plus a niggle journal that flags exercises to swap.' },
  { icon: Sparkles, title: 'FitCoach', body: 'An assistant that answers from your own records and check-ins — and says "I don\'t have that recorded" instead of guessing.' },
  { icon: Smartphone, title: 'Installs like an app', body: 'FitHub is a PWA: add it to your home screen, open it full-screen, and keep training when the connection drops.' },
];

const LOOP = [
  { label: 'Plan', body: 'Know what to do today' },
  { label: 'Train', body: 'Guided, distraction-free' },
  { label: 'Record', body: 'Every set, automatically' },
  { label: 'Recover', body: 'Readiness, not guesswork' },
  { label: 'Analyse', body: 'Weekly and monthly review' },
  { label: 'Improve', body: 'The plan adapts' },
];

const FAQ = [
  {
    q: 'How much does FitHub cost?',
    a: 'The training core — programme, live workouts, progress, records, recovery, habits — is free forever. Plus adds the Body Map, weekly reviews and monthly reports; Pro adds FitCoach on top. Pay monthly or yearly with an international card (Visa, Mastercard, Amex, JCB) or, in the Philippines, with GCash, Maya or GrabPay.',
  },
  {
    q: 'Do I need a gym to use FitHub?',
    a: 'No. During setup you tell FitHub where you train and what equipment you have — including "bodyweight only". Programmes are built from exactly that list, so a home session with no equipment gets a real plan rather than a stripped-down one.',
  },
  {
    q: 'I have never lifted before. Is this for me?',
    a: 'Yes. Beginners get full-body sessions, conservative set counts, and only movements rated beginner-friendly. Every exercise page includes step-by-step instructions, the mistakes people usually make, and an easier variation.',
  },
  {
    q: 'What happens on a rest day?',
    a: 'Rest days are part of your programme, not gaps in it. Taking a scheduled rest day keeps your consistency streak intact — FitHub is built to encourage sustainable training, not punish recovery.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Every profile starts private and every kind of sharing is opt-in. Progress photos and measurements are never shared unless you explicitly turn that on, and you can export or delete your account at any time.',
  },
  {
    q: 'Does FitHub give medical advice?',
    a: 'No. FitHub offers general fitness guidance only. It never diagnoses conditions, and it prompts you to speak with a qualified healthcare professional where that is appropriate.',
  },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <a href="#hero" className="skip-link">Skip to main content</a>

      <header className={cn('sticky top-0 z-40 transition-shadow', scrolled && 'glass border-b border-line')}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-3">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-bold text-lg tracking-tight">FitHub</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-6 text-sm" aria-label="Sections">
            <a href="#features" className="px-3 py-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2">Features</a>
            <a href="#how" className="px-3 py-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2">How it works</a>
            <a href="#roles" className="px-3 py-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2">For gyms</a>
            <a href="#pricing" className="px-3 py-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2">Pricing</a>
            <a href="#faq" className="px-3 py-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-2">FAQ</a>
          </nav>
          <div className="flex-1" />
          <Button to="/signin" variant="ghost" size="sm">Sign in</Button>
          <Button to="/signup" size="sm" iconRight={<ArrowRight size={15} />}>Get started</Button>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section id="hero" className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-[0.18] grid-fade"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--c-line-strong)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-line-strong)) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          aria-hidden
        />
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] -z-10 rounded-full blur-3xl opacity-25"
          style={{ background: 'radial-gradient(circle, rgb(var(--c-brand)) 0%, transparent 65%)' }}
          aria-hidden
        />

        <div className="max-w-6xl mx-auto px-5 pt-16 pb-20 sm:pt-24 sm:pb-28 grid lg:grid-cols-[1.15fr,1fr] gap-14 items-center">
          {/* min-w-0 lets the grid track shrink below the cards' intrinsic
              width on phones; the preview's own truncation handles the rest. */}
          <div className="animate-fade-up min-w-0">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand/30 bg-brand-soft text-brand-text text-xs font-semibold">
              <Sparkles size={13} /> Personal trainer · tracker · gym companion
            </span>

            <h1 className="mt-6 text-[2.6rem] leading-[1.03] sm:text-6xl lg:text-7xl font-black tracking-tighter">
              BUILD YOUR<br />
              <span className="text-brand-text">STRONGER</span> SELF
            </h1>

            <p className="mt-6 text-lg text-ink-2 leading-relaxed max-w-xl">
              Train smarter, stay consistent, understand your progress, and build healthier habits
              with one intelligent fitness platform.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/signup" size="xl" iconRight={<ArrowRight size={18} />}>Get Started</Button>
              <Button to="/signin" size="xl" variant="outline">Sign In</Button>
              <Button size="xl" variant="ghost" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore FitHub
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-3">
              {['Beginner to advanced', 'Gym, home or outdoors', 'Works offline', 'Private by default'].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check size={15} className="text-brand-text shrink-0" aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>

          <HeroPreview />
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="py-20 sm:py-24 border-t border-line">
        <div className="max-w-6xl mx-auto px-5">
          <SectionHeading
            eyebrow="Everything in one place"
            title="Not just a workout log"
            body="FitHub answers the questions a spreadsheet cannot: what should I do today, am I improving, am I recovering, and what should I change next?"
          />
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6 hover:border-line-strong transition-colors group">
                <div className="h-11 w-11 rounded-xl bg-brand-soft grid place-items-center text-brand-text group-hover:scale-105 transition-transform">
                  <f.icon size={20} />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-ink-3 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- The loop ---------------- */}
      <section id="how" className="py-20 sm:py-24 border-t border-line bg-bg-elev">
        <div className="max-w-6xl mx-auto px-5">
          <SectionHeading
            eyebrow="How it works"
            title="One continuous feedback loop"
            body="Each stage feeds the next. What you log on Monday changes what FitHub suggests on Thursday."
          />
          <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {LOOP.map((step, i) => (
              <li key={step.label} className="relative card p-5">
                <span className="text-2xs font-bold text-brand-text tabular">0{i + 1}</span>
                <p className="mt-1.5 font-bold">{step.label}</p>
                <p className="mt-1 text-xs text-ink-3 leading-relaxed">{step.body}</p>
                {i < LOOP.length - 1 && (
                  <ArrowRight
                    size={16}
                    className="hidden lg:block absolute top-1/2 -right-[14px] -translate-y-1/2 text-ink-3 z-10"
                    aria-hidden
                  />
                )}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-sm text-ink-3">
            Repeat. That is the whole product.
          </p>
        </div>
      </section>

      {/* ---------------- Roles ---------------- */}
      <section id="roles" className="py-20 sm:py-24 border-t border-line">
        <div className="max-w-6xl mx-auto px-5">
          <SectionHeading
            eyebrow="Built for the whole gym"
            title="Members, trainers and operators"
            body="One platform with strict role boundaries. A trainer sees their assigned clients. Staff handle attendance. Nobody sees another member's private data."
          />
          <div className="mt-12 grid md:grid-cols-3 gap-4">
            {[
              { title: 'Members', icon: Dumbbell, points: ['Personal programme and daily workout', 'Live workout mode with rest timers', 'Progress, records and recovery', 'Habits, nutrition and challenges'] },
              { title: 'Trainers', icon: UserRoundCog, points: ['Assigned client roster', 'Build and assign programmes', 'Review history and progress', 'Notes and direct messages'] },
              { title: 'Gym operators', icon: ShieldCheck, points: ['Membership and renewal tracking', 'QR and manual check-in', 'Equipment and maintenance', 'Attendance and retention analytics'] },
            ].map((role) => (
              <div key={role.title} className="card p-6">
                <div className="h-11 w-11 rounded-xl bg-accent-soft grid place-items-center text-accent-text">
                  <role.icon size={20} />
                </div>
                <h3 className="mt-4 font-semibold text-lg">{role.title}</h3>
                <ul className="mt-3 space-y-2">
                  {role.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-ink-2">
                      <Check size={15} className="text-brand-text shrink-0 mt-0.5" aria-hidden />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <PricingSection />

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" className="py-20 sm:py-24 border-t border-line bg-bg-elev">
        <div className="max-w-3xl mx-auto px-5">
          <SectionHeading eyebrow="Questions" title="Before you start" />
          <div className="mt-10 space-y-2">
            {FAQ.map((item, i) => (
              <div key={item.q} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-2 transition-colors"
                >
                  <span className="font-semibold text-sm">{item.q}</span>
                  <ChevronDown size={17} className={cn('shrink-0 text-ink-3 transition-transform', openFaq === i && 'rotate-180')} />
                </button>
                {openFaq === i && (
                  <p className="px-5 pb-5 -mt-1 text-sm text-ink-2 leading-relaxed animate-fade-in">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="py-20 sm:py-28 border-t border-line">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter leading-tight">
            Know what to do. Do it correctly.<br />
            <span className="text-brand-text">See the progress.</span>
          </h2>
          <p className="mt-5 text-ink-2 leading-relaxed">
            Setup takes a few minutes and gives you a programme built around your goal, your schedule and the equipment you actually have.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Button to="/signup" size="xl" iconRight={<ArrowRight size={18} />}>Create your account</Button>
            <Button to="/signin" size="xl" variant="outline">I already have one</Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-10">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-wrap items-center gap-3">
            <Logo size={26} />
            <span className="font-bold">FitHub</span>
            <span className="text-sm text-ink-3">Smart fitness guidance, workout monitoring & gym management.</span>
          </div>
          <p className="mt-6 text-xs text-ink-3 leading-relaxed max-w-3xl">{HEALTH_DISCLAIMER}</p>
        </div>
      </footer>
    </div>
  );
}

function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>('yearly');
  return (
    <section id="pricing" className="py-20 sm:py-24 border-t border-line">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Pricing"
            title="The core is free. Forever."
            body="Train, track and recover on the Free plan for as long as you like. Upgrade only when you want FitHub to read your body, not just your workouts."
          />
          <div role="radiogroup" aria-label="Billing cycle" className="inline-flex rounded-xl border border-line bg-surface p-1">
            {(['monthly', 'yearly'] as const).map((c) => (
              <button
                key={c} type="button" role="radio" aria-checked={cycle === c}
                onClick={() => setCycle(c)}
                className={cn(
                  'px-4 h-9 rounded-lg text-sm font-semibold transition-colors',
                  cycle === c ? 'bg-brand text-brand-contrast' : 'text-ink-2 hover:text-ink',
                )}
              >
                {c === 'monthly' ? 'Monthly' : `Yearly · save ${yearlySavingsPct('plus', 'USD')}%`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-4 items-stretch">
          {PLANS.map((plan) => (
            <div key={plan.tier} className={cn('card p-6 flex flex-col relative', plan.highlight && 'border-brand/50')}>
              {plan.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-brand text-brand-contrast text-2xs font-black uppercase tracking-wide">
                  Most popular
                </span>
              )}
              <h3 className="font-black text-lg">{plan.name}</h3>
              <p className="mt-1 text-xs text-ink-3 leading-relaxed">{plan.tagline}</p>
              <p className="mt-4">
                <span className="text-4xl font-black tabular">{formatPrice(priceFor(plan.tier, cycle, 'USD'), 'USD')}</span>
                <span className="text-sm text-ink-3"> / {cycle === 'monthly' ? 'month' : 'year'}</span>
              </p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {plan.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-ink-2">
                    <Check size={15} className="text-brand-text shrink-0 mt-0.5" aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Button
                to="/signup" block className="mt-6"
                variant={plan.highlight ? 'primary' : 'outline'}
                iconRight={<ArrowRight size={15} />}
              >
                {plan.tier === 'free' ? 'Start free' : `Start with ${plan.name}`}
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-3">
          <span className="inline-flex items-center gap-1.5"><CreditCard size={15} className="text-brand-text" /> Visa · Mastercard · Amex · JCB</span>
          <span className="inline-flex items-center gap-1.5"><Smartphone size={15} className="text-brand-text" /> GCash · Maya · GrabPay for the Philippines</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-brand-text" /> Export and deletion free on every plan</span>
        </p>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-text">{eyebrow}</p>
      <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tighter leading-tight">{title}</h2>
      {body && <p className="mt-4 text-ink-2 leading-relaxed">{body}</p>}
    </div>
  );
}

/** A static, honest preview of the real dashboard cards. */
function HeroPreview() {
  return (
    <div className="animate-fade-up min-w-0" style={{ animationDelay: '120ms' }}>
      <div className="card p-5 shadow-lift">
        {/* Today's focus lives inside the header — a floating overlay here used
            to cover the card's content at narrower widths. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <MuscleMap
              primary={['chest', 'shoulders']} secondary={['triceps', 'core']}
              view="front" size={34} className="shrink-0"
            />
            <div className="min-w-0">
              <p className="text-2xs uppercase tracking-widest text-ink-3">Today's focus</p>
              <p className="text-xl font-bold mt-0.5">Push Day</p>
              <p className="text-sm text-ink-3 truncate">Chest · Shoulders · Triceps · 58 min</p>
            </div>
          </div>
          <ProgressRing value={82} size={72} stroke={7} label="Recovery 82 of 100">
            <span className="text-lg font-black tabular leading-none">82</span>
            <span className="text-[9px] text-ink-3 uppercase tracking-wide mt-0.5">Ready</span>
          </ProgressRing>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { label: 'This week', value: '3 / 4', hint: 'workouts' },
            { label: 'Streak', value: '12', hint: 'days' },
            { label: 'FitScore', value: '784', hint: '+18 this week' },
            { label: 'Bench press', value: '+7.5', hint: 'kg in 6 weeks' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-surface-2 border border-line p-3">
              <p className="text-2xs text-ink-3 uppercase tracking-wide">{s.label}</p>
              <p className="text-xl font-black tabular mt-0.5">{s.value}</p>
              <p className="text-2xs text-ink-3">{s.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-brand text-brand-contrast px-4 h-12 flex items-center justify-between font-bold">
          <span>START WORKOUT</span>
          <ArrowRight size={18} />
        </div>
      </div>
    </div>
  );
}
