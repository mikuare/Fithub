import { useMemo } from 'react';
import type { MuscleGroup } from '@/types';
import { cn } from '@/lib/utils';
import { statusForFreshness, FRESHNESS_STATUS_META } from '@/lib/fitness/freshness';
import { MUSCLE_LABEL } from '@/data/exercises';

/**
 * Anatomical muscle map rendered as inline SVG.
 *
 * Every exercise page gets a real illustration without shipping images: the
 * shapes are keyed by muscle group, so the same component serves the library,
 * the workout screen and the weekly-balance chart. With the `heat` prop it
 * doubles as the Body Map's freshness heat map, colouring each muscle by its
 * recovery status; `markers` outlines muscles with a logged niggle, and
 * `onSelectMuscle` makes every region a keyboard-reachable button.
 */

type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotate?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number }
  | { kind: 'path'; d: string };

interface Region {
  muscle: MuscleGroup | 'neutral';
  shapes: Shape[];
}

const mirror = (s: Shape): Shape => {
  if (s.kind === 'ellipse') return { ...s, cx: 120 - s.cx, rotate: s.rotate ? -s.rotate : undefined };
  if (s.kind === 'rect') return { ...s, x: 120 - s.x - s.w };
  return s;
};

const FRONT: Region[] = [
  { muscle: 'neutral', shapes: [
    { kind: 'ellipse', cx: 60, cy: 19, rx: 11.5, ry: 13.5 },
    { kind: 'rect', x: 54, y: 30, w: 12, h: 9, r: 4 },
    { kind: 'path', d: 'M44 110 H76 L78 128 Q60 133 42 128 Z' },
    { kind: 'ellipse', cx: 49, cy: 181, rx: 9, ry: 7 },
    { kind: 'ellipse', cx: 71, cy: 181, rx: 9, ry: 7 },
    { kind: 'ellipse', cx: 48, cy: 233, rx: 7.5, ry: 6 },
    { kind: 'ellipse', cx: 72, cy: 233, rx: 7.5, ry: 6 },
    { kind: 'ellipse', cx: 22, cy: 126, rx: 6, ry: 7 },
    { kind: 'ellipse', cx: 98, cy: 126, rx: 6, ry: 7 },
  ] },
  { muscle: 'traps', shapes: [{ kind: 'path', d: 'M46 40 Q60 34 74 40 L82 48 Q60 44 38 48 Z' }] },
  { muscle: 'shoulders', shapes: [
    { kind: 'ellipse', cx: 34, cy: 55, rx: 11, ry: 10 },
    mirror({ kind: 'ellipse', cx: 34, cy: 55, rx: 11, ry: 10 }),
  ] },
  { muscle: 'chest', shapes: [
    { kind: 'path', d: 'M45 50 Q56 47 58 50 V70 Q49 72 43 63 Q41 55 45 50 Z' },
    { kind: 'path', d: 'M75 50 Q64 47 62 50 V70 Q71 72 77 63 Q79 55 75 50 Z' },
  ] },
  { muscle: 'biceps', shapes: [
    { kind: 'ellipse', cx: 28, cy: 76, rx: 7.5, ry: 15 },
    mirror({ kind: 'ellipse', cx: 28, cy: 76, rx: 7.5, ry: 15 }),
  ] },
  { muscle: 'forearms', shapes: [
    { kind: 'ellipse', cx: 24, cy: 105, rx: 6.5, ry: 16 },
    mirror({ kind: 'ellipse', cx: 24, cy: 105, rx: 6.5, ry: 16 }),
  ] },
  { muscle: 'core', shapes: [{ kind: 'rect', x: 51, y: 72, w: 18, h: 38, r: 6 }] },
  { muscle: 'obliques', shapes: [
    { kind: 'path', d: 'M43 68 Q48 76 49 106 L44 108 Q40 88 43 68 Z' },
    { kind: 'path', d: 'M77 68 Q72 76 71 106 L76 108 Q80 88 77 68 Z' },
  ] },
  { muscle: 'quads', shapes: [
    { kind: 'ellipse', cx: 49, cy: 152, rx: 12.5, ry: 27 },
    mirror({ kind: 'ellipse', cx: 49, cy: 152, rx: 12.5, ry: 27 }),
  ] },
  { muscle: 'calves', shapes: [
    { kind: 'ellipse', cx: 48, cy: 208, rx: 8.5, ry: 20 },
    mirror({ kind: 'ellipse', cx: 48, cy: 208, rx: 8.5, ry: 20 }),
  ] },
];

