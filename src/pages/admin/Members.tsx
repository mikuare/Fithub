import { useMemo, useState } from 'react';
import { IdCard, Search, Filter, AlertTriangle, CheckCircle2, Clock, Snowflake, XCircle, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/States';
import { StatTile } from '@/components/dashboard/StatTile';
import { Avatar } from '@/components/layout/AppShell';
import { useData } from '@/store/data';
import { addDays, diffDays, formatDate, today } from '@/lib/date';
import { formatNumber, matches } from '@/lib/utils';
import { toast } from '@/store/toast';
import { ROLE_LABEL, type Membership, type MembershipStatus } from '@/types';

const STATUS_TONE: Record<MembershipStatus, Tone> = {
  active: 'success', expiring: 'warn', expired: 'danger', frozen: 'info', cancelled: 'muted',
};

const STATUS_ICON: Record<MembershipStatus, typeof CheckCircle2> = {
  active: CheckCircle2, expiring: Clock, expired: XCircle, frozen: Snowflake, cancelled: XCircle,
};

export default function Members() {
  const directory = useData((s) => s.directory);
  const allMemberships = useData((s) => s.allMemberships);
  const allCheckins = useData((s) => s.allCheckins);
  const plans = useData((s) => s.plans);
  const put = useData((s) => s.put);
  const audit = useData((s) => s.audit);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | MembershipStatus>('all');
  const [editing, setEditing] = useState<Membership | null>(null);

  const membershipOf = useMemo(() => new Map(allMemberships.map((m) => [m.user_id, m])), [allMemberships]);
  const planOf = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);

  const lastVisitOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCheckins) {
      const prev = map.get(c.user_id);
      if (!prev || c.checked_in_at > prev) map.set(c.user_id, c.checked_in_at);
    }
    return map;
  }, [allCheckins]);

  const rows = useMemo(
    () =>
      directory
        .filter((p) => p.role !== 'admin')
        .map((person) => ({ person, membership: membershipOf.get(person.id) ?? null }))
        .filter((r) => (tab === 'all' ? true : r.membership?.status === tab))
        .filter((r) =>
          !query.trim() ||
          matches(r.person.full_name, query) ||
          matches(r.person.email, query) ||
          matches(r.membership?.member_code ?? '', query))
        .sort((a, b) => a.person.full_name.localeCompare(b.person.full_name)),
    [directory, membershipOf, tab, query],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: directory.filter((p) => p.role !== 'admin').length };
    for (const m of allMemberships) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [allMemberships, directory]);

  const monthlyRevenue = useMemo(
    () =>
      allMemberships
        .filter((m) => m.status === 'active' || m.status === 'expiring')
        .reduce((a, m) => a + (planOf.get(m.plan_id)?.price ?? 0), 0),
    [allMemberships, planOf],
  );

  const saveMembership = async (m: Membership) => {
    await put('memberships', m);
    useData.setState((s) => ({ allMemberships: s.allMemberships.map((x) => (x.id === m.id ? m : x)) }));
    await audit('membership.update', 'memberships', m.id, { status: m.status, end_date: m.end_date });
    setEditing(null);
    toast.success('Membership updated');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Gym operations"
        title="Members"
        subtitle="Membership status, renewals and attendance for everyone at this gym."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total members" value={counts.all ?? 0} icon={<IdCard size={15} />} />
        <StatTile label="Active" value={counts.active ?? 0} icon={<CheckCircle2 size={15} />} tone="brand" />
        <StatTile label="Expiring soon" value={counts.expiring ?? 0} icon={<Clock size={15} />}
          hint="within 21 days" />
        <StatTile label="Monthly recurring" value={`$${formatNumber(monthlyRevenue)}`} icon={<Filter size={15} />}
          hint="active plans" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Tabs
          value={tab}
          onChange={(k) => setTab(k as typeof tab)}
          items={[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'active', label: 'Active', count: counts.active },
            { key: 'expiring', label: 'Expiring', count: counts.expiring },
            { key: 'expired', label: 'Expired', count: counts.expired },
            { key: 'frozen', label: 'Frozen', count: counts.frozen },
          ]}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or code…"
          prefix={<Search size={15} />}
          aria-label="Search members"
          className="flex-1 min-w-[220px]"
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Search size={22} />} title="No members match"
            body={query ? `Nothing matches "${query}".` : 'No members with that status.'} />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <caption className="sr-only">Gym members and membership status</caption>
              <thead className="text-2xs uppercase tracking-wider text-ink-3">
                <tr className="border-b border-line">
                  <th scope="col" className="text-left font-semibold px-5 py-3">Member</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Role</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Plan</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Status</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Renews</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Last visit</th>
                  <th scope="col" className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ person, membership }) => {
                  const plan = membership ? planOf.get(membership.plan_id) : null;
                  const last = lastVisitOf.get(person.id);
                  const daysLeft = membership ? diffDays(membership.end_date, today()) : null;
                  const StatusIcon = membership ? STATUS_ICON[membership.status] : XCircle;
                  return (
                    <tr key={person.id} className="hover:bg-surface-2">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar profile={person} size={34} />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{person.full_name}</p>
                            <p className="text-2xs text-ink-3 truncate">
                              {membership?.member_code ?? person.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3"><Badge size="sm" tone="muted">{ROLE_LABEL[person.role]}</Badge></td>
                      <td className="px-3 text-ink-2">{plan?.name ?? '—'}</td>
                      <td className="px-3">
                        {membership ? (
                          <Badge size="sm" tone={STATUS_TONE[membership.status]} icon={<StatusIcon size={10} />}>
                            {membership.status}
                          </Badge>
                        ) : (
                          <span className="text-2xs text-ink-3">No membership</span>
                        )}
                      </td>
                      <td className="px-3 tabular text-ink-2">
                        {membership ? (
                          <>
                            {formatDate(membership.end_date, 'short')}
                            {daysLeft !== null && daysLeft <= 21 && daysLeft >= 0 && (
                              <span className="block text-2xs text-warn">{daysLeft}d left</span>
                            )}
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-3 tabular text-ink-3">
                        {last ? formatDate(last.slice(0, 10), 'short') : 'Never'}
                      </td>
                      <td className="px-3">
                        {membership && (
                          <button
                            type="button"
                            onClick={() => setEditing(membership)}
                            aria-label={`Edit ${person.full_name}'s membership`}
                            className="h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-3"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Membership plans" dense />
        <div className="p-4 pt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-line p-4">
              <p className="font-semibold">{p.name}</p>
              <p className="mt-1 text-2xl font-black tabular">
                ${p.price}<span className="text-sm text-ink-3 font-medium">/mo</span>
              </p>
              <p className="text-2xs text-ink-3">{p.months}-month term</p>
              <ul className="mt-2.5 space-y-1">
                {p.perks.map((perk) => (
                  <li key={perk} className="text-2xs text-ink-3 flex gap-1.5">
                    <CheckCircle2 size={11} className="shrink-0 mt-0.5 text-success" />{perk}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-2xs text-ink-3 tabular">
                {allMemberships.filter((m) => m.plan_id === p.id).length} members
              </p>
            </div>
          ))}
        </div>
      </Card>

      {editing && (
        <Modal
          open onClose={() => setEditing(null)} title="Edit membership" size="sm"
          footer={<Button block onClick={() => void saveMembership(editing)}>Save changes</Button>}
        >
          <div className="space-y-3">
            <Select
              label="Status" value={editing.status}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as MembershipStatus })}
              options={(['active', 'expiring', 'expired', 'frozen', 'cancelled'] as MembershipStatus[]).map((s) => ({ value: s, label: s }))}
            />
            <Select
              label="Plan" value={editing.plan_id}
              onChange={(e) => setEditing({ ...editing, plan_id: e.target.value })}
              options={plans.map((p) => ({ value: p.id, label: `${p.name} — $${p.price}/mo` }))}
            />
            <Input
              label="Renewal date" type="date" value={editing.end_date}
              onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
            />
            <div className="flex gap-2">
              {[1, 6, 12].map((months) => (
                <Button
                  key={months} variant="outline" size="sm" className="flex-1"
                  onClick={() => setEditing({ ...editing, end_date: addDays(today(), months * 30), status: 'active' })}
                >
                  +{months}mo
                </Button>
              ))}
            </div>
            <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              Membership changes are written to the audit log with your account and a timestamp.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
