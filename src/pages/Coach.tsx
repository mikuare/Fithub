import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Sparkles, Info, RotateCcw, User, ArrowRight } from 'lucide-react';
import { PaywallGate } from '@/components/PaywallGate';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/layout/AppShell';
import { useData } from '@/store/data';
import { useAuth } from '@/store/auth';
import { askFitCoach, STARTER_QUESTIONS, type CoachAnswer } from '@/lib/coach/fitcoach';
import { cn } from '@/lib/utils';
import { uid } from '@/lib/id';

interface Turn {
  id: string;
  role: 'user' | 'coach';
  text: string;
  answer?: CoachAnswer;
}

export default function CoachPage() {
  return (
    <PaywallGate
      feature="fitcoach"
      title="FitCoach"
      blurb="An assistant that answers from your data, not from the internet. Ask about your records, your recovery, your programme or your progress — and when it does not have something recorded, it says so."
      bullets={[
        'Answers grounded in your own sets, records and check-ins',
        'Honest by design — it never invents numbers',
        'Programme, recovery and progress questions in plain language',
      ]}
    >
      <Coach />
    </PaywallGate>
  );
}

function Coach() {
  const { profile } = useAuth();
  const state = useData();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const answer = askFitCoach(q, state);
    setTurns((t) => [
      ...t,
      { id: uid('t'), role: 'user', text: q },
      { id: uid('t'), role: 'coach', text: answer.text, answer },
    ]);
    setInput('');
    inputRef.current?.focus();
  };

  const firstName = profile?.full_name.split(' ')[0] ?? 'there';

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        eyebrow="FitCoach"
        title="Ask about your training"
        subtitle="FitCoach answers only from what you have actually recorded. When something is not logged, it says so rather than guessing."
        actions={
          turns.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setTurns([])} icon={<RotateCcw size={14} />}>Clear</Button>
          ) : undefined
        }
      />

      <Card className="overflow-hidden">
        <div className="min-h-[380px] max-h-[62vh] overflow-y-auto p-4 sm:p-5 space-y-4">
          {turns.length === 0 ? (
            <div className="py-6">
              <div className="flex items-start gap-3">
                <Logo size={34} />
                <div className="min-w-0">
                  <p className="font-semibold">Hi {firstName}.</p>
                  <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">
                    I can tell you what is on today, how your week went, whether a lift is moving, what to
                    do on a recovery day, and why your progress might have stalled — all from your own logs.
                  </p>
                </div>
              </div>

              <p className="mt-6 text-2xs font-semibold uppercase tracking-wider text-ink-3">Try asking</p>
              <div className="mt-2 grid sm:grid-cols-2 gap-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="text-left px-3.5 py-2.5 rounded-xl border border-line hover:border-brand/50 hover:bg-surface-2 text-sm transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className={cn('flex gap-3', turn.role === 'user' && 'justify-end')}>
                {turn.role === 'coach' && <Logo size={30} />}
                <div className={cn('min-w-0 max-w-[85%]', turn.role === 'user' && 'order-first')}>
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      turn.role === 'user'
                        ? 'bg-brand text-brand-contrast rounded-br-sm font-medium'
                        : 'bg-surface-2 border border-line rounded-bl-sm text-ink-2',
                    )}
                  >
                    {turn.text}
                  </div>

                  {turn.answer?.facts && turn.answer.facts.length > 0 && (
                    <dl className="mt-2 rounded-2xl border border-line divide-y divide-line overflow-hidden">
                      {turn.answer.facts.map((f, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-3 px-3.5 py-2 bg-surface">
                          <dt className="text-xs text-ink-3 min-w-0 truncate">{f.label}</dt>
                          <dd className="text-xs font-semibold tabular shrink-0">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {turn.answer?.missingData && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-ink-3">
                      <Info size={11} /> Based on limited data — some of this is not logged yet.
                    </p>
                  )}

                  {turn.answer?.link && (
                    <Link
                      to={turn.answer.link.to}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-text hover:underline"
                    >
                      {turn.answer.link.label} <ArrowRight size={12} />
                    </Link>
                  )}

                  {turn.answer?.suggestions && turn.answer.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {turn.answer.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => ask(s)}
                          className="px-2.5 py-1.5 rounded-lg border border-line text-2xs hover:border-brand/50 hover:bg-surface-2 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {turn.role === 'user' && profile && (
                  <span
                    className="h-[30px] w-[30px] shrink-0 rounded-full grid place-items-center text-2xs font-bold"
                    style={{ background: profile.avatar_color, color: '#0B0F14' }}
                    aria-hidden
                  >
                    <User size={14} />
                  </span>
                )}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
          className="border-t border-line p-3 flex gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your training…"
            aria-label="Ask FitCoach a question"
            className="flex-1 h-11 px-4 rounded-xl bg-surface-2 border border-line text-sm placeholder:text-ink-3 focus:border-brand/60"
          />
          <Button type="submit" size="lg" disabled={!input.trim()} aria-label="Send" icon={<Send size={16} />}>
            <span className="hidden sm:inline">Ask</span>
          </Button>
        </form>
      </Card>

      <Card>
        <div className="p-4 flex items-start gap-2.5">
          <Sparkles size={15} className="shrink-0 mt-0.5 text-brand-text" />
          <p className="text-2xs text-ink-3 leading-relaxed">
            FitCoach reads your workouts, sets, recovery check-ins, goals, records and habits. It gives
            general fitness guidance only and does not diagnose conditions or replace advice from a
            qualified healthcare professional.
          </p>
        </div>
      </Card>
    </div>
  );
}