const BACK: Region[] = [
  { muscle: 'neutral', shapes: [
    { kind: 'ellipse', cx: 60, cy: 19, rx: 11.5, ry: 13.5 },
    { kind: 'rect', x: 54, y: 30, w: 12, h: 9, r: 4 },
    { kind: 'ellipse', cx: 49, cy: 181, rx: 9, ry: 7 },
    { kind: 'ellipse', cx: 71, cy: 181, rx: 9, ry: 7 },
    { kind: 'ellipse', cx: 48, cy: 233, rx: 7.5, ry: 6 },
    { kind: 'ellipse', cx: 72, cy: 233, rx: 7.5, ry: 6 },
    { kind: 'ellipse', cx: 22, cy: 126, rx: 6, ry: 7 },
    { kind: 'ellipse', cx: 98, cy: 126, rx: 6, ry: 7 },
  ] },
  { muscle: 'traps', shapes: [{ kind: 'path', d: 'M45 40 Q60 34 75 40 L84 52 Q60 46 36 52 Z M50 52 Q60 50 70 52 L64 74 H56 Z' }] },
  { muscle: 'shoulders', shapes: [
    { kind: 'ellipse', cx: 34, cy: 55, rx: 11, ry: 10 },
    mirror({ kind: 'ellipse', cx: 34, cy: 55, rx: 11, ry: 10 }),
  ] },
  { muscle: 'lats', shapes: [
    { kind: 'path', d: 'M42 56 Q52 60 54 76 L52 98 Q42 90 39 74 Q38 62 42 56 Z' },
    { kind: 'path', d: 'M78 56 Q68 60 66 76 L68 98 Q78 90 81 74 Q82 62 78 56 Z' },
  ] },
  { muscle: 'back', shapes: [{ kind: 'path', d: 'M54 60 H66 V92 H54 Z' }] },
  { muscle: 'triceps', shapes: [
    { kind: 'ellipse', cx: 28, cy: 76, rx: 7.5, ry: 15 },
    mirror({ kind: 'ellipse', cx: 28, cy: 76, rx: 7.5, ry: 15 }),
  ] },
  { muscle: 'forearms', shapes: [
    { kind: 'ellipse', cx: 24, cy: 105, rx: 6.5, ry: 16 },
    mirror({ kind: 'ellipse', cx: 24, cy: 105, rx: 6.5, ry: 16 }),
  ] },
  { muscle: 'lower_back', shapes: [{ kind: 'rect', x: 50, y: 94, w: 20, h: 20, r: 6 }] },
  { muscle: 'glutes', shapes: [
    { kind: 'ellipse', cx: 51, cy: 126, rx: 13, ry: 13 },
    mirror({ kind: 'ellipse', cx: 51, cy: 126, rx: 13, ry: 13 }),
  ] },
  { muscle: 'hamstrings', shapes: [
    { kind: 'ellipse', cx: 49, cy: 156, rx: 12.5, ry: 24 },
    mirror({ kind: 'ellipse', cx: 49, cy: 156, rx: 12.5, ry: 24 }),
  ] },
  { muscle: 'calves', shapes: [
    { kind: 'ellipse', cx: 48, cy: 208, rx: 8.5, ry: 20 },
    mirror({ kind: 'ellipse', cx: 48, cy: 208, rx: 8.5, ry: 20 }),
  ] },
];

/** Muscles that stand in for a whole-view highlight. */
const FULL_BODY: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings',
  'glutes', 'calves', 'core', 'lats', 'traps', 'obliques', 'lower_back', 'forearms',
];

function renderShape(shape: Shape, key: string, fill: string, stroke: string, strokeWidth: number) {
  // `key` is passed explicitly rather than spread: React 18 warns when a key
  // arrives via a spread object, and the warning is a real correctness signal.
  const paint = { fill, stroke, strokeWidth, vectorEffect: 'non-scaling-stroke' as const };
  if (shape.kind === 'ellipse') {
    return (
      <ellipse
        key={key}
        {...paint}
        cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry}
        transform={shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : undefined}
      />
    );
  }
  if (shape.kind === 'rect') {
    return <rect key={key} {...paint} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} />;
  }
  return <path key={key} {...paint} d={shape.d} />;
}

