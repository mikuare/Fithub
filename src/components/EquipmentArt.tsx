import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Equipment } from '@/types';

/* ============================================================
   Equipment illustrations
   Drawn here as inline SVG rather than shipped as images: they
   weigh nothing, they follow the theme, and they still render
   when the device is offline — which is the case this app is
   built for. Schematic on purpose; the written steps carry the
   detail, the drawing only has to say "yes, that is the thing".
   ============================================================ */

/** A spring drawn as a run of half-circles between two x positions. */
function coil(x1: number, x2: number, y: number, turns: number, r = 7) {
  const step = (x2 - x1) / turns;
  let d = `M ${x1} ${y}`;
  for (let i = 0; i < turns; i++) {
    d += ` a ${step / 2} ${r} 0 0 ${i % 2 === 0 ? 1 : 0} ${step} 0`;
  }
  return d;
}

function Art({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 160 100"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Ground line, so every drawing shares a horizon. */}
      <line x1="14" y1="88" x2="146" y2="88" strokeWidth={2} opacity={0.35} />
      {children}
    </svg>
  );
}

function Shapes({ equipment }: { equipment: Equipment }) {
  switch (equipment) {
    case 'dumbbells':
      return (
        <>
          <line x1="52" y1="50" x2="108" y2="50" />
          <rect x="38" y="34" width="12" height="32" rx="4" />
          <rect x="26" y="40" width="10" height="20" rx="3" />
          <rect x="110" y="34" width="12" height="32" rx="4" />
          <rect x="124" y="40" width="10" height="20" rx="3" />
        </>
      );
    case 'barbell':
      return (
        <>
          <line x1="20" y1="50" x2="140" y2="50" />
          <rect x="30" y="32" width="11" height="36" rx="3" />
          <rect x="43" y="38" width="8" height="24" rx="3" />
          <rect x="119" y="32" width="11" height="36" rx="3" />
          <rect x="109" y="38" width="8" height="24" rx="3" />
        </>
      );
    case 'bench':
      return (
        <>
          <rect x="34" y="44" width="92" height="12" rx="6" />
          <path d="M46 56v32M114 56v32M46 88h18M104 88h18" />
        </>
      );
    case 'squat_rack':
      return (
        <>
          <path d="M40 88V26M120 88V26M32 88h16M112 88h16" />
          <path d="M40 40h-8M120 40h8" />
          <line x1="24" y1="40" x2="136" y2="40" />
          <rect x="28" y="30" width="8" height="20" rx="3" />
          <rect x="124" y="30" width="8" height="20" rx="3" />
        </>
      );
    case 'cable':
      return (
        <>
          <path d="M36 88V20h10v68" />
          <circle cx="52" cy="26" r="7" />
          <path d="M59 26c22 0 34 14 34 30" />
          <path d="M86 58h14M93 56v8" />
          <rect x="34" y="60" width="14" height="24" rx="3" opacity={0.6} />
        </>
      );
    case 'smith':
      return (
        <>
          <path d="M42 88V22M118 88V22M34 88h16M110 88h16" />
          <line x1="30" y1="52" x2="130" y2="52" />
          <path d="M42 46l-6 6 6 6M118 46l6 6-6 6" strokeWidth={2} />
        </>
      );
    case 'treadmill':
      return (
        <>
          <path d="M30 78h84l14-30" />
          <path d="M30 78l6-10h78" opacity={0.5} />
          <path d="M114 48V26h18" />
          <rect x="120" y="20" width="22" height="14" rx="3" />
          <path d="M40 88h6M108 88h6" />
        </>
      );
    case 'bike':
      return (
        <>
          <circle cx="44" cy="68" r="18" />
          <circle cx="116" cy="68" r="18" />
          <path d="M44 68l22-32h30l20 32M66 36h26" />
          <path d="M96 36v-8h14M66 36l-6-14h16" />
          <circle cx="80" cy="68" r="6" />
        </>
      );
    case 'bands':
      return (
        <>
          <path d="M40 44c24 22 56 22 80 0" />
          <path d="M40 56c24 22 56 22 80 0" opacity={0.55} />
          <rect x="24" y="34" width="14" height="24" rx="6" />
          <rect x="122" y="34" width="14" height="24" rx="6" />
        </>
      );
    case 'kettlebell':
      return (
        <>
          <circle cx="80" cy="62" r="24" />
          <path d="M64 42c0-14 32-14 32 0" />
          <path d="M64 42q16 8 32 0" opacity={0.5} />
        </>
      );
    case 'pullup_bar':
      return (
        <>
          <path d="M36 88V24M124 88V24M28 88h16M116 88h16" />
          <line x1="28" y1="24" x2="132" y2="24" />
          <path d="M68 24v14M92 24v14" strokeWidth={2} opacity={0.6} />
        </>
      );
    case 'machine':
      return (
        <>
          <path d="M46 88V22h12v66" />
          <path d="M46 34h12M46 44h12M46 54h12M46 64h12" strokeWidth={2} opacity={0.7} />
          <path d="M58 28h34a12 12 0 0 1 12 12v10" />
          <rect x="96" y="52" width="30" height="10" rx="4" />
          <path d="M104 62v20M126 62v20" opacity={0.7} />
        </>
      );
    case 'bodyweight':
      return (
        <>
          <circle cx="80" cy="24" r="9" />
          <path d="M80 33v28M80 40l-22 12M80 40l22 12M80 61l-14 27M80 61l14 27" />
        </>
      );
    case 'medicine_ball':
      return (
        <>
          <circle cx="80" cy="54" r="28" />
          <path d="M52 54h56M80 26v56" opacity={0.55} />
          <path d="M60 34q20 20 40 0M60 74q20-20 40 0" opacity={0.35} strokeWidth={2} />
        </>
      );
    case 'jump_rope':
      return (
        <>
          <path d="M46 40C30 62 46 84 80 84s50-22 34-44" />
          <rect x="38" y="24" width="12" height="22" rx="5" />
          <rect x="110" y="24" width="12" height="22" rx="5" />
        </>
      );
    case 'box':
      return (
        <>
          <path d="M42 48h58v40H42z" />
          <path d="M42 48l16-14h58l-16 14M100 48l16-14v40l-16 14" />
        </>
      );
    case 'rower':
      return (
        <>
          <circle cx="38" cy="58" r="16" />
          <path d="M52 66h84M120 66v14M60 60h20l-4-12" />
          <rect x="72" y="48" width="20" height="8" rx="3" />
          <path d="M54 58h-2M96 62l24-6" opacity={0.7} />
        </>
      );
    case 'ankle_strap':
      return (
        <>
          {/* The cuff, seen from the side, with its D-ring and a clipped cable. */}
          <rect x="46" y="34" width="46" height="34" rx="14" />
          <path d="M46 44h46M46 58h46" strokeWidth={2} opacity={0.45} />
          <path d="M92 46h10a6 6 0 0 1 0 12H92" />
          <path d="M108 52h12" strokeWidth={2} />
          <path d="M120 44c10 4 10 12 0 16" />
          <path d="M46 68l-12 8" strokeWidth={2} opacity={0.7} />
        </>
      );
    case 'power_twister':
      return (
        <>
          {/* Two handles either side of a covered spring. */}
          <rect x="18" y="40" width="26" height="18" rx="9" />
          <rect x="116" y="40" width="26" height="18" rx="9" />
          <path d={coil(44, 116, 49, 8, 9)} />
          <path d="M44 49h4M112 49h4" strokeWidth={2} />
        </>
      );
    case 'ab_wheel':
      return (
        <>
          <circle cx="80" cy="60" r="24" />
          <circle cx="80" cy="60" r="7" opacity={0.6} />
          <line x1="42" y1="60" x2="118" y2="60" />
          <rect x="30" y="52" width="14" height="16" rx="6" />
          <rect x="116" y="52" width="14" height="16" rx="6" />
        </>
      );
    case 'suspension':
      return (
        <>
          <line x1="34" y1="18" x2="126" y2="18" />
          <path d="M80 18v14M80 32l-22 26M80 32l22 26" />
          <rect x="46" y="58" width="22" height="9" rx="4" />
          <rect x="92" y="58" width="22" height="9" rx="4" />
          <path d="M57 67v10M103 67v10" strokeWidth={2} opacity={0.6} />
        </>
      );
    case 'foam_roller':
      return (
        <>
          <path d="M50 38h60M50 74h60" />
          <ellipse cx="50" cy="56" rx="10" ry="18" />
          <path d="M110 38a10 18 0 0 1 0 36" />
          <circle cx="50" cy="56" r="4" opacity={0.55} />
        </>
      );
    case 'stability_ball':
      return (
        <>
          <circle cx="80" cy="54" r="32" />
          <path d="M80 22c-14 12-14 52 0 64M80 22c14 12 14 52 0 64" opacity={0.4} strokeWidth={2} />
        </>
      );
    case 'dip_bars':
      return (
        <>
          <path d="M40 44h34M86 44h34" />
          <path d="M46 44v44M114 44v44M38 88h16M106 88h16" />
          <path d="M46 62h14M100 62h14" strokeWidth={2} opacity={0.5} />
        </>
      );
    case 'elliptical':
      return (
        <>
          <circle cx="46" cy="52" r="16" />
          <path d="M60 58l52 18M60 66l52 18" />
          <path d="M100 76h22M104 84h22" strokeWidth={2} opacity={0.6} />
          <path d="M46 36V22h56v34" />
        </>
      );
    case 'mat':
      return (
        <>
          <path d="M44 76h72" />
          <path d="M44 76a10 10 0 0 1 0-20h60" />
          <circle cx="52" cy="66" r="5" opacity={0.6} />
          <path d="M104 56h12v20h-12" opacity={0.5} />
        </>
      );
    case 'hand_gripper':
      return (
        <>
          <path d="M40 30l46 22M40 74l46-22" />
          <path d={coil(86, 118, 52, 4, 7)} />
          <circle cx="86" cy="52" r="4" />
        </>
      );
    default:
      return <circle cx="80" cy="54" r="26" />;
  }
}

export function EquipmentArt({ equipment, className }: { equipment: Equipment; className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-brand/25 bg-gradient-to-br from-brand-soft/60 to-surface-2 text-brand-text',
        className,
      )}
    >
      <Art>
        <Shapes equipment={equipment} />
      </Art>
    </div>
  );
}
