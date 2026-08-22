import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Check, ChevronLeft, CreditCard, FlaskConical,
  Info, Lock, ReceiptText, ShieldCheck, Smartphone, Sparkles, Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { Confetti } from '@/components/Confetti';
import { useData, selectTier } from '@/store/data';
import {
  PLANS, PAYMENT_METHODS, TIER_LABEL, TIER_RANK, formatPrice, periodEndFrom, priceFor, yearlySavingsPct,
} from '@/lib/billing/plans';
import {
  cvcValid, detectBrand, digitsOnly, expiryValid, formatCardNumber, last4, luhnValid,
  maskMobile, phMobileValid,
} from '@/lib/billing/card';
import { formatDate, today } from '@/lib/date';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import type {
  BillingCurrency, BillingCycle, CardBrand, PaymentMethodInfo, PaymentMethodKind,
  SubscriptionTier,
} from '@/types';

type PaidTier = Exclude<SubscriptionTier, 'free'>;

const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', jcb: 'JCB', unknown: 'Card',
};

export default function Pricing() {
  const subscription = useData((s) => s.subscription);
  const payments = useData((s) => s.payments);
  const effectiveTier = useData(selectTier);
  const setCancelAtPeriodEnd = useData((s) => s.setCancelAtPeriodEnd);

  const [cycle, setCycle] = useState<BillingCycle>(subscription?.cycle ?? 'yearly');
  const [currency, setCurrency] = useState<BillingCurrency>(subscription?.currency ?? 'USD');
  const [checkoutTier, setCheckoutTier] = useState<PaidTier | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const lapsed = !!subscription && subscription.status === 'active' && subscription.current_period_end < today();
  const history = useMemo(() => [...payments].sort((a, b) => b.paid_at.localeCompare(a.paid_at)), [payments]);

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="Plan & Billing"
        title="Choose how far you take it"
        subtitle="The training core is free forever. Plus adds the tools that read your body; Pro adds a coach on top. Cancel anytime — your data is never held hostage."
      />

      {/* Sandbox honesty, always visible */}
      <Card className="border-info/30">
        <div className="px-5 py-3.5 flex items-start gap-2.5">
          <FlaskConical size={16} className="shrink-0 mt-0.5 text-info" />
          <p className="text-xs text-ink-2 leading-relaxed">
            <span className="font-semibold">Sandbox billing.</span> No payment provider is connected yet,
            so checkout validates your details locally, saves the plan to your account, and moves no money.
            Monthly access lasts one calendar month; yearly access lasts twelve months. It does not charge or
            extend itself automatically while billing is in sandbox mode.
            When Stripe / PayMongo are wired to the Supabase backend, this same flow charges for real —
            card numbers are never stored either way, only the brand and last four digits.
          </p>
        </div>
      </Card>

      {/* Current plan */}
      {subscription && (
        <Card className={cn(lapsed ? 'border-warn/40' : 'border-brand/40')}>
          <div className="p-5 flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-black text-lg">FitHub {TIER_LABEL[subscription.tier]}</p>
                <Badge tone={lapsed ? 'warn' : 'success'} size="sm">
                  {lapsed ? 'Expired' : subscription.cancel_at_period_end ? 'Ends soon' : 'Active'}
                </Badge>
                {subscription.sandbox && <Badge tone="muted" size="sm">sandbox</Badge>}
              </div>
              <p className="mt-1 text-sm text-ink-3">
                {formatPrice(subscription.price, subscription.currency)} / {subscription.cycle === 'monthly' ? 'month' : 'year'}
                {' · '}
                {lapsed
                  ? `expired ${formatDate(subscription.current_period_end, 'medium')}`
                  : subscription.cancel_at_period_end
                    ? `ends ${formatDate(subscription.current_period_end, 'medium')} — no further charges`
                    : subscription.sandbox
                      ? `active until ${formatDate(subscription.current_period_end, 'medium')} — no automatic charge`
                      : `renews ${formatDate(subscription.current_period_end, 'medium')}`}
              </p>
              {subscription.payment_method && (
                <p className="mt-1 text-2xs text-ink-3 inline-flex items-center gap-1.5">
                  {subscription.payment_method.kind === 'card'
                    ? <><CreditCard size={12} /> {BRAND_LABEL[subscription.payment_method.brand ?? 'unknown']} •••• {subscription.payment_method.last4}</>
                    : <><Wallet size={12} /> {PAYMENT_METHODS.find((m) => m.kind === subscription.payment_method?.kind)?.label} {subscription.payment_method.wallet_account}</>}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {lapsed ? (
                <Button size="sm" onClick={() => setCheckoutTier(subscription.tier === 'pro' ? 'pro' : 'plus')}>
                  Renew
                </Button>
              ) : subscription.cancel_at_period_end ? (
                <Button size="sm" variant="outline" onClick={() => void setCancelAtPeriodEnd(false).then(() => toast.success('Plan resumed', 'It will renew as normal.'))}>
                  Resume plan
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)}>
                  Cancel plan
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Cycle + currency controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Billing cycle" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button
              key={c} type="button" role="radio" aria-checked={cycle === c}
              onClick={() => setCycle(c)}
              className={cn(
                'px-4 h-9 rounded-lg text-sm font-semibold transition-colors',
                cycle === c ? 'bg-brand text-brand-contrast' : 'text-ink-2 hover:text-ink',
              )}
            >
              {c === 'monthly' ? 'Monthly' : (
                <span className="inline-flex items-center gap-1.5">
                  Yearly
                  <span className={cn('text-2xs font-bold', cycle === c ? 'opacity-80' : 'text-brand-text')}>
                    save up to {Math.max(yearlySavingsPct('plus', currency), yearlySavingsPct('pro', currency))}%
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Currency" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {(['USD', 'PHP'] as const).map((c) => (
            <button
              key={c} type="button" role="radio" aria-checked={currency === c}
              onClick={() => setCurrency(c)}
              className={cn(
                'px-3.5 h-9 rounded-lg text-sm font-semibold transition-colors tabular',
                currency === c ? 'bg-surface-3 text-ink' : 'text-ink-3 hover:text-ink',
              )}
            >
              {c === 'USD' ? '$ USD' : '₱ PHP'}
            </button>
          ))}
        </div>
      </div>

      {/* Tier cards */}
      <div className="grid md:grid-cols-3 gap-4 items-stretch">
        {PLANS.map((plan) => {
          const price = priceFor(plan.tier, cycle, currency);
          const isCurrent = effectiveTier === plan.tier
            && (plan.tier === 'free' || (subscription?.cycle === cycle && !lapsed));
          const isUpgrade = TIER_RANK[plan.tier] > TIER_RANK[effectiveTier];
          return (
            <div key={plan.tier} className="relative">
              {plan.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 px-2.5 py-0.5 rounded-full bg-brand text-brand-contrast text-2xs font-black uppercase tracking-wide">
                  Most popular
                </span>
              )}
            <Card
              className={cn('flex flex-col h-full', plan.highlight && 'border-brand/50')}
            >
              <div className="p-5 flex-1">
                <p className="font-black text-lg">{plan.name}</p>
                <p className="mt-0.5 text-xs text-ink-3 leading-relaxed min-h-8">{plan.tagline}</p>
                <p className="mt-3">
                  <span className="text-3xl font-black tabular">{plan.tier === 'free' ? formatPrice(0, currency) : formatPrice(price, currency)}</span>
                  <span className="text-sm text-ink-3"> / {cycle === 'monthly' ? 'month' : 'year'}</span>
                </p>
                {plan.tier !== 'free' && cycle === 'yearly' && (
                  <p className="mt-0.5 text-2xs text-brand-text font-semibold">
                    {yearlySavingsPct(plan.tier, currency)}% cheaper than paying monthly
                  </p>
                )}
                <ul className="mt-4 space-y-2">
                  {plan.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-ink-2">
                      <Check size={15} className="text-brand-text shrink-0 mt-0.5" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-5 pt-0">
                {plan.tier === 'free' ? (
                  <Button block variant="outline" disabled={effectiveTier === 'free'}
                    onClick={() => setConfirmCancel(true)}>
                    {effectiveTier === 'free' ? 'Included with every account' : 'Downgrade at period end'}
                  </Button>
                ) : isCurrent ? (
                  <Button block variant="outline" disabled icon={<BadgeCheck size={15} />}>Current plan</Button>
                ) : (
                  <Button block variant={plan.highlight ? 'primary' : 'secondary'}
                    onClick={() => setCheckoutTier(plan.tier as PaidTier)}
                    iconRight={<ArrowRight size={15} />}>
                    {isUpgrade ? `Get ${plan.name}` : `Switch to ${plan.name}`}
                  </Button>
                )}
              </div>
            </Card>
            </div>
          );
        })}
      </div>

      {/* Payment methods */}
      <Card>
        <CardHeader title="Ways to pay" subtitle="International cards, and the wallets the Philippines actually uses" dense />
        <div className="px-5 pb-5 pt-1 grid sm:grid-cols-2 gap-3">
          {PAYMENT_METHODS.map((m) => (
            <div key={m.kind} className="flex items-start gap-3 rounded-xl border border-line p-3.5">
              <span className="h-9 w-9 rounded-lg bg-surface-2 grid place-items-center text-ink-2 shrink-0">
                {m.kind === 'card' ? <CreditCard size={17} /> : <Smartphone size={17} />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{m.label}</p>
                <p className="text-2xs text-ink-3 leading-relaxed">{m.detail}</p>
                {m.kind === 'card' && (
                  <div className="mt-1.5 flex gap-1.5" aria-hidden>
                    {['VISA', 'MC', 'AMEX', 'JCB'].map((b) => (
                      <span key={b} className="px-1.5 py-0.5 rounded border border-line text-[9px] font-black tracking-wide text-ink-3">{b}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader title="Payment history" dense />
        {history.length === 0 ? (
          <div className="px-5 pb-5 pt-1">
            <EmptyState compact icon={<ReceiptText size={20} />} title="No payments yet"
              body="Receipts appear here the moment a plan is activated — sandbox ones included, clearly labelled." />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {history.slice(0, 12).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <span className="h-8 w-8 rounded-lg bg-surface-2 grid place-items-center text-ink-3 shrink-0">
                  {p.method.kind === 'card' ? <CreditCard size={14} /> : <Wallet size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.description}</p>
                  <p className="text-2xs text-ink-3">
                    {formatDate(p.paid_at.slice(0, 10), 'medium')}
                    {' · '}
                    {p.method.kind === 'card'
                      ? `${BRAND_LABEL[p.method.brand ?? 'unknown']} •••• ${p.method.last4}`
                      : `${PAYMENT_METHODS.find((m) => m.kind === p.method.kind)?.label} ${p.method.wallet_account ?? ''}`}
                  </p>
                </div>
                {p.sandbox && <Badge tone="muted" size="sm">sandbox</Badge>}
                <span className="tabular font-bold text-sm shrink-0">{formatPrice(p.amount, p.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Fine print */}
      <Card>
        <div className="p-5 space-y-2.5">
          {([
            [ShieldCheck, 'Cancelling keeps your plan until the period you paid for ends — nothing is clawed back early.'],
            [Lock, 'Full card numbers and CVCs never touch storage. Only the brand and last four digits are kept for your receipts.'],
            [Info, 'Data export and account deletion are free on every tier, always. A paywall on your own data would be ransom, not pricing.'],
          ] as Array<[typeof ShieldCheck, string]>).map(([IconCmp, text]) => (
            <p key={text} className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
              <IconCmp size={13} className="shrink-0 mt-0.5" />
              <span>{text}</span>
            </p>
          ))}
        </div>
      </Card>

      {checkoutTier && (
        <CheckoutModal
          tier={checkoutTier}
          cycle={cycle}
          currency={currency}
          onClose={() => setCheckoutTier(null)}
        />
      )}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          void setCancelAtPeriodEnd(true).then(() =>
            toast.info('Plan will not renew', `You keep ${TIER_LABEL[subscription?.tier ?? 'free']} until ${subscription ? formatDate(subscription.current_period_end, 'medium') : 'the period ends'}.`));
        }}
        title="Cancel your plan?"
        body="You keep everything you paid for until the current period ends, then move to Free. Your data — including Body Map history — is kept and export stays available."
        confirmLabel="Cancel at period end"
      />
    </div>
  );
}

/* ================= checkout ================= */

function CheckoutModal({ tier, cycle, currency, onClose }: {
  tier: PaidTier;
  cycle: BillingCycle;
  currency: BillingCurrency;
  onClose: () => void;
}) {
  const checkout = useData((s) => s.checkout);
  const price = priceFor(tier, cycle, currency);
  const accessUntil = periodEndFrom(today(), cycle);

  const [step, setStep] = useState<'method' | 'details' | 'done'>('method');
  const [kind, setKind] = useState<PaymentMethodKind>('card');
  const [busy, setBusy] = useState(false);

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);

  const brand = detectBrand(cardNumber);

  const validate = (): PaymentMethodInfo | null => {
    if (kind === 'card') {
      if (!luhnValid(cardNumber)) return setError('That card number does not check out — a digit is off.'), null;
      if (!expiryValid(expiry)) return setError('Expiry must be MM/YY and in the future.'), null;
      if (!cvcValid(cvc, brand)) return setError(brand === 'amex' ? 'Amex security codes have 4 digits.' : 'The security code has 3 digits.'), null;
      if (!cardName.trim()) return setError('Add the name printed on the card.'), null;
      return { kind: 'card', brand, last4: last4(cardNumber), wallet_account: null };
    }
    if (!phMobileValid(mobile)) return setError('Enter the Philippine mobile number linked to the wallet, e.g. 0917 123 4567.'), null;
    return { kind, brand: null, last4: null, wallet_account: maskMobile(mobile) };
  };

  const pay = async () => {
    setError(null);
    const method = validate();
    if (!method) return;
    setBusy(true);
    try {
      await checkout({ tier, cycle, currency, method });
      setStep('done');
    } catch {
      setError('Something went wrong saving the plan. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const methodLabel = PAYMENT_METHODS.find((m) => m.kind === kind)?.label ?? '';

  return (
    <Modal
      open
      onClose={onClose}
      title={step === 'done' ? 'You are all set' : `FitHub ${TIER_LABEL[tier]} — ${cycle}`}
      description={step === 'done' ? undefined : `${formatPrice(price, currency)} per ${cycle === 'monthly' ? 'month' : 'year'} · no real charge · access until ${formatDate(accessUntil, 'medium')}`}
      size="md"
    >
      {step === 'method' && (
        <div className="space-y-2.5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.kind}
              type="button"
              onClick={() => { setKind(m.kind); setError(null); setStep('details'); }}
              className="w-full flex items-center gap-3 rounded-xl border border-line p-4 text-left hover:border-brand/50 hover:bg-surface-2 transition-colors"
            >
              <span className="h-10 w-10 rounded-xl bg-surface-2 grid place-items-center text-ink-2 shrink-0">
                {m.kind === 'card' ? <CreditCard size={18} /> : <Smartphone size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-2xs text-ink-3">{m.detail}</span>
              </span>
              <ArrowRight size={15} className="text-ink-3 shrink-0" />
            </button>
          ))}
          <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed pt-1">
            <FlaskConical size={12} className="shrink-0 mt-0.5" />
            <span>Sandbox checkout: details are validated on this device and no charge is made. Try card 4242 4242 4242 4242 with any future expiry.</span>
          </p>
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-4">
          <button type="button" onClick={() => { setStep('method'); setError(null); }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3 hover:text-ink">
            <ChevronLeft size={13} /> All payment methods
          </button>

          {error && (
            <div role="alert" className="flex items-start gap-2.5 p-3 rounded-xl bg-danger-soft border border-danger/30 text-sm text-danger">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {kind === 'card' ? (
            <>
              <Input
                label="Card number"
                inputMode="numeric" autoComplete="cc-number"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="4242 4242 4242 4242"
                hint={brand !== 'unknown' && digitsOnly(cardNumber).length >= 4 ? `Looks like ${BRAND_LABEL[brand]}` : 'Visa, Mastercard, Amex or JCB'}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Expiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY"
                  value={expiry}
                  onChange={(e) => {
                    const d = digitsOnly(e.target.value).slice(0, 4);
                    setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                  }}
                />
                <Input
                  label="Security code" inputMode="numeric" autoComplete="cc-csc"
                  placeholder={brand === 'amex' ? '4 digits' : '3 digits'}
                  value={cvc} onChange={(e) => setCvc(digitsOnly(e.target.value).slice(0, 4))}
                />
              </div>
              <Input
                label="Name on card" autoComplete="cc-name"
                value={cardName} onChange={(e) => setCardName(e.target.value)}
              />
            </>
          ) : (
            <>
              <Input
                label={`${methodLabel} mobile number`}
                inputMode="tel" placeholder="0917 123 4567"
                value={mobile} onChange={(e) => setMobile(e.target.value)}
                hint="The number linked to the wallet. In a live deployment you would approve the payment inside the app."
              />
              <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
                <Smartphone size={12} className="shrink-0 mt-0.5" />
                <span>Sandbox simulates the wallet approval step instantly. Only a masked number is kept.</span>
              </p>
            </>
          )}

          <div className="rounded-xl bg-surface-2 border border-line p-3.5 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-ink-3">Plan</span><span className="font-semibold">FitHub {TIER_LABEL[tier]}</span></div>
            <div className="flex justify-between"><span className="text-ink-3">Billing</span><span className="font-semibold capitalize">{cycle}</span></div>
            <div className="flex justify-between"><span className="text-ink-3">Access until</span><span className="font-semibold">{formatDate(accessUntil, 'medium')}</span></div>
            <div className="flex justify-between"><span className="text-ink-3">Sandbox amount</span><span className="font-black tabular">{formatPrice(price, currency)}</span></div>
          </div>

          <Button block size="lg" loading={busy} onClick={() => void pay()} icon={<Lock size={15} />}>
            Activate {TIER_LABEL[tier]} — sandbox
          </Button>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-4">
          <Confetti pieces={45} />
          <span className="mx-auto h-14 w-14 rounded-2xl bg-brand-soft grid place-items-center text-brand-text">
            <Sparkles size={26} />
          </span>
          <h3 className="mt-4 text-xl font-black">Welcome to FitHub {TIER_LABEL[tier]}</h3>
          <p className="mt-2 text-sm text-ink-2 leading-relaxed">
            Everything is unlocked right now — Body Map, reviews{tier === 'pro' ? ', FitCoach' : ''} and unlimited goals.
            Your {cycle} access is saved through {formatDate(accessUntil, 'medium')}. No real payment or automatic renewal occurred.
          </p>
          <Button className="mt-6" block onClick={onClose}>Start exploring</Button>
        </div>
      )}
    </Modal>
  );
}