export function MuscleMap({
  primary = [], secondary = [], view = 'both', size = 150, className, showLabels,
  heat, markers, selectedMuscle, onSelectMuscle,
}: {
  primary?: MuscleGroup[];
  secondary?: MuscleGroup[];
  view?: 'front' | 'back' | 'both';
  size?: number;
  className?: string;
  showLabels?: boolean;
  /** Freshness 0–100 per muscle. When present it replaces primary/secondary colouring. */
  heat?: Partial<Record<MuscleGroup, number>>;
  /** Muscles with an active niggle — drawn with a dashed outline. */
  markers?: MuscleGroup[];
  selectedMuscle?: MuscleGroup | null;
  /** Makes each muscle region a focusable button. */
  onSelectMuscle?: (muscle: MuscleGroup) => void;
}) {
  const { primarySet, secondarySet } = useMemo(() => {
    const expand = (list: MuscleGroup[]) => {
      const out = new Set<MuscleGroup>();
      for (const m of list) {
        if (m === 'full_body' || m === 'cardio') FULL_BODY.forEach((x) => out.add(x));
        else out.add(m);
        // "back" and "lats" read as one region to a non-specialist.
        if (m === 'back') out.add('lats');
        if (m === 'lats') out.add('back');
      }
      return out;
    };
    return { primarySet: expand(primary), secondarySet: expand(secondary) };
  }, [primary, secondary]);

  const views: Array<{ key: 'front' | 'back'; regions: Region[]; label: string }> =
    view === 'both'
      ? [{ key: 'front', regions: FRONT, label: 'Front' }, { key: 'back', regions: BACK, label: 'Back' }]
      : view === 'front'
        ? [{ key: 'front', regions: FRONT, label: 'Front' }]
        : [{ key: 'back', regions: BACK, label: 'Back' }];

  const markerSet = useMemo(() => new Set(markers ?? []), [markers]);

  const describe = heat
    ? 'Body heat map — each muscle coloured by how recovered it is'
    : [
        primary.length ? `Primary muscles: ${primary.join(', ')}` : '',
        secondary.length ? `Secondary: ${secondary.join(', ')}` : '',
      ].filter(Boolean).join('. ');

  return (
    <div className={cn('flex items-end justify-center gap-2', className)}>
      {views.map((v) => (
        <figure key={v.key} className="flex flex-col items-center">
          <svg
            viewBox="0 0 120 250"
            width={size}
            height={size * (250 / 120)}
            role="img"
            aria-label={describe || 'Muscle map'}
            className="overflow-visible"
          >
            {v.regions.map((region) => {
              let fill: string;
              let stroke: string;
              let strokeWidth: number;
              let statusLabel = '';

              if (heat) {
                const value = region.muscle === 'neutral' ? undefined : heat[region.muscle];
                if (value === undefined) {
                  fill = 'rgb(var(--c-surface-3))';
                  stroke = 'rgb(var(--c-line-strong) / 0.7)';
                  strokeWidth = 0.8;
                } else {
                  const status = statusForFreshness(value);
                  statusLabel = FRESHNESS_STATUS_META[status].label;
                  const tone = status === 'fresh' ? 'success' : status === 'recovering' ? 'warn' : 'danger';
                  const alpha = status === 'fresh' ? 0.4 : status === 'recovering' ? 0.65 : 0.8;
                  fill = `rgb(var(--c-${tone}) / ${alpha})`;
                  stroke = `rgb(var(--c-${tone}) / 0.85)`;
                  strokeWidth = 1;
                }
              } else {
                const isPrimary = region.muscle !== 'neutral' && primarySet.has(region.muscle);
                const isSecondary = !isPrimary && region.muscle !== 'neutral' && secondarySet.has(region.muscle);
                fill = isPrimary
                  ? 'rgb(var(--c-brand) / 0.95)'
                  : isSecondary
                    ? 'rgb(var(--c-brand) / 0.34)'
                    : 'rgb(var(--c-surface-3))';
                stroke = isPrimary || isSecondary ? 'rgb(var(--c-brand) / 0.65)' : 'rgb(var(--c-line-strong) / 0.7)';
                strokeWidth = isPrimary ? 1.2 : 0.8;
              }

              const marked = region.muscle !== 'neutral' && markerSet.has(region.muscle);
              const selected = region.muscle !== 'neutral' && selectedMuscle === region.muscle;
              if (selected) {
                stroke = 'rgb(var(--c-brand))';
                strokeWidth = 2;
              } else if (marked) {
                stroke = 'rgb(var(--c-danger))';
                strokeWidth = 1.6;
              }

              const interactive = !!onSelectMuscle && region.muscle !== 'neutral';
              const shapes = region.shapes.map((shape, i) =>
                renderShape(shape, `${v.key}-${region.muscle}-${i}`, fill, stroke, strokeWidth),
              );
              if (!interactive) {
                return (
                  <g key={`${v.key}-${region.muscle}`} strokeDasharray={marked ? '3 2' : undefined}>
                    {shapes}
                  </g>
                );
              }
              const muscle = region.muscle as MuscleGroup;
              const label = [
                MUSCLE_LABEL[muscle] ?? muscle,
                statusLabel,
                marked ? 'niggle logged' : '',
              ].filter(Boolean).join(' — ');
              return (
                <g
                  key={`${v.key}-${region.muscle}`}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  aria-pressed={selected}
                  className="cursor-pointer"
                  strokeDasharray={marked && !selected ? '3 2' : undefined}
                  onClick={() => onSelectMuscle?.(muscle)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMuscle?.(muscle);
                    }
                  }}
                >
                  {shapes}
                </g>
              );
            })}
          </svg>
          {showLabels && <figcaption className="text-2xs text-ink-3 mt-1 uppercase tracking-wide">{v.label}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

/** Legend for the freshness heat map — colour is never the only signal, so the
 *  Body Map page pairs this with a text list of every muscle's status. */
export function MuscleHeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-ink-3">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-success/40 border border-success/70" aria-hidden />Fresh
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-warn/60 border border-warn/80" aria-hidden />Recovering
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-danger/70 border border-danger/80" aria-hidden />Fatigued
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-danger" aria-hidden />Niggle logged
      </span>
    </div>
  );
}

/** Legend used next to the map so the colour coding is never the only signal. */
export function MuscleMapLegend({ primaryLabel = 'Primary', secondaryLabel = 'Secondary' }: { primaryLabel?: string; secondaryLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-ink-3">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-brand" aria-hidden />{primaryLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-brand/35" aria-hidden />{secondaryLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-surface-3 border border-line-strong" aria-hidden />Not targeted
      </span>
    </div>
  );
}
