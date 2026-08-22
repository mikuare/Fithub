import { useEffect, useMemo, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/hooks';

const COLORS = ['#B9F227', '#7C5CFF', '#38BDF8', '#34C77B', '#F5BE3E'];

/** A short, tasteful celebration. Skipped entirely under reduced-motion. */
export function Confetti({ pieces = 60, duration = 2600 }: { pieces?: number; duration?: number }) {
  const reduced = usePrefersReducedMotion();
  const [done, setDone] = useState(false);

  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 700,
        duration: duration * (0.6 + Math.random() * 0.6),
        color: COLORS[i % COLORS.length],
        size: 5 + Math.random() * 6,
        round: Math.random() > 0.6,
      })),
    [pieces, duration],
  );

  useEffect(() => {
    const t = setTimeout(() => setDone(true), duration + 900);
    return () => clearTimeout(t);
  }, [duration]);

  if (reduced || done) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden>
      {bits.map((b) => (
        <span
          key={b.id}
          className="absolute top-0"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size * (b.round ? 1 : 1.8),
            background: b.color,
            borderRadius: b.round ? '50%' : 2,
            animation: `confetti-fall ${b.duration}ms cubic-bezier(.25,.6,.4,1) ${b.delay}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}
