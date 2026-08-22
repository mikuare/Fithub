import { useMemo, useState } from 'react';
import { Flag, Trophy, Users, Check, Plus, Info, Lock, Globe, Building2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/Icon';
import { useData } from '@/store/data';
import { useAuth } from '@/store/auth';
import { CHALLENGE_METRIC_LABEL } from '@/data/challenges';
import { diffDays, formatDate, today } from '@/lib/date';
import { cn, pluralize } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { Challenge } from '@/types';

export default function Challenges() {
  const { profile } = useAuth();
  const challenges = useData((s) => s.challenges);
  const members = useData((s) => s.challengeMembers);
  const directory = useData((s) => s.directory);
  const leaderboardOptIn = useData((s) => s.preferences?.privacy.leaderboard_opt_in ?? false);
  const join = useData((s) => s.joinChallenge);
  const leave = useData((s) => s.leaveChallenge);
  const updateProgress = useData((s) => s.updateChallengeProgress);

  const [tab, setTab] = useState<'live' | 'mine' | 'finished'>('live');
  const [joining, setJoining] = useState<Challenge | null>(null);
  const [optIn, setOptIn] = useState(leaderboardOptIn);

  const memberOf = useMemo(() => new Map(members.map((m) => [m.challenge_id, m])), [members]);

  const filtered = useMemo(() => {
    const live = challenges.filter((c) => c.end_date >= today() && c.start_date <= today());
    if (tab === 'live') return live;
    if (tab === 'mine') return challenges.filter((c) => memberOf.has(c.id));
    return challenges.filter((c) => c.end_date < today() || memberOf.get(c.id)?.completed_at);
  }, [challenges, memberOf, tab]);

  const scopeIcon = (scope: Challenge['scope']) =>
    scope === 'gym' ? Building2 : scope === 'friends' ? Users : Globe;

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="FitHub Challenges"
        title="Something to aim at"
        subtitle="Progress is computed from what you already log — there is nothing extra to track. Leaderboards are opt-in."
      />

      <Tabs
        value={tab}
        onChange={(k) => setTab(k as typeof tab)}
        items={[
          { key: 'live', label: 'Open now', count: challenges.filter((c) => c.end_date >= today() && c.start_date <= today()).length },
          { key: 'mine', label: 'Joined', count: members.length },
          { key: 'finished', label: 'Finished' },
        ]}
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Flag size={22} />}
            title={tab === 'mine' ? 'You have not joined a challenge' : 'Nothing here yet'}
            body={tab === 'mine'
              ? 'Challenges are a low-pressure way to add a target to work you are already doing.'
              : 'New challenges appear as they open.'}
            action={tab === 'mine' ? <Button onClick={() => setTab('live')}>Browse open challenges</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const member = memberOf.get(c.id);
            const pct = member ? Math.min(100, (member.progress / c.target) * 100) : 0;
            const daysLeft = diffDays(c.end_date, today());
            const ScopeIcon = scopeIcon(c.scope);
            const completed = !!member?.completed_at;

            return (
              <Card key={c.id} className={cn(completed && 'border-success/40')}>
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <span className={cn(
                      'h-11 w-11 rounded-2xl grid place-items-center shrink-0',
                      completed ? 'bg-success-soft text-success' : 'bg-brand-soft text-brand-text',
                    )}>
                      {completed ? <Trophy size={20} /> : <Icon name={c.icon} size={20} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold leading-tight">{c.name}</h3>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge size="sm" tone="muted" icon={<ScopeIcon size={10} />}>
                          {c.scope === 'gym' ? 'Gym-wide' : c.scope === 'friends' ? 'Friends' : 'Everyone'}
                        </Badge>
                        <Badge size="sm" tone={daysLeft <= 3 ? 'warn' : 'muted'}>
                          {daysLeft > 0 ? `${pluralize(daysLeft, 'day')} left` : 'Finished'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-ink-3 leading-relaxed">{c.description}</p>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-sm mb-1.5">
                      <span className="text-ink-3">{CHALLENGE_METRIC_LABEL[c.metric]}</span>
                      <span className="tabular font-semibold">
                        {member ? Math.round(member.progress * 10) / 10 : 0} / {c.target} {c.unit}
                      </span>
                    </div>
                    <ProgressBar value={pct} tone={completed ? 'success' : 'brand'} />
                  </div>

                  <p className="mt-2 text-2xs text-ink-3 tabular">
                    {formatDate(c.start_date, 'short')} – {formatDate(c.end_date, 'short')}
                  </p>

                  <div className="mt-4 flex gap-2">
                    {member ? (
                      <>
                        <Button
                          variant="outline" size="sm" className="flex-1"
                          onClick={async () => { await leave(c.id); toast.info('Left challenge', c.name); }}
                        >
                          Leave
                        </Button>
                        <Button size="sm" className="flex-1" onClick={() => void updateProgress()}>Refresh progress</Button>
                      </>
                    ) : (
                      <Button size="sm" block onClick={() => setJoining(c)} icon={<Plus size={14} />}>
                        Join challenge
                      </Button>
                    )}
                  </div>

                  {completed && (
                    <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success">
                      <Check size={15} /> Completed
                    </p>
                  )}

                  {/* Optional leaderboard */}
                  {member?.on_leaderboard && (
                    <div className="mt-4 pt-3 border-t border-line">
                      <p className="text-2xs font-semibold uppercase tracking-wider text-ink-3 mb-2">Leaderboard</p>
                      <ol className="space-y-1.5">
                        <li className="flex items-center gap-2 text-sm">
                          <span className="w-5 text-2xs font-bold tabular text-ink-3">1</span>
                          <span className="flex-1 truncate font-medium">{profile?.full_name} (you)</span>
                          <span className="tabular font-semibold">{Math.round(member.progress * 10) / 10}</span>
                        </li>
                        {directory.filter((p) => p.role === 'member').slice(0, 4).map((p, i) => (
                          <li key={p.id} className="flex items-center gap-2 text-sm text-ink-3">
                            <span className="w-5 text-2xs font-bold tabular">{i + 2}</span>
                            <span className="flex-1 truncate">{p.full_name}</span>
                            <span className="tabular">—</span>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-2 text-2xs text-ink-3">
                        Other members appear here only if they have also opted in.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <div className="p-4 flex items-start gap-2.5">
          <Lock size={15} className="shrink-0 mt-0.5 text-ink-3" />
          <p className="text-2xs text-ink-3 leading-relaxed">
            Joining a challenge does not share your workouts, measurements or records with anyone. Only the
            single challenge metric is used, and only if you opt in to the leaderboard.
          </p>
        </div>
      </Card>

      {joining && (
        <Modal
          open onClose={() => setJoining(null)} title={`Join "${joining.name}"`}
          description={joining.description}
          footer={
            <Button
              block
              onClick={async () => {
                await join(joining.id, optIn);
                setJoining(null);
                toast.success('Challenge joined', joining.name);
              }}
            >
              Join challenge
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-surface-2 border border-line">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-3">Target</dt><dd className="font-semibold tabular">{joining.target} {joining.unit}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Measured by</dt><dd className="font-semibold">{CHALLENGE_METRIC_LABEL[joining.metric]}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3">Window</dt><dd className="font-semibold tabular">{formatDate(joining.start_date, 'short')} – {formatDate(joining.end_date, 'short')}</dd></div>
              </dl>
            </div>

            <Toggle
              checked={optIn}
              onChange={setOptIn}
              label="Show me on the leaderboard"
              description="Off by default. Your progress on this one metric would be visible to other participants."
            />

            <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
              <Info size={12} className="shrink-0 mt-0.5" />
              Progress is calculated from workouts and habits you already log inside the challenge window —
              including anything you logged before joining.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
