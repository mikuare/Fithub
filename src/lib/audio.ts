/**
 * Timer cues generated with the Web Audio API — no external audio files, so
 * they work offline and add nothing to the bundle.
 */
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Browsers require a user gesture before audio can play — call on first tap. */
export function primeAudio(): void {
  const c = context();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  gain.gain.value = 0;
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.01);
}

function tone(freq: number, durationMs: number, when = 0, volume = 0.18): void {
  const c = context();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

export const cues = {
  countdown: () => tone(760, 130),
  phaseEnd: () => { tone(880, 150); tone(1180, 200, 0.16); },
  workStart: () => { tone(520, 120); tone(780, 180, 0.13); },
  restStart: () => { tone(440, 200); },
  complete: () => { tone(660, 140); tone(880, 140, 0.15); tone(1320, 320, 0.3); },
  record: () => { tone(784, 120); tone(988, 120, 0.12); tone(1319, 400, 0.24, 0.22); },
};

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch { /* unsupported */ }
  }
}
