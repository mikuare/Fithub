import { useMemo, useState } from 'react';
import { ScrollText, Search, Shield, User } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { StatTile } from '@/components/dashboard/StatTile';
import { useData } from '@/store/data';
import { formatDate, timeAgo } from '@/lib/date';
import { matches, titleCase } from '@/lib/utils';

export default function AuditLogPage() {
  const logs = useData((s) => s.auditLogs);
  const directory = useData((s) => s.directory);
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map(directory.map((p) => [p.id, p])), [directory]);

  const rows = useMemo(
    () =>
      [...logs]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .filter((l) =>
          !query.trim() ||
          matches(l.action, query) ||
          matches(l.entity, query) ||
          matches(byId.get(l.actor_id)?.full_name ?? '', query)),
    [logs, query, byId],
  );

  const uniqueActors = new Set(logs.map((l) => l.actor_id)).size;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = logs.filter((l) => l.created_at.slice(0, 10) === today).length;

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="System"
        title="Audit log"
        subtitle="Every administrative action is recorded with the account that performed it and a timestamp."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total entries" value={logs.length} icon={<ScrollText size={15} />} />
        <StatTile label="Today" value={todayCount} icon={<Shield size={15} />} tone="brand" />
        <StatTile label="Distinct actors" value={uniqueActors} icon={<User size={15} />} />
        <StatTile label="Retention" value="Unlimited" icon={<ScrollText size={15} />} hint="entries are never deleted" />
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search action, entity or actor…"
        prefix={<Search size={15} />}
        aria-label="Search audit log"
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ScrollText size={22} />}
            title={query ? 'No matching entries' : 'No audit entries yet'}
            body={query
              ? `Nothing matches "${query}".`
              : 'Administrative actions — membership edits, equipment changes, client assignments and check-ins — are recorded here as they happen.'}
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <caption className="sr-only">Administrative audit log</caption>
              <thead className="text-2xs uppercase tracking-wider text-ink-3">
                <tr className="border-b border-line">
                  <th scope="col" className="text-left font-semibold px-5 py-3">When</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Actor</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Action</th>
                  <th scope="col" className="text-left font-semibold px-3 py-3">Entity</th>
                  <th scope="col" className="text-left font-semibold px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 200).map((l) => {
                  const actor = byId.get(l.actor_id);
                  return (
                    <tr key={l.id} className="hover:bg-surface-2 align-top">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="tabular">{formatDate(l.created_at.slice(0, 10), 'short')}</p>
                        <p className="text-2xs text-ink-3">{timeAgo(l.created_at)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{actor?.full_name ?? (l.actor_email || 'You')}</p>
                        <p className="text-2xs text-ink-3 font-mono truncate max-w-[10rem]">{l.actor_id}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge size="sm" tone={l.action.includes('delete') ? 'danger' : 'muted'}>
                          {titleCase(l.action.replace(/\./g, ' '))}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-ink-2 font-mono text-2xs">
                        {l.entity}
                        {l.entity_id && <span className="block text-ink-3 truncate max-w-[10rem]">{l.entity_id}</span>}
                      </td>
                      <td className="px-5 py-3 text-2xs text-ink-3 font-mono max-w-xs truncate">
                        {Object.keys(l.meta).length ? JSON.stringify(l.meta) : '—'}
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
        <CardHeader title="What gets recorded" dense icon={<Shield size={16} />} />
        <ul className="px-4 pb-4 pt-1 space-y-1.5 text-sm text-ink-2">
          {[
            'Membership status, plan and renewal changes',
            'Equipment status updates and maintenance records',
            'Trainer client assignments and unassignments',
            'Trainer notes added against a client',
            'Manual and QR gym check-ins and check-outs',
          ].map((item) => (
            <li key={item} className="flex gap-2 leading-relaxed">
              <span className="text-ink-3 shrink-0" aria-hidden>•</span>{item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
