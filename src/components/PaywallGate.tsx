import type { ReactNode } from 'react';
import { Lock, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useHasFeature } from '@/lib/selectors';
import { minTierFor, TIER_LABEL, type PlanFeature } from '@/lib/billing/plans';

/**
 * Wraps a page that belongs to a paid tier. Entitled users see the page
 * untouched; everyone else gets an honest pitch for what the feature does
 * and a route to the pricing page — never a crippled half-version.
 */
export function PaywallGate({
  feature, title, blurb, bullets, children,
}: {
  feature: PlanFeature;
  title: string;
  blurb: string;
  bullets: string[];
  children: ReactNode;
}) {
  const entitled = useHasFeature(feature);
  if (entitled) return <>{children}</>;

  const tier = TIER_LABEL[minTierFor(feature)];
  return (
    <div className="max-w-2xl mx-auto py-10">
      <div className="card overflow-hidden">
        <div className="p-8 sm:p-10">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/30 bg-accent-soft text-accent-text text-xs font-bold uppercase tracking-wide">
            <Lock size={12} /> Included in {tier}
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-tight">{title}</h1>
          <p className="mt-3 text-ink-2 leading-relaxed">{blurb}</p>
          <ul className="mt-6 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-ink-2">
                <Check size={16} className="text-brand-text shrink-0 mt-0.5" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button to="/pricing" size="lg" iconRight={<ArrowRight size={16} />}>
              See plans & pricing
            </Button>
            <span className="text-xs text-ink-3">Unlocks instantly — nothing to reinstall.</span>
          </div>
        </div>
        <div className="px-8 sm:px-10 py-4 border-t border-line bg-surface-2/50">
          <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
            <ShieldCheck size={13} className="shrink-0 mt-0.5" />
            <span>
              Your training data keeps being recorded either way, and export is free on every plan —
              upgrading only changes what FitHub shows you, never what it keeps for you.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
