import { Link } from 'react-router-dom';
import { Play, Timer as TimerIcon } from 'lucide-react';
import type { WorkoutSession } from '@/types';
import { useNow } from '@/lib/hooks';
import { formatDuration } from '@/lib/utils';
import { currentPhase, remainingMs, useTimer } from '@/store/timer';

/** Persistent bar so an in-progress session is never lost by navigating away. */
export function ActiveWorkoutBar({ session }: { session: WorkoutSession }) {
  const now = useNow(1000);
  const timer = useTimer();
  const phase = currentPhase(timer);
  const elapsed = session.started_at ? Math.floor((now - new Date(session.started_at).getTime()) / 1000) : 0;
  const restRemaining = phase && timer.mode !== 'stopwatch' ? Math.ceil(remainingMs(timer) / 1000) : null;

  return (
    <div className="sticky top-16 z-10 bg-brand text-brand-contrast">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-11 flex items-center gap-3 text-sm">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand-contrast/60 animate-pulse-ring" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-contrast" />
        </span>
        <span className="font-semibold truncate">{session.title} in progress</span>
        <span className="tabular font-mono opacity-80">{formatDuration(elapsed)}</span>
        {restRemaining !== null && phase && (
          <span className="hidden sm:inline-flex items-center gap-1.5 opacity-90">
            <TimerIcon size={14} />
            <span className="tabular font-mono">{phase.label} {formatDuration(restRemaining)}</span>
          </span>
        )}
        <span className="flex-1" />
        <Link
          to="/workout/live"
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-brand-contrast/15 hover:bg-brand-contrast/25 font-semibold transition-colors"
        >
          <Play size={13} /> Resume
        </Link>
      </div>
    </div>
  );
}
