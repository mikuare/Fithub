import { Link } from 'react-router-dom';
import { ArrowUpRight, Crown, Sparkles } from 'lucide-react';
import { TIER_LABEL } from '@/lib/billing/plans';
import { useTier } from '@/lib/selectors';
import { cn } from '@/lib/utils';
import type { SubscriptionTier } from '@/types';

/* ============================================================
   Tier badge
   Sits beside the signed-in user's name so the plan they are
   actually on is never a mystery. A free account gets an
   invitation rather than a label — "Free" beside a name tells
   nobody anything, "Upgrade" tells them where to go. Always a
   link to /pricing: paid users manage there, free users start
   there.
   ============================================================ */

const SIZE = {
  sm: 'h-[18px] gap-1 pl-1.5 pr-2 text-[10px]',
  md: 'h-6 gap-1.5 pl-2 pr-2.5 text-2xs',
} as const;

const ICON = { sm: 11, md: 13 } as const;

export function TierBadge({
  tier, size = 'md', className,
}: {
  tier: SubscriptionTier;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const paid = tier !== 'free';
  const label = paid ? TIER_LABEL[tier] : 'Upgrade';

  return (
    <Link
      to="/pricing"
      aria-label={paid ? `FitHub ${TIER_LABEL[tier]} plan — manage subscription` : 'Free plan — see upgrade options'}
      title={paid ? `You are on FitHub ${TIER_LABEL[tier]}` : 'Upgrade your plan'}
      className={cn(
        'relative isolate inline-flex shrink-0 items-center overflow-hidden rounded-full border',
        'font-bold uppercase tracking-wide transition-transform duration-200 hover:-translate-y-px',
        SIZE[size],
        tier === 'pro' && 'border-transparent bg-gradient-to-r from-brand via-brand to-accent text-brand-contrast shadow-glow',
        tier === 'plus' && 'border-brand/40 bg-brand-soft text-brand-text',
        tier === 'free' && 'border-brand/40 bg-brand-soft text-brand-text animate-tier-glow',
        className,
      )}
    >
      {tier === 'pro' ? (
        <Crown size={ICON[size]} className="shrink-0" aria-hidden />
      ) : tier === 'plus' ? (
        <Sparkles size={ICON[size]} className="shrink-0" aria-hidden />
      ) : (
        <ArrowUpRight size={ICON[size]} className="shrink-0" aria-hidden />
      )}
      <span>{label}</span>

      {/* One slow light sweep per cycle, purely decorative. */}
      {paid && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-sheen"
          aria-hidden
        />
      )}
    </Link>
  );
}

/** The same badge, reading the signed-in account's entitlement itself. */
export function AccountTierBadge(props: { size?: keyof typeof SIZE; className?: string }) {
  return <TierBadge tier={useTier()} {...props} />;
}
