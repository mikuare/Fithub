import { useState } from 'react';
import {
  Timer as TimerIcon, Play, Pause, RotateCcw, SkipForward, Plus, Minus, Flag, Volume2, VolumeX,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Input, Toggle } from '@/components/ui/Field';
import { ProgressRing } from '@/components/ui/Progress';
import {
  buildIntervalPlan, currentPhase, remainingMs, stopwatchMs, totalPlanSeconds, useTimer,
} from '@/store/timer';
import { primeAudio } from '@/lib/audio';
import { formatDuration, cn } from '@/lib/utils';

type Mode = 'rest' | 'exercise' | 'interval' | 'hiit' | 'stopwatch';

export default function Timers() {
  const [mode, setMode] = useState<Mode>('rest');
  const timer = useTimer();

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        eyebrow="Timers"
        title="Smart workout timer"
        subtitle="Timers run on the wall clock, so they stay accurate while you move around the app or your screen dims."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { primeAudio(); timer.setSound(!timer.soundEnabled); }}
              aria-pressed={timer.soundEnabled}
              aria-label={timer.soundEnabled ? 'Mute timer sounds' : 'Unmute timer sounds'}
              className={cn('h-9 w-9 grid place-items-center rounded-xl border transition-colors',
                timer.soundEnabled ? 'border-brand/40 bg-brand-soft text-brand-text' : 'border-line text-ink-3')}
            >
              {timer.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        }
      />

      <Tabs
        value={mode}
        onChange={(k) => setMode(k as Mode)}
        fill
        items={[
          { key: 'rest', label: 'Rest' },
          { key: 'exercise', label: 'Exercise' },
          { key: 'interval', label: 'Interval' },
          { key: 'hiit', label: 'HIIT' },
          { key: 'stopwatch', label: 'Stopwatch' },
        ]}
      />

      {mode === 'stopwatch' ? <Stopwatch /> : <CountdownTimers mode={mode} />}

      <Card>
        <CardHeader title="Timer preferences" dense />
        <div className="p-4 pt-2 space-y-2">
          <Toggle checked={timer.soundEnabled} onChange={timer.setSound} label="Sound cues"
            description="Countdown beeps at 3, 2, 1 and a tone at the end of each phase." />
          <Toggle checked={timer.vibrateEnabled} onChange={timer.setVibrate} label="Vibration"
            description="Where the device supports it — useful when your phone is in a pocket." />
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Countdown family ---------------- */

const PRESETS: Record<'rest' | 'exercise' | 'interval' | 'hiit', Array<{ label: string; config: IntervalConfig }>> = {
  rest: [
    { label: '60s', config: { work: 60, rest: 0, rounds: 1, prepare: 0, cooldown: 0, label: 'Rest' } },
    { label: '90s', config: { work: 90, rest: 0, rounds: 1, prepare: 0, cooldown: 0, label: 'Rest' } },
    { label: '2 min', config: { work: 120, rest: 0, rounds: 1, prepare: 0, cooldown: 0, label: 'Rest' } },
    { label: '3 min', config: { work: 180, rest: 0, rounds: 1, prepare: 0, cooldown: 0, label: 'Rest' } },
  ],
  exercise: [
    { label: 'Plank 45s', config: { work: 45, rest: 0, rounds: 1, prepare: 5, cooldown: 0, label: 'Hold' } },
    { label: 'Hold 60s', config: { work: 60, rest: 0, rounds: 1, prepare: 5, cooldown: 0, label: 'Hold' } },
    { label: '3 × 30s', config: { work: 30, rest: 30, rounds: 3, prepare: 5, cooldown: 0, label: 'Hold' } },
  ],
  interval: [
    { label: '40/20 × 8', config: { work: 40, rest: 20, rounds: 8, prepare: 10, cooldown: 60, label: 'Work' } },
    { label: '30/30 × 10', config: { work: 30, rest: 30, rounds: 10, prepare: 10, cooldown: 60, label: 'Work' } },
    { label: '60/60 × 6', config: { work: 60, rest: 60, rounds: 6, prepare: 10, cooldown: 90, label: 'Work' } },
  ],
  hiit: [
    { label: 'Tabata 20/10 × 8', config: { work: 20, rest: 10, rounds: 8, prepare: 10, cooldown: 60, label: 'All out' } },
    { label: 'EMOM 60s × 10', config: { work: 60, rest: 0, rounds: 10, prepare: 10, cooldown: 60, label: 'Round' } },
    { label: '45/15 × 12', config: { work: 45, rest: 15, rounds: 12, prepare: 10, cooldown: 90, label: 'Work' } },
  ],
};

