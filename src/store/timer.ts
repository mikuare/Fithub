import { create } from 'zustand';
import { cues, vibrate } from '@/lib/audio';
import { uid } from '@/lib/id';

export type PhaseKind = 'prepare' | 'work' | 'rest' | 'cooldown';

export interface Phase {
  id: string;
  label: string;
  kind: PhaseKind;
  seconds: number;
  /** Round number this phase belongs to, for "Round 3 of 8" readouts. */
  round?: number;
  totalRounds?: number;
}

export type TimerMode = 'idle' | 'rest' | 'exercise' | 'interval' | 'hiit' | 'stopwatch';

interface Lap { id: string; at: number; split: number }

interface TimerState {
  mode: TimerMode;
  title: string;
  plan: Phase[];
  phaseIndex: number;
  /** Wall-clock epoch ms when the current phase ends. Null while paused. */
  phaseEndsAt: number | null;
  /** Remaining ms captured at the moment of pausing. */
  pausedRemaining: number | null;
  running: boolean;
  /** Ticks purely to re-render consumers; all maths uses Date.now(). */
  now: number;

  stopwatchStartedAt: number | null;
  stopwatchAccumulated: number;
  laps: Lap[];

  soundEnabled: boolean;
  vibrateEnabled: boolean;
  /** Fires when the whole plan finishes — used to auto-advance workout sets. */
  onComplete: (() => void) | null;

  start: (plan: Phase[], opts?: { mode?: TimerMode; title?: string; onComplete?: () => void }) => void;
  startRest: (seconds: number, onComplete?: () => void) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  adjust: (deltaSeconds: number) => void;
  skipPhase: () => void;
  previousPhase: () => void;

  startStopwatch: () => void;
  lap: () => void;
  resetStopwatch: () => void;

  setSound: (on: boolean) => void;
  setVibrate: (on: boolean) => void;
  tick: () => void;
}

const NEAR_END_CUES = new Set([3, 2, 1]);
let lastCueSecond = -1;
let interval: ReturnType<typeof setInterval> | null = null;
let wakeLock: WakeLockSentinel | null = null;
/** Mirrors the user's "keep screen awake during timers" preference. */
let keepAwakeEnabled = true;

export function setKeepAwake(enabled: boolean) {
  keepAwakeEnabled = enabled;
  if (!enabled) releaseWakeLock();
}

async function requestWakeLock() {
  if (!keepAwakeEnabled) return;
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { /* not supported or denied — timers still work */ }
}

