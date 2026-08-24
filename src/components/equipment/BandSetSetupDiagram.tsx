import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ============================================================
   Band-set setup diagram
   The rigging steps drawn rather than described, because "push
   the anchor through so the ball sits on the far side" is a
   sentence people read twice and still get wrong. Inline SVG for
   the same reasons the rest of the equipment art is: it follows
   the theme, it costs nothing to ship, and it still renders in a
   spare room with no signal.
   ============================================================ */

function Panel({ n, label, caption, tone = 'brand', children }: {
  n: number;
  label: string;
  caption: string;
  tone?: 'brand' | 'warn';
  children: ReactNode;
}) {
  return (
    <li className={cn(
      'rounded-xl border bg-surface-2/50 p-3',
      tone === 'warn' ? 'border-warn/40' : 'border-line',
    )}>
      <div className={cn(
        'relative overflow-hidden rounded-lg border',
        tone === 'warn'
          ? 'border-warn/25 bg-warn-soft/25 text-warn'
          : 'border-brand/20 bg-brand-soft/25 text-brand-text',
      )}>
        <svg
          viewBox="0 0 120 90"
          className="h-full w-full"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          role="img"
          aria-label={`Step ${n}: ${label}. ${caption}`}
        >
          {children}
        </svg>
      </div>
      <p className="mt-2 flex items-center gap-1.5">
        <span className={cn(
          'h-5 w-5 shrink-0 rounded-full grid place-items-center text-2xs font-bold tabular',
          tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-brand-soft text-brand-text',
        )}>
          {n}
        </span>
        <span className="text-xs font-semibold leading-tight">{label}</span>
      </p>
      <p className="mt-1 text-2xs text-ink-3 leading-relaxed">{caption}</p>
    </li>
  );
}

export function BandSetSetupDiagram({ className }: { className?: string }) {
  return (
    <section className={className} aria-label="How to set up an 11-piece resistance band set, in five steps">
      <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <Panel n={1} label="Check every tube" caption="Hold it to the light. Nicks, splits or cloudy patches near the clip mean bin it — a tube that snaps whips back at head height.">
          <path d="M10 52q20-20 38-6t30 4 32-18" />
          <circle cx="58" cy="34" r="15" strokeWidth={2.5} />
          <path d="M69 45l12 12" strokeWidth={2.5} />
          {/* The split you are looking for. */}
          <path d="M52 44l5 6M60 41l4 7" strokeWidth={2} />
        </Panel>

        <Panel n={2} label="Stack for the load you want" caption="Clip extra tubes onto the same handle. Five stack together — the poundage is printed on each clip.">
          {/* Handle, then a fan of three tubes clipped into it. */}
          <path d="M22 26q16 6 16 20t-16 18" />
          <circle cx="42" cy="45" r="5" strokeWidth={2.5} />
          <path d="M47 45q28-14 62-20" />
          <path d="M47 45h62" opacity={0.6} />
          <path d="M47 45q28 14 62 20" opacity={0.35} />
        </Panel>

        <Panel n={3} label="Ball goes through, to the far side" caption="Push the foam stopper right through the gap so it lies flat against the outside face of the door. The strap comes back to you.">
          {/* Door slab in section, with the anchor threaded through it. */}
          <path d="M46 6v78" strokeWidth={4} />
          <circle cx="32" cy="36" r="8" />
          <path d="M40 36h6" strokeWidth={2.5} />
          <path d="M46 36h24" />
          <circle cx="76" cy="36" r="6" strokeWidth={2.5} />
          <path d="M82 36q22 6 30 22" />
        </Panel>

        <Panel n={4} label="The door must open away" caption="Anchored on the pull side, the door flies open into your face. Close it, check the swing, and lock it if you can." tone="warn">
          <path d="M40 8v74" strokeWidth={4} />
          <path d="M40 20q26 6 34 26" strokeWidth={2.5} opacity={0.6} />
          {/* Swing arrow, pointing away from the person. */}
          <path d="M52 62q16 4 26-8" strokeWidth={2.5} />
          <path d="M72 52l8 2-3 8" strokeWidth={2.5} />
          {/* The person, standing clear of the line of the tube. */}
          <circle cx="96" cy="34" r="6" strokeWidth={2.5} />
          <path d="M96 40v16M96 44l-8 6M96 44l8 6M96 56l-6 14M96 56l6 14" strokeWidth={2.5} />
        </Panel>

        <Panel n={5} label="Step back until it is already tight" caption="Take up the slack before the first rep. A band with slack does nothing for the first third of the movement.">
          <path d="M12 8v74" strokeWidth={4} />
          <path d="M12 30h74" />
          <circle cx="92" cy="30" r="5" strokeWidth={2.5} />
          {/* Split stance braced against the pull. */}
          <circle cx="98" cy="20" r="6" strokeWidth={2.5} />
          <path d="M98 26v18M98 30l-8 2M98 44l-10 20M98 44l10 20" strokeWidth={2.5} />
          <path d="M84 78h34" strokeWidth={2} opacity={0.35} />
        </Panel>
      </ol>
    </section>
  );
}