interface IntervalConfig {
  work: number;
  rest: number;
  rounds: number;
  prepare: number;
  cooldown: number;
  label: string;
}

function CountdownTimers({ mode }: { mode: 'rest' | 'exercise' | 'interval' | 'hiit' }) {
  const timer = useTimer();
  const [config, setConfig] = useState<IntervalConfig>(PRESETS[mode][0].config);

  const phase = currentPhase(timer);
  const active = timer.mode !== 'idle' && timer.mode !== 'stopwatch' && phase !== null;
  const remaining = remainingMs(timer);
  const seconds = Math.ceil(remaining / 1000);
  const pct = phase && phase.seconds > 0 ? (remaining / (phase.seconds * 1000)) * 100 : 0;

  const plan = buildIntervalPlan({
    workSeconds: config.work,
    restSeconds: config.rest,
    rounds: config.rounds,
    prepareSeconds: config.prepare,
    cooldownSeconds: config.cooldown,
    label: config.label,
  });
  const totalSeconds = totalPlanSeconds(plan);

  const start = () => {
    primeAudio();
    timer.start(plan, { mode, title: config.label });
  };

  const set = (patch: Partial<IntervalConfig>) => setConfig((c) => ({ ...c, ...patch }));

  return (
    <div className="space-y-4">
      <Card className={cn(active && 'border-brand/40')}>
        <div className="p-6 flex flex-col items-center">
          {active && phase ? (
            <>
              <Badge tone={phase.kind === 'rest' ? 'info' : 'brand'}>{phase.label}</Badge>
              {phase.round && phase.totalRounds && (
                <p className="mt-2 text-sm text-ink-3 tabular">Round {phase.round} of {phase.totalRounds}</p>
              )}
              <div className="mt-4">
                <ProgressRing
                  value={pct} size={228} stroke={12}
                  tone={phase.kind === 'rest' ? 'info' : 'brand'}
                  label={`${seconds} seconds remaining`}
                >
                  <span className="text-5xl font-black tabular leading-none">{formatDuration(seconds)}</span>
                  <span className="mt-1.5 text-2xs text-ink-3 uppercase tracking-wide">
                    {timer.running ? 'remaining' : 'paused'}
                  </span>
                </ProgressRing>
              </div>

              <div className="mt-6 flex items-center gap-2.5">
                <Button variant="outline" size="lg" onClick={() => timer.adjust(-15)} icon={<Minus size={16} />}>15s</Button>
                <Button size="lg" className="w-28"
                  onClick={() => (timer.running ? timer.pause() : timer.resume())}
                  icon={timer.running ? <Pause size={18} /> : <Play size={18} />}>
                  {timer.running ? 'Pause' : 'Resume'}
                </Button>
                <Button variant="outline" size="lg" onClick={() => timer.adjust(15)} icon={<Plus size={16} />}>15s</Button>
              </div>

              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => timer.skipPhase()} icon={<SkipForward size={14} />}>Skip phase</Button>
                <Button variant="ghost" size="sm" onClick={() => timer.stop()} icon={<RotateCcw size={14} />}>Stop</Button>
              </div>

              {/* Phase strip */}
              <ol className="mt-6 w-full flex gap-1 overflow-x-auto no-scrollbar" aria-label="Timer phases">
                {timer.plan.map((p, i) => (
                  <li
                    key={p.id}
                    className={cn(
                      'shrink-0 h-1.5 rounded-full transition-colors',
                      p.kind === 'work' ? 'w-8' : 'w-4',
                      i < timer.phaseIndex ? 'bg-brand' : i === timer.phaseIndex ? 'bg-brand animate-pulse' : 'bg-surface-3',
                    )}
                  />
                ))}
              </ol>
            </>
          ) : (
            <>
              <TimerIcon size={30} className="text-ink-3" />
              <p className="mt-4 text-5xl font-black tabular">{formatDuration(config.work)}</p>
              <p className="mt-2 text-sm text-ink-3 tabular">
                Total {formatDuration(totalSeconds)} · {config.rounds} {config.rounds === 1 ? 'round' : 'rounds'}
              </p>
              <Button size="xl" className="mt-6 w-48" onClick={start} icon={<Play size={19} />}>Start</Button>
            </>
          )}
        </div>
      </Card>

      {!active && (
        <>
          <Card>
            <CardHeader title="Presets" dense />
            <div className="p-4 pt-2 flex flex-wrap gap-2">
              {PRESETS[mode].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setConfig(p.config)}
                  className={cn(
                    'h-10 px-4 rounded-xl border text-sm font-medium transition-colors',
                    JSON.stringify(config) === JSON.stringify(p.config)
                      ? 'bg-brand text-brand-contrast border-brand'
                      : 'border-line text-ink-2 hover:border-line-strong',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Custom" dense subtitle="Every value is in seconds" />
            <div className="p-4 pt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Input label="Work" type="number" inputMode="numeric" min={1} value={config.work}
                onChange={(e) => set({ work: Math.max(1, Number(e.target.value) || 1) })} />
              {mode !== 'rest' && (
                <Input label="Rest" type="number" inputMode="numeric" min={0} value={config.rest}
                  onChange={(e) => set({ rest: Math.max(0, Number(e.target.value) || 0) })} />
              )}
              {mode !== 'rest' && (
                <Input label="Rounds" type="number" inputMode="numeric" min={1} max={99} value={config.rounds}
                  onChange={(e) => set({ rounds: Math.max(1, Number(e.target.value) || 1) })} />
              )}
              {(mode === 'interval' || mode === 'hiit' || mode === 'exercise') && (
                <>
                  <Input label="Warm-up" type="number" inputMode="numeric" min={0} value={config.prepare}
                    onChange={(e) => set({ prepare: Math.max(0, Number(e.target.value) || 0) })} />
                  <Input label="Cooldown" type="number" inputMode="numeric" min={0} value={config.cooldown}
                    onChange={(e) => set({ cooldown: Math.max(0, Number(e.target.value) || 0) })} />
                  <Input label="Work label" value={config.label} onChange={(e) => set({ label: e.target.value })} />
                </>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ---------------- Stopwatch ---------------- */

function Stopwatch() {
  const timer = useTimer();
  const elapsed = stopwatchMs(timer);
  const running = timer.mode === 'stopwatch' && timer.running;

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-8 flex flex-col items-center">
          <p className="text-6xl sm:text-7xl font-black tabular leading-none">
            {formatDuration(Math.floor(elapsed / 1000), elapsed >= 3_600_000)}
          </p>
          <p className="mt-2 text-lg text-ink-3 tabular">
            .{String(Math.floor((elapsed % 1000) / 10)).padStart(2, '0')}
          </p>

          <div className="mt-8 flex items-center gap-3">
            {!running ? (
              <Button size="xl" className="w-40" onClick={() => { primeAudio(); timer.startStopwatch(); }} icon={<Play size={19} />}>
                {elapsed > 0 ? 'Resume' : 'Start'}
              </Button>
            ) : (
              <>
                <Button size="xl" variant="outline" className="w-32" onClick={() => timer.lap()} icon={<Flag size={18} />}>Lap</Button>
                <Button size="xl" className="w-32" onClick={() => timer.pause()} icon={<Pause size={18} />}>Pause</Button>
              </>
            )}
            {elapsed > 0 && !running && (
              <Button size="xl" variant="ghost" onClick={() => timer.resetStopwatch()} icon={<RotateCcw size={18} />}>Reset</Button>
            )}
          </div>
        </div>
      </Card>

      {timer.laps.length > 0 && (
        <Card>
          <CardHeader title="Laps" subtitle={`${timer.laps.length} recorded`} />
          <ul className="divide-y divide-line max-h-72 overflow-y-auto">
            {[...timer.laps].reverse().map((lap, i) => (
              <li key={lap.id} className="flex items-center gap-4 px-5 py-2.5 text-sm tabular">
                <span className="w-10 text-ink-3">#{timer.laps.length - i}</span>
                <span className="flex-1 font-semibold">{formatDuration(Math.floor(lap.split / 1000))}</span>
                <span className="text-ink-3">{formatDuration(Math.floor(lap.at / 1000))}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-2xs text-ink-3">
        Useful for runs, walks, rides, planks and anything you want to time without a set structure.
      </p>
    </div>
  );
}
