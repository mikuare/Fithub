import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, StickyNote, Plus, Send, Lock, Calendar, Dumbbell, Target, Trophy, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Textarea, Input, Toggle } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/States';
import { StatTile } from '@/components/dashboard/StatTile';
import { Avatar } from '@/components/layout/AppShell';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { uid } from '@/lib/id';
import { formatDate, nowISO, relativeDay, timeAgo, today } from '@/lib/date';
import { toast } from '@/store/toast';
import type { Message, TrainerNote } from '@/types';

/**
 * A trainer's view of one client.
 *
 * The local backend stores one user's rows per browser, so a trainer running
 * locally will not see another member's private training rows — which is the
 * correct outcome. With Supabase configured, RLS policies decide what loads,
 * and this screen renders whatever the database permits.
 */
export default function ClientDetail() {
  const { clientId = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const clients = useData((s) => s.trainerClients);
  const notes = useData((s) => s.trainerNotes);
  const messages = useData((s) => s.messages);
  const directory = useData((s) => s.directory);
  const allCheckins = useData((s) => s.allCheckins);
  const put = useData((s) => s.put);
  const del = useData((s) => s.del);
  const audit = useData((s) => s.audit);

  const [tab, setTab] = useState<'overview' | 'notes' | 'messages'>('overview');
  const [noteText, setNoteText] = useState('');
  const [noteVisible, setNoteVisible] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [focus, setFocus] = useState('');

  const assignment = clients.find((c) => c.client_id === clientId);
  const person = directory.find((p) => p.id === clientId);
  const clientNotes = useMemo(
    () => notes.filter((n) => n.client_id === clientId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [notes, clientId],
  );
  const thread = useMemo(
    () => messages
      .filter((m) => m.thread_key === [profile?.id, clientId].sort().join(':'))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, profile?.id, clientId],
  );
  const checkins = useMemo(
    () => allCheckins.filter((c) => c.user_id === clientId).sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at)),
    [allCheckins, clientId],
  );

  if (!assignment || !person) {
    return (
      <div className="max-w-lg mx-auto py-10">
        <Card>
          <EmptyState
            icon={<Lock size={22} />}
            title="This client is not assigned to you"
            body="Trainers can only view members explicitly assigned to them. If this is a mistake, ask a gym manager to assign them."
            action={<Button to="/trainer">Back to your clients</Button>}
          />
        </Card>
      </div>
    );
  }

  const addNote = async () => {
    if (!profile || !noteText.trim()) return;
    const row: TrainerNote = {
      id: uid('tn'), trainer_id: profile.id, client_id: clientId,
      body: noteText.trim(), created_at: nowISO(), visible_to_client: noteVisible,
    };
    await put('trainer_notes', row);
    await audit('trainer.add_note', 'trainer_notes', row.id, { client_id: clientId });
    setNoteText('');
    toast.success('Note saved');
  };

  const sendMessage = async () => {
    if (!profile || !messageText.trim()) return;
    const row: Message = {
      id: uid('msg'),
      thread_key: [profile.id, clientId].sort().join(':'),
      from_id: profile.id, to_id: clientId, user_id: profile.id,
      body: messageText.trim(), created_at: nowISO(), read_at: null,
    };
    await put('messages', row);
    setMessageText('');
    toast.success('Message sent');
  };

  const saveFocus = async () => {
    await put('trainer_clients', { ...assignment, focus: focus.trim() });
    setFocus('');
    toast.success('Focus updated');
  };

  const visitsLast30 = checkins.filter((c) => c.checked_in_at.slice(0, 10) >= formatISO(-30)).length;

  return (
    <div className="space-y-5 max-w-4xl">
      <button
        type="button"
        onClick={() => navigate('/trainer')}
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
      >
        <ArrowLeft size={15} /> All clients
      </button>

      <Card>
        <div className="p-5 flex flex-wrap items-center gap-4">
          <Avatar profile={person} size={58} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black tracking-tight truncate">{person.full_name}</h1>
            <p className="text-sm text-ink-3">{person.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="brand">Your client</Badge>
              <Badge tone="muted">Since {formatDate(assignment.since, 'medium')}</Badge>
              {assignment.focus && <Badge tone="accent">{assignment.focus}</Badge>}
            </div>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={async () => {
              await put('trainer_clients', { ...assignment, active: false });
              await audit('trainer.unassign_client', 'trainer_clients', assignment.id, { client_id: clientId });
              toast.info('Client unassigned');
              navigate('/trainer');
            }}
          >
            Unassign
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Gym visits (30d)" value={visitsLast30} icon={<Calendar size={15} />} tone="brand" />
        <StatTile label="Last visit" value={checkins[0] ? relativeDay(checkins[0].checked_in_at.slice(0, 10)) : '—'} icon={<Dumbbell size={15} />} />
        <StatTile label="Trainer notes" value={clientNotes.length} icon={<StickyNote size={15} />} />
        <StatTile label="Messages" value={thread.length} icon={<MessageSquare size={15} />} />
      </div>

      <Tabs
        value={tab}
        onChange={(k) => setTab(k as typeof tab)}
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'notes', label: 'Notes', count: clientNotes.length },
          { key: 'messages', label: 'Messages', count: thread.length },
        ]}
      />

      {tab === 'overview' && (
        <>
          <Card className="border-accent/30">
            <div className="p-4 flex items-start gap-3">
              <EyeOff size={17} className="shrink-0 mt-0.5 text-accent-text" />
              <div>
                <p className="text-sm font-semibold">What you can see</p>
                <p className="mt-1 text-sm text-ink-3 leading-relaxed">
                  Programme, workout history, goals, records and attendance for this client. Progress photos,
                  nutrition and recovery check-ins stay private unless the client turns sharing on for you.
                  Every note and assignment you make is written to the audit log.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Coaching focus" subtitle="A short label shown on your client list." />
            <div className="p-5 pt-2 flex gap-2">
              <Input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder={assignment.focus || 'e.g. Squat technique and hip mobility'}
                className="flex-1"
                aria-label="Coaching focus"
              />
              <Button onClick={() => void saveFocus()} disabled={!focus.trim()}>Save</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Gym attendance" subtitle={`${checkins.length} recorded check-ins`} />
            {checkins.length === 0 ? (
              <EmptyState compact icon={<Calendar size={20} />} title="No check-ins recorded" />
            ) : (
              <ul className="divide-y divide-line max-h-80 overflow-y-auto">
                {checkins.slice(0, 20).map((c) => (
                  <li key={c.id} className="flex items-center gap-4 px-5 py-2.5 text-sm">
                    <span className="w-28 shrink-0 font-medium">{relativeDay(c.checked_in_at.slice(0, 10))}</span>
                    <span className="flex-1 text-ink-3 tabular">
                      {new Date(c.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {c.checked_out_at && ` – ${new Date(c.checked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                    <Badge size="sm" tone="muted">{c.method}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Programme and progress" icon={<Target size={16} />} />
            <div className="p-5 pt-2">
              <p className="text-sm text-ink-3 leading-relaxed">
                {`Detailed programme, goal and record data for ${person.full_name} loads from the database subject to
                row-level security. In local mode this browser only holds your own training rows, so those
                sections stay empty until a Postgres backend is connected.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="muted" icon={<Dumbbell size={11} />}>Workout history</Badge>
                <Badge tone="muted" icon={<Target size={11} />}>Goals</Badge>
                <Badge tone="muted" icon={<Trophy size={11} />}>Personal records</Badge>
              </div>
            </div>
          </Card>
        </>
      )}

      {tab === 'notes' && (
        <>
          <Card>
            <CardHeader title="Add a note" />
            <div className="p-5 pt-2 space-y-3">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g. Knees tracked inward on the last two sets of squats — cue 'spread the floor' next session."
                rows={3}
                aria-label="Note body"
              />
              <Toggle
                checked={noteVisible}
                onChange={setNoteVisible}
                label="Visible to the client"
                description="Turn off for internal coaching notes the client should not see."
              />
              <Button onClick={() => void addNote()} disabled={!noteText.trim()} icon={<Plus size={15} />}>Save note</Button>
            </div>
          </Card>

          {clientNotes.length === 0 ? (
            <Card>
              <EmptyState compact icon={<StickyNote size={20} />} title="No notes yet"
                body="Notes are the difference between coaching and just watching." />
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-line">
                {clientNotes.map((n) => (
                  <li key={n.id} className="px-5 py-3.5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink-2 leading-relaxed">{n.body}</p>
                        <p className="mt-1.5 text-2xs text-ink-3">
                          {timeAgo(n.created_at)} · {n.visible_to_client ? 'Visible to client' : 'Internal only'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void del('trainer_notes', n.id)}
                        className="text-2xs text-ink-3 hover:text-danger shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === 'messages' && (
        <Card>
          <CardHeader title={`Messages with ${person.full_name.split(' ')[0]}`} />
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {thread.length === 0 ? (
              <EmptyState compact icon={<MessageSquare size={20} />} title="No messages yet"
                body="Send a short check-in between sessions." />
            ) : (
              thread.map((m) => (
                <div key={m.id} className={m.from_id === profile?.id ? 'flex justify-end' : 'flex'}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.from_id === profile?.id
                      ? 'bg-brand text-brand-contrast rounded-br-sm'
                      : 'bg-surface-2 border border-line rounded-bl-sm'
                  }`}>
                    <p className="leading-relaxed">{m.body}</p>
                    <p className={`mt-1 text-2xs ${m.from_id === profile?.id ? 'opacity-70' : 'text-ink-3'}`}>
                      {timeAgo(m.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
            className="border-t border-line p-3 flex gap-2"
          >
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Write a message…"
              aria-label="Message"
              className="flex-1 h-11 px-4 rounded-xl bg-surface-2 border border-line text-sm placeholder:text-ink-3 focus:border-brand/60"
            />
            <Button type="submit" disabled={!messageText.trim()} icon={<Send size={15} />} aria-label="Send message">
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

function formatISO(daysFromToday: number): string {
  const d = new Date(today() + 'T00:00:00');
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