function releaseWakeLock() {
  try { void wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}

function ensureTicking(tick: () => void) {
  if (interval) return;
  interval = setInterval(tick, 200);
}

function stopTicking() {
  if (interval) { clearInterval(interval); interval = null; }
}

export const useTimer = create<TimerState>((set, get) => ({
  mode: 'idle',
  title: '',
  plan: [],
  phaseIndex: 0,
  phaseEndsAt: null,
  pausedRemaining: null,
  running: false,
  now: Date.now(),
  stopwatchStartedAt: null,
  stopwatchAccumulated: 0,
  laps: [],
  soundEnabled: true,
  vibrateEnabled: true,
  onComplete: null,

  start: (plan, opts = {}) => {
    if (!plan.length) return;
    lastCueSecond = -1;
    void requestWakeLock();
    set({
      mode: opts.mode ?? 'interval',
      title: opts.title ?? '',
      plan,
      phaseIndex: 0,
      phaseEndsAt: Date.now() + plan[0].seconds * 1000,
      pausedRemaining: null,
      running: true,
      onComplete: opts.onComplete ?? null,
      now: Date.now(),
    });
    ensureTicking(get().tick);
    if (get().soundEnabled) cues.workStart();
  },

  startRest: (seconds, onComplete) => {
    get().start(
      [{ id: uid('ph'), label: 'Rest', kind: 'rest', seconds }],
      { mode: 'rest', title: 'Rest', onComplete },
    );
  },

  pause: () => {
    const { phaseEndsAt, running } = get();
    if (!running || phaseEndsAt === null) return;
    stopTicking();
    releaseWakeLock();
    set({ running: false, pausedRemaining: Math.max(0, phaseEndsAt - Date.now()), phaseEndsAt: null });
  },

  resume: () => {
    const { pausedRemaining } = get();
    if (pausedRemaining === null) return;
    void requestWakeLock();
    set({ running: true, phaseEndsAt: Date.now() + pausedRemaining, pausedRemaining: null, now: Date.now() });
    ensureTicking(get().tick);
  },

  stop: () => {
    stopTicking();
    releaseWakeLock();
    set({ mode: 'idle', plan: [], phaseIndex: 0, phaseEndsAt: null, pausedRemaining: null, running: false, onComplete: null, title: '' });
  },

  adjust: (deltaSeconds) => {
    const { phaseEndsAt, pausedRemaining, running, plan, phaseIndex } = get();
    const delta = deltaSeconds * 1000;
    if (running && phaseEndsAt !== null) {
      set({ phaseEndsAt: Math.max(Date.now(), phaseEndsAt + delta) });
    } else if (pausedRemaining !== null) {
      set({ pausedRemaining: Math.max(0, pausedRemaining + delta) });
    }
    // Keep the phase definition in step so a "+15s" survives a skip-back.
    const next = [...plan];
    if (next[phaseIndex]) {
      next[phaseIndex] = { ...next[phaseIndex], seconds: Math.max(0, next[phaseIndex].seconds + deltaSeconds) };
      set({ plan: next });
    }
  },

  skipPhase: () => {
    const { plan, phaseIndex, onComplete, soundEnabled, vibrateEnabled } = get();
    lastCueSecond = -1;
    const nextIndex = phaseIndex + 1;
    if (nextIndex >= plan.length) {
      stopTicking();
      releaseWakeLock();
      if (soundEnabled) cues.complete();
      if (vibrateEnabled) vibrate([90, 60, 90]);
      set({ mode: 'idle', plan: [], phaseIndex: 0, phaseEndsAt: null, pausedRemaining: null, running: false, onComplete: null });
      onComplete?.();
      return;
    }
    set({
      phaseIndex: nextIndex,
      phaseEndsAt: Date.now() + plan[nextIndex].seconds * 1000,
      pausedRemaining: null,
      running: true,
    });
    ensureTicking(get().tick);
    if (soundEnabled) plan[nextIndex].kind === 'rest' ? cues.restStart() : cues.workStart();
    if (vibrateEnabled) vibrate(60);
  },

  previousPhase: () => {
    const { plan, phaseIndex } = get();
    const prev = Math.max(0, phaseIndex - 1);
    lastCueSecond = -1;
    set({ phaseIndex: prev, phaseEndsAt: Date.now() + plan[prev].seconds * 1000, pausedRemaining: null, running: true });
    ensureTicking(get().tick);
  },

  startStopwatch: () => {
    void requestWakeLock();
    set({ mode: 'stopwatch', running: true, stopwatchStartedAt: Date.now(), now: Date.now() });
    ensureTicking(get().tick);
  },

  lap: () => {
    const { stopwatchStartedAt, stopwatchAccumulated, laps } = get();
    const total = stopwatchAccumulated + (stopwatchStartedAt ? Date.now() - stopwatchStartedAt : 0);
    const previous = laps.reduce((a, l) => a + l.split, 0);
    set({ laps: [...laps, { id: uid('lap'), at: total, split: total - previous }] });
  },

  resetStopwatch: () => {
    stopTicking();
    releaseWakeLock();
    set({ mode: 'idle', running: false, stopwatchStartedAt: null, stopwatchAccumulated: 0, laps: [] });
  },

  setSound: (on) => set({ soundEnabled: on }),
  setVibrate: (on) => set({ vibrateEnabled: on }),

  tick: () => {
    const s = get();
    const now = Date.now();
    set({ now });

    if (s.mode === 'stopwatch') return;
    if (!s.running || s.phaseEndsAt === null) return;

    const remaining = s.phaseEndsAt - now;
    const secondsLeft = Math.ceil(remaining / 1000);

    if (secondsLeft !== lastCueSecond && NEAR_END_CUES.has(secondsLeft) && remaining > 0) {
      lastCueSecond = secondsLeft;
      if (s.soundEnabled) cues.countdown();
      if (s.vibrateEnabled) vibrate(30);
    }

    if (remaining <= 0) {
      if (s.soundEnabled) cues.phaseEnd();
      if (s.vibrateEnabled) vibrate([80, 40, 80]);
      get().skipPhase();
    }
  },
}));

/* ---------------- derived helpers ---------------- */

export function currentPhase(s: Pick<TimerState, 'plan' | 'phaseIndex'>): Phase | null {
  return s.plan[s.phaseIndex] ?? null;
}

export function remainingMs(s: Pick<TimerState, 'phaseEndsAt' | 'pausedRemaining' | 'running' | 'now'>): number {
  if (s.pausedRemaining !== null) return s.pausedRemaining;
  if (s.phaseEndsAt === null) return 0;
  return Math.max(0, s.phaseEndsAt - s.now);
}

export function stopwatchMs(s: Pick<TimerState, 'stopwatchStartedAt' | 'stopwatchAccumulated' | 'now'>): number {
  return s.stopwatchAccumulated + (s.stopwatchStartedAt ? s.now - s.stopwatchStartedAt : 0);
}

export function totalPlanSeconds(plan: Phase[]): number {
  return plan.reduce((a, p) => a + p.seconds, 0);
}

/* ---------------- plan builders ---------------- */

export function buildIntervalPlan(opts: {
  workSeconds: number; restSeconds: number; rounds: number;
  prepareSeconds?: number; cooldownSeconds?: number; label?: string;
}): Phase[] {
  const plan: Phase[] = [];
  if (opts.prepareSeconds) plan.push({ id: uid('ph'), label: 'Get ready', kind: 'prepare', seconds: opts.prepareSeconds });
  for (let r = 1; r <= opts.rounds; r++) {
    plan.push({ id: uid('ph'), label: opts.label ?? 'Work', kind: 'work', seconds: opts.workSeconds, round: r, totalRounds: opts.rounds });
    if (opts.restSeconds > 0 && r < opts.rounds) {
      plan.push({ id: uid('ph'), label: 'Rest', kind: 'rest', seconds: opts.restSeconds, round: r, totalRounds: opts.rounds });
    }
  }
  if (opts.cooldownSeconds) plan.push({ id: uid('ph'), label: 'Cool down', kind: 'cooldown', seconds: opts.cooldownSeconds });
  return plan;
}
