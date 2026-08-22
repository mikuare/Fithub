import { platesPerSide, weightUnit } from '@/lib/fitness/units';
import type { Units } from '@/types';

/** Shows how to load a barbell for the target weight, per side. */
export function PlateCalculator({ totalKg, barKg, units }: { totalKg: number; barKg: number; units: Units }) {
  const plates = platesPerSide(totalKg, barKg, units);
  if (totalKg <= barKg) {
    return <p className="text-2xs text-ink-3">Empty bar ({barKg} kg).</p>;
  }
  if (!plates.length) {
    return <p className="text-2xs text-ink-3">Cannot be loaded exactly with standard plates.</p>;
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-2xs text-ink-3">Per side:</span>
      {plates.map((p, i) => (
        <span
          key={`${p}-${i}`}
          className="px-1.5 py-0.5 rounded text-2xs font-bold tabular bg-surface-3 border border-line-strong"
        >
          {p}
        </span>
      ))}
      <span className="text-2xs text-ink-3">{weightUnit(units)}</span>
    </div>
  );
}
