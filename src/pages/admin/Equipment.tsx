import { useMemo, useState } from 'react';
import {
  Wrench, Search, AlertTriangle, CheckCircle2, XCircle, Plus, Pencil, Clock, Activity,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/States';
import { StatTile } from '@/components/dashboard/StatTile';
import { useData } from '@/store/data';
import { uid } from '@/lib/id';
import { addDays, diffDays, formatDate, today } from '@/lib/date';
import { matches } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { EquipmentStatus, GymEquipment, MaintenanceLog } from '@/types';

const STATUS_TONE: Record<EquipmentStatus, Tone> = {
  available: 'success', in_use: 'info', maintenance: 'warn', out_of_service: 'danger',
};

const STATUS_LABEL: Record<EquipmentStatus, string> = {
  available: 'Available', in_use: 'In use', maintenance: 'Maintenance required', out_of_service: 'Out of service',
};

export default function Equipment() {
  const equipment = useData((s) => s.equipment);
  const maintenance = useData((s) => s.maintenance);
  const gym = useData((s) => s.gym);
  const put = useData((s) => s.put);
  const audit = useData((s) => s.audit);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | EquipmentStatus>('all');
  const [editing, setEditing] = useState<GymEquipment | null>(null);
  const [logging, setLogging] = useState<GymEquipment | null>(null);

  const rows = useMemo(
    () =>
      equipment
        .filter((e) => (tab === 'all' ? true : e.status === tab))
        .filter((e) => !query.trim() || matches(e.name, query) || matches(e.asset_tag, query) || matches(e.location, query))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [equipment, tab, query],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: equipment.length };
    for (const e of equipment) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [equipment]);

  const dueSoon = equipment.filter(
    (e) => e.next_maintenance && diffDays(e.next_maintenance, today()) <= 14,
  );

  const save = async (e: GymEquipment) => {
    await put('gym_equipment', e);
    await audit('equipment.update', 'gym_equipment', e.id, { status: e.status });
    setEditing(null);
    toast.success('Equipment updated', e.name);
  };

  const logMaintenance = async (item: GymEquipment, log: Omit<MaintenanceLog, 'id' | 'equipment_id' | 'gym_id'>) => {
    if (!gym) return;
    const row: MaintenanceLog = { id: uid('ml'), equipment_id: item.id, gym_id: gym.id, ...log };
    await put('maintenance_logs', row);
    await put('gym_equipment', {
      ...item,
      status: 'available',
      last_inspection: log.date,
      next_maintenance: addDays(log.date, 90),
      notes: '',
    });
    await audit('equipment.maintenance', 'maintenance_logs', row.id, { equipment_id: item.id, type: log.type });
    setLogging(null);
    toast.success('Maintenance logged', `${item.name} is back in service.`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Gym operations"
        title="Equipment"
        subtitle={gym ? `${equipment.length} assets tracked at ${gym.name}` : undefined}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total assets" value={equipment.length} icon={<Wrench size={15} />} />
        <StatTile label="Available" value={counts.available ?? 0} icon={<CheckCircle2 size={15} />} tone="brand" />
        <StatTile label="Needs maintenance" value={(counts.maintenance ?? 0) + (counts.out_of_service ?? 0)} icon={<AlertTriangle size={15} />} />
        <StatTile label="Service due (14d)" value={dueSoon.length} icon={<Clock size={15} />} />
      </div>

      {dueSoon.length > 0 && (
        <Card className="border-warn/40">
          <CardHeader title="Service due soon" icon={<Clock size={16} className="text-warn" />} dense />
          <ul className="p-4 pt-2 flex flex-wrap gap-2">
            {dueSoon.slice(0, 12).map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setLogging(e)}
                  className="px-3 h-8 rounded-lg border border-warn/40 bg-warn-soft text-xs font-medium hover:brightness-95"
                >
                  {e.name} · {e.next_maintenance ? formatDate(e.next_maintenance, 'short') : '—'}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Tabs
          value={tab}
          onChange={(k) => setTab(k as typeof tab)}
          items={[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'available', label: 'Available', count: counts.available },
            { key: 'maintenance', label: 'Maintenance', count: counts.maintenance },
            { key: 'out_of_service', label: 'Out of service', count: counts.out_of_service },
          ]}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, tag or location…"
          prefix={<Search size={15} />}
          aria-label="Search equipment"
          className="flex-1 min-w-[220px]"
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Wrench size={22} />} title="No equipment matches"
            body={query ? `Nothing matches "${query}".` : 'No assets with that status.'} />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <caption className="sr-only">Gym equipment inventory</caption>
              <thead className="text-2xs uppercase tracking-wider text-ink-3">
                <tr className="border-b border-line">
                  <th scope="col" className="text-left font-semibold px-5 py-3">Asset</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Category</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Location</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Status</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Last inspection</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Next service</th>
                  <th scope="col" className="text-right font-semibold px-3 py-3">Usage</th>
                  <th scope="col" className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => {
                  const overdue = e.next_maintenance && e.next_maintenance < today();
                  return (
                    <tr key={e.id} className="hover:bg-surface-2">
                      <td className="px-5 py-3">
                        <p className="font-medium">{e.name}</p>
                        <p className="text-2xs text-ink-3 font-mono">{e.asset_tag}</p>
                        {e.notes && <p className="text-2xs text-warn mt-0.5">{e.notes}</p>}
                      </td>
                      <td className="px-3 text-ink-2">{e.category}</td>
                      <td className="px-3 text-ink-3">{e.location}</td>
                      <td className="px-3">
                        <Badge
                          size="sm"
                          tone={STATUS_TONE[e.status]}
                          icon={e.status === 'available' ? <CheckCircle2 size={10} /> : e.status === 'out_of_service' ? <XCircle size={10} /> : <AlertTriangle size={10} />}
                        >
                          {STATUS_LABEL[e.status]}
                        </Badge>
                      </td>
                      <td className="px-3 tabular text-ink-3">{e.last_inspection ? formatDate(e.last_inspection, 'short') : '—'}</td>
                      <td className="px-3 tabular">
                        <span className={overdue ? 'text-danger font-semibold' : 'text-ink-3'}>
                          {e.next_maintenance ? formatDate(e.next_maintenance, 'short') : '—'}
                        </span>
                        {overdue && <span className="block text-2xs text-danger">Overdue</span>}
                      </td>
                      <td className="px-3 text-right tabular text-ink-3">{e.usage_hours}h</td>
                      <td className="px-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            type="button" onClick={() => setLogging(e)}
                            aria-label={`Log maintenance for ${e.name}`}
                            className="h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-3"
                          >
                            <Wrench size={13} />
                          </button>
                          <button
                            type="button" onClick={() => setEditing(e)}
                            aria-label={`Edit ${e.name}`}
                            className="h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-3"
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
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
        <CardHeader title="Recent maintenance" subtitle={`${maintenance.length} records`} icon={<Activity size={16} />} />
        {maintenance.length === 0 ? (
          <EmptyState compact icon={<Wrench size={20} />} title="No maintenance recorded" />
        ) : (
          <ul className="divide-y divide-line max-h-80 overflow-y-auto">
            {[...maintenance].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((m) => {
              const item = equipment.find((e) => e.id === m.equipment_id);
              return (
                <li key={m.id} className="flex items-center gap-4 px-5 py-2.5 text-sm">
                  <span className="w-24 shrink-0 tabular text-ink-3">{formatDate(m.date, 'short')}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{item?.name ?? m.equipment_id}</span>
                  <Badge size="sm" tone="muted">{m.type}</Badge>
                  <span className="w-20 text-right tabular text-ink-3">{m.cost !== null ? `$${m.cost}` : '—'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editing && (
        <Modal
          open onClose={() => setEditing(null)} title={editing.name} size="md"
          footer={<Button block onClick={() => void save(editing)}>Save changes</Button>}
        >
          <div className="space-y-3">
            <Input label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Asset tag" value={editing.asset_tag} onChange={(e) => setEditing({ ...editing, asset_tag: e.target.value })} />
              <Input label="Category" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
            </div>
            <Input label="Location" value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
            <Select
              label="Status" value={editing.status}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as EquipmentStatus })}
              options={(Object.keys(STATUS_LABEL) as EquipmentStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Last inspection" type="date" value={editing.last_inspection ?? ''}
                onChange={(e) => setEditing({ ...editing, last_inspection: e.target.value || null })} />
              <Input label="Next service" type="date" value={editing.next_maintenance ?? ''}
                onChange={(e) => setEditing({ ...editing, next_maintenance: e.target.value || null })} />
            </div>
            <Textarea label="Notes" rows={2} value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              placeholder="e.g. Belt slipping under load — reported by a member." />
          </div>
        </Modal>
      )}

      {logging && <MaintenanceModal item={logging} onClose={() => setLogging(null)} onSave={logMaintenance} />}
    </div>
  );
}

function MaintenanceModal({ item, onClose, onSave }: {
  item: GymEquipment;
  onClose: () => void;
  onSave: (item: GymEquipment, log: Omit<MaintenanceLog, 'id' | 'equipment_id' | 'gym_id'>) => void | Promise<void>;
}) {
  const [date, setDate] = useState(today());
  const [type, setType] = useState<MaintenanceLog['type']>('service');
  const [performedBy, setPerformedBy] = useState('Facilities team');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Modal
      open onClose={onClose} title={`Log maintenance — ${item.name}`}
      description="Logging maintenance returns the asset to service and schedules the next check in 90 days."
      footer={
        <Button
          block
          onClick={() => void onSave(item, {
            date, type, performed_by: performedBy.trim() || 'Unknown',
            cost: cost ? Number(cost) : null, notes,
          })}
        >
          Log and return to service
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          <Select
            label="Type" value={type}
            onChange={(e) => setType(e.target.value as MaintenanceLog['type'])}
            options={[
              { value: 'inspection', label: 'Inspection' }, { value: 'service', label: 'Service' },
              { value: 'repair', label: 'Repair' }, { value: 'replacement', label: 'Replacement' },
            ]}
          />
        </div>
        <Input label="Performed by" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
        <Input label="Cost" type="number" inputMode="decimal" prefix="$" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="What was done, and anything to watch." />
        <div className="p-3 rounded-xl bg-surface-2 border border-line">
          <p className="text-2xs text-ink-3 leading-relaxed">
            <Plus size={11} className="inline -mt-0.5 mr-1" />
            This is written to the audit log with your account and the current time.
          </p>
        </div>
      </div>
    </Modal>
  );
}
