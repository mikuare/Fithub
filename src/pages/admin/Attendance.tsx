import { useMemo, useState } from 'react';
import {
  ScanLine, Search, LogIn, LogOut, CheckCircle2, XCircle, Clock, Users, QrCode, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/States';
import { StatTile } from '@/components/dashboard/StatTile';
import { Avatar } from '@/components/layout/AppShell';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { currentlyInside, todaysCheckins } from '@/lib/db/seed';
import { uid } from '@/lib/id';
import { nowISO, timeAgo } from '@/lib/date';
import { matches } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { GymCheckin, Membership, Profile } from '@/types';

export default function Attendance() {
  const { profile } = useAuth();
  const directory = useData((s) => s.directory);
  const allMemberships = useData((s) => s.allMemberships);
  const allCheckins = useData((s) => s.allCheckins);
  const gym = useData((s) => s.gym);
  const put = useData((s) => s.put);
  const audit = useData((s) => s.audit);

  const [query, setQuery] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const [confirmed, setConfirmed] = useState<{ person: Profile; membership: Membership | null } | null>(null);

  const membershipOf = useMemo(
    () => new Map(allMemberships.map((m) => [m.user_id, m])),
    [allMemberships],
  );
  const inside = useMemo(() => currentlyInside(allCheckins), [allCheckins]);
  const todays = useMemo(() => todaysCheckins(allCheckins), [allCheckins]);
  const insideIds = useMemo(() => new Set(inside.map((c) => c.user_id)), [inside]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return directory
      .filter((p) => p.role === 'member' || p.role === 'trainer')
      .filter((p) => matches(p.full_name, query) || matches(membershipOf.get(p.id)?.member_code ?? '', query))
      .slice(0, 10);
  }, [directory, query, membershipOf]);

  const checkIn = async (person: Profile, method: GymCheckin['method']) => {
    if (!gym) return;
    const membership = membershipOf.get(person.id) ?? null;
    const row: GymCheckin = {
      id: uid('ci'), user_id: person.id, gym_id: gym.id,
      checked_in_at: nowISO(), checked_out_at: null,
      method, recorded_by: profile?.id ?? null,
    };
    await put('gym_checkins', row);
    useData.setState((s) => ({ allCheckins: [row, ...s.allCheckins] }));
    await audit('attendance.check_in', 'gym_checkins', row.id, { user_id: person.id, method });
    setConfirmed({ person, membership });
    setQuery('');
    setScanCode('');
    setScanOpen(false);
  };

  const checkOut = async (checkin: GymCheckin) => {
    const row = { ...checkin, checked_out_at: nowISO() };
    await put('gym_checkins', row);
    useData.setState((s) => ({ allCheckins: s.allCheckins.map((c) => (c.id === row.id ? row : c)) }));
    await audit('attendance.check_out', 'gym_checkins', row.id, { user_id: checkin.user_id });
    toast.success('Checked out');
  };

  const scanSubmit = async () => {
    const code = scanCode.trim().toUpperCase();
    const membership = allMemberships.find((m) => m.member_code.toUpperCase() === code);
    const person = membership ? directory.find((p) => p.id === membership.user_id) : null;
    if (!person) { toast.error('Code not recognised', 'Check the member code and try again.'); return; }
    await checkIn(person, 'qr');
  };

  const byHour = useMemo(() => {
    const buckets = new Map<number, number>();
    for (const c of todays) {
      const h = new Date(c.checked_in_at).getHours();
      buckets.set(h, (buckets.get(h) ?? 0) + 1);
    }
    return buckets;
  }, [todays]);

  const peakHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="Gym operations"
        title="Attendance"
        subtitle={gym ? `${gym.name} · open ${gym.open_hour}:00 – ${gym.close_hour}:00` : undefined}
        actions={<Button size="sm" onClick={() => setScanOpen(true)} icon={<QrCode size={14} />}>QR check-in</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Inside now" value={inside.length} icon={<Users size={15} />} tone="brand"
          hint={gym ? `capacity ${gym.capacity}` : undefined} />
        <StatTile label="Today's check-ins" value={todays.length} icon={<LogIn size={15} />} />
        <StatTile label="Peak hour today" value={peakHour ? `${peakHour[0]}:00` : '—'} icon={<Clock size={15} />}
          hint={peakHour ? `${peakHour[1]} check-ins` : undefined} />
        <StatTile label="Active memberships" value={allMemberships.filter((m) => m.status === 'active').length} icon={<CheckCircle2 size={15} />} />
      </div>

      {/* Manual check-in */}
      <Card>
        <CardHeader title="Check a member in" subtitle="Search by name or member code, or scan a QR code." />
        <div className="p-5 pt-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or FH-XXXX-XX…"
            prefix={<Search size={15} />}
            aria-label="Search members"
            inputSize="lg"
          />

          {query.trim() !== '' && (
            <ul className="mt-3 space-y-1.5">
              {results.length === 0 && (
                <li className="py-6 text-center text-sm text-ink-3">No member matches "{query}".</li>
              )}
              {results.map((p) => {
                const membership = membershipOf.get(p.id);
                const isInside = insideIds.has(p.id);
                const valid = membership?.status === 'active' || membership?.status === 'expiring';
                return (
                  <li key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-line">
                    <Avatar profile={p} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{p.full_name}</p>
                      <p className="text-2xs text-ink-3 tabular">
                        {membership?.member_code ?? 'No membership'} · {membership ? membership.status : 'none'}
                      </p>
                    </div>
                    {!valid && <Badge tone="danger" size="sm" icon={<XCircle size={10} />}>Not active</Badge>}
                    {isInside ? (
                      <Button
                        size="sm" variant="outline"
                        onClick={() => {
                          const open = inside.find((c) => c.user_id === p.id);
                          if (open) void checkOut(open);
                        }}
                        icon={<LogOut size={13} />}
                      >
                        Check out
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => void checkIn(p, 'manual')} icon={<LogIn size={13} />}>
                        Check in
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Inside now */}
      <Card>
        <CardHeader title="Currently inside" subtitle={`${inside.length} people`} icon={<Users size={16} />} />
        {inside.length === 0 ? (
          <EmptyState compact icon={<Users size={20} />} title="Nobody checked in right now" />
        ) : (
          <ul className="divide-y divide-line max-h-96 overflow-y-auto">
            {inside.map((c) => {
              const person = directory.find((p) => p.id === c.user_id);
              if (!person) return null;
              return (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar profile={person} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{person.full_name}</p>
                    <p className="text-2xs text-ink-3 tabular">
                      Checked in {new Date(c.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {timeAgo(c.checked_in_at)}
                    </p>
                  </div>
                  <Badge size="sm" tone="muted">{c.method}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => void checkOut(c)} icon={<LogOut size={13} />}>Out</Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Today's log */}
      <Card>
        <CardHeader title="Today's log" subtitle={`${todays.length} check-ins`} />
        {todays.length === 0 ? (
          <EmptyState compact icon={<ScanLine size={20} />} title="No check-ins today yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="text-2xs uppercase tracking-wider text-ink-3">
                <tr className="border-b border-line">
                  <th scope="col" className="text-left font-semibold px-5 py-2.5">Member</th>
                  <th scope="col" className="text-left font-semibold px-3 py-2.5">In</th>
                  <th scope="col" className="text-left font-semibold px-3 py-2.5">Out</th>
                  <th scope="col" className="text-left font-semibold px-3 py-2.5">Method</th>
                  <th scope="col" className="text-right font-semibold px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {todays.slice(0, 60).map((c) => {
                  const person = directory.find((p) => p.id === c.user_id);
                  const membership = membershipOf.get(c.user_id);
                  return (
                    <tr key={c.id} className="hover:bg-surface-2">
                      <td className="px-5 py-2.5 font-medium">{person?.full_name ?? 'Unknown'}</td>
                      <td className="px-3 tabular">{new Date(c.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 tabular text-ink-3">
                        {c.checked_out_at ? new Date(c.checked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-3"><Badge size="sm" tone="muted">{c.method}</Badge></td>
                      <td className="px-5 text-right">
                        <Badge
                          size="sm"
                          tone={membership?.status === 'active' ? 'success' : membership?.status === 'expiring' ? 'warn' : 'danger'}
                        >
                          {membership?.status ?? 'none'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* QR modal */}
      <Modal
        open={scanOpen} onClose={() => setScanOpen(false)} title="QR check-in"
        description="Scan the member's QR code, or type the code it contains."
        footer={<Button block onClick={() => void scanSubmit()} disabled={!scanCode.trim()}>Check in</Button>}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-dashed border-line-strong p-8 text-center">
            <QrCode size={44} className="mx-auto text-ink-3" />
            <p className="mt-3 text-sm text-ink-3 leading-relaxed">
              Point a connected scanner at the member's code. Most handheld scanners type the code and press
              Enter, which this field accepts directly.
            </p>
          </div>
          <Input
            label="Member code"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void scanSubmit(); }}
            placeholder="FH-XXXX-XX"
            inputSize="lg"
            autoFocus
          />
          <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            Membership status is validated on check-in. Expired or cancelled memberships are flagged but not
            blocked — the decision stays with your staff.
          </p>
        </div>
      </Modal>

      {/* Confirmation */}
      {confirmed && (
        <Modal open onClose={() => setConfirmed(null)} title="Checked in" size="sm" hideClose>
          <div className="text-center py-4">
            <div className="mx-auto h-16 w-16 rounded-3xl bg-brand grid place-items-center animate-pop">
              <CheckCircle2 size={32} className="text-brand-contrast" />
            </div>
            <p className="mt-4 text-2xl font-black tracking-tight uppercase">{confirmed.person.full_name}</p>
            <div className="mt-2 flex justify-center">
              <Badge tone={confirmed.membership?.status === 'active' ? 'success' : 'warn'}>
                Member {confirmed.membership?.status ?? 'unknown'}
              </Badge>
            </div>
            <p className="mt-4 text-sm text-ink-3">Checked in</p>
            <p className="text-3xl font-black tabular">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <Button block className="mt-6" onClick={() => setConfirmed(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
