import { Minus, Plus, SkipForward, Pause, Play } from 'lucide-react';
import { currentPhase, remainingMs, useTimer } from '@/store/timer';
import { formatDuration } from '@/lib/utils';
import { ProgressRing } from '@/components/ui/Progress';

/** Full-bleed rest screen: one glance, one thumb, no hunting for controls. */
export function RestOverlay({ nextLabel }: { nextLabel?: string }) {
  const timer = useTimer();
  const phase = currentPhase(timer);
  if (!phase || timer.mode === 'idle' || timer.mode === 'stopwatch') return null;

  const remaining = remainingMs(timer);
  const seconds = Math.ceil(remaining / 1000);
  const pct = phase.seconds > 0 ? (remaining / (phase.seconds * 1000)) * 100 : 0;
  const isRest = phase.kind === 'rest';

  return (
    <div
      className="fixed inset-0 z-40 bg-bg/97 backdrop-blur-md flex flex-col items-center justify-center px-6 pb-safe animate-fade-in"
      role="dialog"
      aria-label={`${phase.label} timer`}
    >
      <p className="text-xs font-bold uppercase tracking-widest text-ink-3">{phase.label}</p>
      {phase.round && phase.totalRounds && (
        <p className="mt-1 text-sm text-ink-3 tabular">Round {phase.round} of {phase.totalRounds}</p>
      )}

      <div className="mt-6">
        <ProgressRing
          value={pct}
          size={248}
          stroke={12}
          tone={isRest ? 'info' : 'brand'}
          label={`${seconds} seconds remaining`}
        >
          <span className="text-6xl font-black tabular leading-none" aria-live="off">
            {formatDuration(seconds)}
          </span>
          <span className="mt-2 text-xs text-ink-3 uppercase tracking-wide">
            {timer.running ? 'remaining' : 'paused'}
          </span>
        </ProgressRing>
      </div>

      {nextLabel && (
        <p className="mt-6 text-sm text-ink-3 text-center">
          Up next: <span className="font-semibold text-ink-2">{nextLabel}</span>
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={() => timer.adjust(-15)}
          aria-label="Subtract 15 seconds"
          className="h-14 px-5 rounded-2xl border border-line bg-surface text-ink font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Minus size={16} /> 15s
        </button>

        <button
          type="button"
          onClick={() => (timer.running ? timer.pause() : timer.resume())}
          aria-label={timer.running ? 'Pause timer' : 'Resume timer'}
          className="h-16 w-16 rounded-full bg-surface-2 border border-line grid place-items-center active:scale-95 transition-transform"
        >
          {timer.running ? <Pause size={22} /> : <Play size={22} />}
        </button>

        <button
          type="button"
          onClick={() => timer.adjust(15)}
          aria-label="Add 15 seconds"
          className="h-14 px-5 rounded-2xl border border-line bg-surface text-ink font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus size={16} /> 15s
        </button>
      </div>

      <button
        type="button"
        onClick={() => timer.skipPhase()}
        className="mt-6 h-12 px-6 rounded-2xl bg-brand text-brand-contrast font-bold flex items-center gap-2 active:scale-95 transition-transform"
      >
        <SkipForward size={17} /> Skip rest
      </button>
    </div>
  );
}
