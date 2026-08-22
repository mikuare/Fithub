import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, UserPlus, TrendingUp, Calendar, AlertTriangle, Check } from 'lucide-react';
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
import { uid } from '@/lib/id';
import { addDays, formatDate, relativeDay, today } from '@/lib/date';
import { matches, pluralize } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { TrainerClient } from '@/types';

export default function TrainerDashboard() {
  const { profile } = useAuth();
  const clients = useData((s) => s.trainerClients);
  const notes = useData((s) => s.trainerNotes);
  const directory = useData((s) => s.directory);
  const allCheckins = useData((s) => s.allCheckins);
  const put = useData((s) => s.put);
  const audit = useData((s) => s.audit);

  const [query, setQuery] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignQuery, setAssignQuery] = useState('');

  const byId = useMemo(() => new Map(directory.map((p) => [p.id, p])), [directory]);
  const active = clients.filter((c) => c.active);

  const rows = useMemo(
    () =>
      active
        .map((c) => ({ client: c, person: byId.get(c.client_id) }))
        .filter((r) => r.person && (!query.trim() || matches(r.person.full_name, query))),
    [active, byId, query],
  );

  const candidates = useMemo(() => {
    const assigned = new Set(clients.map((c) => c.client_id));
    return directory
      .filter((p) => p.role === 'member' && !assigned.has(p.id))
      .filter((p) => !assignQuery.trim() || matches(p.full_name, assignQuery))
      .slice(0, 20);
  }, [directory, clients, assignQuery]);

  const lastVisit = (userId: string) => {
    const rows = allCheckins.filter((c) => c.user_id === userId).sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at));
    return rows[0]?.checked_in_at.slice(0, 10) ?? null;
  };

  const assign = async (clientId: string) => {
    if (!profile) return;
    const row: TrainerClient = {
      id: uid('tc'), trainer_id: profile.id, client_id: clientId,
      since: today(), active: true, focus: '',
    };
    await put('trainer_clients', row);
    await audit('trainer.assign_client', 'trainer_clients', row.id, { client_id: clientId });
    toast.success('Client assigned', byId.get(clientId)?.full_name ?? '');
    setAssignOpen(false);
  };

  const staleClients = rows.filter((r) => {
    const last = lastVisit(r.client.client_id);
    return !last || last < addDays(today(), -10);
  });

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="Trainer"
        title="Your clients"
        subtitle="You can see the programme, history and progress only of members assigned to you."
        actions={<Button size="sm" onClick={() => setAssignOpen(true)} icon={<UserPlus size={14} />}>Assign a client</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Active clients" value={active.length} icon={<Users size={15} />} tone="brand" />
        <StatTile label="Trainer notes" value={notes.length} icon={<Check size={15} />} />
        <StatTile label="Needs attention" value={staleClients.length} icon={<AlertTriangle size={15} />}
          hint="no visit in 10+ days" />
        <StatTile label="Assigned since" value={active.length ? relativeDay(active[active.length - 1].since) : '—'} icon={<Calendar size={15} />} />
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your clients…"
        prefix={<Search size={15} />}
        aria-label="Search clients"
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={22} />}
            title={query ? 'No matching clients' : 'No clients assigned yet'}
            body={query
              ? `Nobody in your roster matches "${query}".`
              : 'Assign a member to see their programme, workout history, goals and progress in one place.'}
            action={!query ? <Button onClick={() => setAssignOpen(true)} icon={<UserPlus size={15} />}>Assign a client</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rows.map(({ client, person }) => {
            const last = lastVisit(client.client_id);
            const stale = !last || last < addDays(today(), -10);
            const clientNotes = notes.filter((n) => n.client_id === client.client_id);
            return (
              <Card key={client.id} className={stale ? 'border-warn/30' : undefined}>
                <Link to={`/trainer/${client.client_id}`} className="block p-4 hover:bg-surface-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar profile={person!} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{person!.full_name}</p>
                      <p className="text-2xs text-ink-3">
                        Client since {formatDate(client.since, 'medium')}
                      </p>
                    </div>
                    {stale && <Badge tone="warn" size="sm">Quiet</Badge>}
                  </div>

                  <dl className="mt-3 pt-3 border-t border-line grid grid-cols-2 gap-y-1.5 text-2xs">
                    <dt className="text-ink-3">Last gym visit</dt>
                    <dd className="text-right font-medium">{last ? relativeDay(last) : 'No record'}</dd>
                    <dt className="text-ink-3">Notes</dt>
                    <dd className="text-right font-medium">{pluralize(clientNotes.length, 'note')}</dd>
                    {client.focus && (
                      <>
                        <dt className="text-ink-3">Focus</dt>
                        <dd className="text-right font-medium truncate">{client.focus}</dd>
                      </>
                    )}
                  </dl>
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader title="What you can and cannot see" icon={<TrendingUp size={16} />} dense />
        <p className="px-4 pb-4 pt-1 text-sm text-ink-2 leading-relaxed">
          For assigned clients you can see their programme, workout history, goals, personal records and
          gym attendance. You cannot see progress photos, nutrition logs or recovery check-ins unless the
          client explicitly shares them, and you can never see data for members who are not assigned to you.
        </p>
      </Card>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign a client"
        description="Only gym members can be assigned. They will see that you are their trainer."
        size="md"
      >
        <Input
          value={assignQuery}
          onChange={(e) => setAssignQuery(e.target.value)}
          placeholder="Search members…"
          prefix={<Search size={15} />}
          aria-label="Search members"
          autoFocus
        />
        <ul className="mt-3 space-y-1.5 max-h-80 overflow-y-auto">
          {candidates.length === 0 && (
            <li className="py-8 text-center text-sm text-ink-3">No unassigned members match that search.</li>
          )}
          {candidates.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => void assign(p.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-line hover:border-brand/50 hover:bg-surface-2 text-left transition-colors"
              >
                <Avatar profile={p} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{p.full_name}</span>
                  <span className="block text-2xs text-ink-3 truncate">{p.email}</span>
                </span>
                <UserPlus size={15} className="text-ink-3 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
