import { useMemo } from 'react';
import {
  Users, TrendingUp, Clock, UserPlus, Repeat, Wrench, ChartNoAxesCombined, Info, Building2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { StatTile } from '@/components/dashboard/StatTile';
import { BarsChart, TrendChart, CategoryBars } from '@/components/charts/Charts';
import { useData } from '@/store/data';
import { currentlyInside, todaysCheckins } from '@/lib/db/seed';
import { addDays, formatDate, startOfMonth, today } from '@/lib/date';
import { formatNumber, round } from '@/lib/utils';

export default function GymAnalytics() {
  const directory = useData((s) => s.directory);
  const allMemberships = useData((s) => s.allMemberships);
  const allCheckins = useData((s) => s.allCheckins);
  const equipment = useData((s) => s.equipment);
  const plans = useData((s) => s.plans);
  const gym = useData((s) => s.gym);

  const inside = useMemo(() => currentlyInside(allCheckins), [allCheckins]);
  const todays = useMemo(() => todaysCheckins(allCheckins), [allCheckins]);
  const activeMembers = allMemberships.filter((m) => m.status === 'active' || m.status === 'expiring');

  /* Check-ins by hour of day, across the last 30 days. */
  const byHour = useMemo(() => {
    const buckets = new Map<number, number>();
    const from = addDays(today(), -29);
    for (const c of allCheckins) {
      if (c.checked_in_at.slice(0, 10) < from) continue;
      const h = new Date(c.checked_in_at).getHours();
      buckets.set(h, (buckets.get(h) ?? 0) + 1);
    }
    const open = gym?.open_hour ?? 6;
    const close = gym?.close_hour ?? 23;
    return Array.from({ length: close - open + 1 }, (_, i) => {
      const hour = open + i;
      return { label: `${hour}:00`, checkins: buckets.get(hour) ?? 0 };
    });
  }, [allCheckins, gym]);

  const peak = useMemo(() => {
    const sorted = [...byHour].sort((a, b) => b.checkins - a.checkins);
    return sorted.slice(0, 4).map((b) => b.label).sort();
  }, [byHour]);

  /* Daily check-ins over the last 30 days. */
  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 29; i >= 0; i--) map.set(addDays(today(), -i), 0);
    for (const c of allCheckins) {
      const d = c.checked_in_at.slice(0, 10);
      if (map.has(d)) map.set(d, (map.get(d) ?? 0) + 1);
    }
    return [...map.entries()].map(([date, checkins]) => ({ date, checkins }));
  }, [allCheckins]);

  /* Membership growth: cumulative joins by month. */
  const growth = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of allMemberships) {
      const month = m.start_date.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + 1);
    }
    const months = [...map.keys()].sort();
    let cumulative = 0;
    return months.map((m) => {
      cumulative += map.get(m) ?? 0;
      return { date: `${m}-01`, members: cumulative, joins: map.get(m) ?? 0 };
    });
  }, [allMemberships]);

  const monthStart = startOfMonth(today());
  const newThisMonth = allMemberships.filter((m) => m.start_date >= monthStart).length;
  const renewalsDue = allMemberships.filter((m) => m.status === 'expiring').length;

  /* Retention: members with at least one visit in the last 30 days. */
  const retention = useMemo(() => {
    if (!activeMembers.length) return null;
    const from = addDays(today(), -29);
    const visited = new Set(
      allCheckins.filter((c) => c.checked_in_at.slice(0, 10) >= from).map((c) => c.user_id),
    );
    const retained = activeMembers.filter((m) => visited.has(m.user_id)).length;
    return round((retained / activeMembers.length) * 100, 0);
  }, [activeMembers, allCheckins]);

  const trainers = directory.filter((p) => p.role === 'trainer');
  const trainerUtilisation = useMemo(
    () =>
      trainers.map((t) => ({
        label: t.full_name.split(' ')[0],
        value: allCheckins.filter((c) => c.user_id === t.id && c.checked_in_at.slice(0, 10) >= addDays(today(), -29)).length,
      })),
    [trainers, allCheckins],
  );

  const equipmentUsage = useMemo(
    () =>
      [...equipment]
        .sort((a, b) => b.usage_hours - a.usage_hours)
        .slice(0, 8)
        .map((e) => ({ label: e.name.length > 16 ? `${e.name.slice(0, 15)}…` : e.name, value: e.usage_hours })),
    [equipment],
  );

  const monthlyRevenue = useMemo(() => {
    const planOf = new Map(plans.map((p) => [p.id, p]));
    return activeMembers.reduce((a, m) => a + (planOf.get(m.plan_id)?.price ?? 0), 0);
  }, [activeMembers, plans]);

  const avgStay = useMemo(() => {
    const closed = allCheckins.filter((c) => c.checked_out_at);
    if (!closed.length) return null;
    const total = closed.reduce(
      (a, c) => a + (new Date(c.checked_out_at!).getTime() - new Date(c.checked_in_at).getTime()) / 60000,
      0,
    );
    return Math.round(total / closed.length);
  }, [allCheckins]);

  if (!gym) {
    return (
      <Card>
        <EmptyState icon={<Building2 size={22} />} title="No gym configured"
          body="Gym analytics need a gym record. Seed data creates one automatically on first run." />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Gym operations"
        title="Analytics"
        subtitle={`${gym.name} · ${gym.address}`}
        actions={<Badge tone="muted" icon={<ChartNoAxesCombined size={11} />}>Last 30 days</Badge>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Active members" value={formatNumber(activeMembers.length)} icon={<Users size={15} />} tone="brand" />
        <StatTile label="Members inside" value={inside.length} icon={<Building2 size={15} />}
          hint={`capacity ${gym.capacity}`} />
        <StatTile label="Today's check-ins" value={todays.length} icon={<Repeat size={15} />} />
        <StatTile label="30-day retention" value={retention !== null ? `${retention}%` : '—'} icon={<TrendingUp size={15} />}
          hint="visited at least once" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="New this month" value={newThisMonth} icon={<UserPlus size={15} />} />
        <StatTile label="Renewals due" value={renewalsDue} icon={<Clock size={15} />} hint="within 21 days" />
        <StatTile label="Monthly recurring" value={`$${formatNumber(monthlyRevenue)}`} icon={<TrendingUp size={15} />} />
        <StatTile label="Average stay" value={avgStay !== null ? `${avgStay}` : '—'} unit={avgStay !== null ? 'min' : undefined} icon={<Clock size={15} />} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Check-ins by hour"
            subtitle="Aggregated over the last 30 days"
            action={peak.length ? <Badge tone="brand" size="sm">Peak {peak[0]}–{peak[peak.length - 1]}</Badge> : undefined}
          />
          <div className="p-3">
            <BarsChart data={byHour} dataKey="checkins" name="Check-ins" labelKey="label" height={230} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Daily check-ins" subtitle="Last 30 days" />
          <div className="p-3">
            <TrendChart data={daily} dataKey="checkins" name="Check-ins" color="#38BDF8" height={230} />
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Membership growth" subtitle="Cumulative members by join month" />
          <div className="p-3">
            {growth.length >= 2 ? (
              <TrendChart data={growth} dataKey="members" name="Members" color="#B9F227" height={220} />
            ) : (
              <EmptyState compact title="Not enough history" body="Growth appears once memberships span more than one month." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="New members per month" />
          <div className="p-3">
            {growth.length ? (
              <BarsChart data={growth.map((g) => ({ date: g.date, joins: g.joins }))} dataKey="joins" name="New members"
                formatLabel={(v) => formatDate(v, 'short')} height={220} />
            ) : (
              <EmptyState compact title="No membership data" />
            )}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Equipment usage" subtitle="Cumulative logged hours, top 8 assets" icon={<Wrench size={16} />} />
          <div className="p-3">
            {equipmentUsage.length ? (
              <CategoryBars data={equipmentUsage} height={240} unit=" h" />
            ) : (
              <EmptyState compact title="No usage recorded" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Trainer floor presence" subtitle="Check-ins in the last 30 days" />
          <div className="p-3">
            {trainerUtilisation.length ? (
              <CategoryBars data={trainerUtilisation} height={240} unit=" visits" />
            ) : (
              <EmptyState compact title="No trainers on the roster" />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 flex items-start gap-2.5">
          <Info size={15} className="shrink-0 mt-0.5 text-ink-3" />
          <p className="text-2xs text-ink-3 leading-relaxed">
            Every figure here is computed from the gym's own check-in, membership and equipment records —
            nothing is hard-coded. Retention counts active members with at least one visit in the last 30
            days, which is a usage measure rather than a churn forecast.
          </p>
        </div>
      </Card>
    </div>
  );
}
