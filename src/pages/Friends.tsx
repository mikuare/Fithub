import { useMemo, useState } from 'react';
import { Users, UserPlus, Lock, Search, X, Heart, Trophy, Flame, Send } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Toggle } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/States';
import { Avatar } from '@/components/layout/AppShell';
import { useData } from '@/store/data';
import { useAuth } from '@/store/auth';
import { uid } from '@/lib/id';
import { nowISO, timeAgo } from '@/lib/date';
import { matches } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { Friendship } from '@/types';

export default function Friends() {
  const { profile } = useAuth();
  const friendships = useData((s) => s.friendships);
  const directory = useData((s) => s.directory);
  const feed = useData((s) => s.feed);
  const prefs = useData((s) => s.preferences);
  const put = useData((s) => s.put);
  const del = useData((s) => s.del);

  const [tab, setTab] = useState<'friends' | 'find' | 'feed'>('friends');
  const [query, setQuery] = useState('');

  const accepted = friendships.filter((f) => f.status === 'accepted');
  const pending = friendships.filter((f) => f.status === 'pending');

  const byId = useMemo(() => new Map(directory.map((p) => [p.id, p])), [directory]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const linked = new Set(friendships.map((f) => f.friend_id));
    return directory
      .filter((p) => p.id !== profile?.id && !linked.has(p.id) && p.role === 'member')
      .filter((p) => matches(p.full_name, query))
      .slice(0, 12);
  }, [directory, query, friendships, profile?.id]);

  const addFriend = async (friendId: string) => {
    if (!profile) return;
    const row: Friendship = {
      id: uid('fr'), user_id: profile.id, friend_id: friendId,
      status: 'pending', created_at: nowISO(),
    };
    await put('friendships', row);
    toast.success('Request sent', 'They will appear in your list once they accept.');
  };

  if (!prefs) return null;

  const sharingOff =
    !prefs.privacy.share_workouts && !prefs.privacy.share_records && prefs.privacy.profile_visibility === 'private';

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        eyebrow="Community"
        title="Friends"
        subtitle="Optional and private by default. Nothing about your training is visible to anyone until you turn sharing on."
      />

      <Card className={sharingOff ? 'border-accent/30' : undefined}>
        <CardHeader title="Sharing" icon={<Lock size={16} className="text-accent-text" />} dense />
        <div className="p-4 pt-2 space-y-1">
          <Toggle
            checked={prefs.privacy.share_workouts}
            onChange={(v) => void put('user_preferences', { ...prefs, privacy: { ...prefs.privacy, share_workouts: v } })}
            label="Share completed workouts"
            description="Friends can see that you trained and the session type — never your loads, notes or measurements."
          />
          <Toggle
            checked={prefs.privacy.share_records}
            onChange={(v) => void put('user_preferences', { ...prefs, privacy: { ...prefs.privacy, share_records: v } })}
            label="Share personal records"
            description="New records appear in your friends' feed."
          />
          <Toggle
            checked={prefs.privacy.leaderboard_opt_in}
            onChange={(v) => void put('user_preferences', { ...prefs, privacy: { ...prefs.privacy, leaderboard_opt_in: v } })}
            label="Appear on challenge leaderboards"
            description="Only the metric for challenges you have joined."
          />
          <p className="pt-2 text-2xs text-ink-3 leading-relaxed">
            Progress photos, body measurements, nutrition and recovery check-ins are never shared, whatever
            these settings say.
          </p>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={(k) => setTab(k as typeof tab)}
        items={[
          { key: 'friends', label: 'My friends', count: accepted.length },
          { key: 'find', label: 'Find people' },
          { key: 'feed', label: 'Activity', count: feed.length },
        ]}
      />

      {tab === 'friends' && (
        <>
          {pending.length > 0 && (
            <Card>
              <CardHeader title="Pending requests" dense />
              <ul className="divide-y divide-line">
                {pending.map((f) => {
                  const person = byId.get(f.friend_id);
                  return (
                    <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                      {person && <Avatar profile={person} size={34} />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{person?.full_name ?? 'Unknown'}</p>
                        <p className="text-2xs text-ink-3">Sent {timeAgo(f.created_at)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void del('friendships', f.id)} icon={<X size={13} />}>
                        Cancel
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {accepted.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Users size={22} />}
                title="No friends yet"
                body="Training with people you know is one of the strongest predictors of sticking with it. Entirely optional though."
                action={<Button onClick={() => setTab('find')} icon={<UserPlus size={15} />}>Find people</Button>}
              />
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {accepted.map((f) => {
                const person = byId.get(f.friend_id);
                if (!person) return null;
                return (
                  <Card key={f.id}>
                    <div className="p-4 flex items-center gap-3">
                      <Avatar profile={person} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{person.full_name}</p>
                        <p className="text-2xs text-ink-3">Friends since {timeAgo(f.created_at)}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => void del('friendships', f.id)}>Remove</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'find' && (
        <>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members by name…"
            prefix={<Search size={15} />}
            aria-label="Search members"
          />
          {query.trim() === '' ? (
            <Card>
              <EmptyState compact icon={<Search size={20} />} title="Search for someone"
                body="You can only find members of the same gym, and only by name." />
            </Card>
          ) : searchResults.length === 0 ? (
            <Card>
              <EmptyState compact icon={<Users size={20} />} title="No matches"
                body={`Nobody matching "${query}".`} />
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-line">
                {searchResults.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar profile={p} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{p.full_name}</p>
                      <p className="text-2xs text-ink-3">Member</p>
                    </div>
                    <Button size="sm" onClick={() => void addFriend(p.id)} icon={<UserPlus size={13} />}>Add</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === 'feed' && (
        <Card>
          {feed.length === 0 ? (
            <EmptyState
              icon={<Heart size={22} />}
              title="Nothing in your feed"
              body="Activity from friends who share their workouts and records appears here. Yours appears in theirs only if you have sharing turned on."
            />
          ) : (
            <ul className="divide-y divide-line">
              {[...feed].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((post) => (
                <li key={post.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="h-9 w-9 rounded-xl bg-surface-2 grid place-items-center text-ink-2 shrink-0">
                      {post.kind === 'record' ? <Trophy size={16} /> : post.kind === 'workout' ? <Flame size={16} /> : <Send size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{post.title}</p>
                      {post.body && <p className="text-sm text-ink-3 mt-0.5 leading-relaxed">{post.body}</p>}
                      <p className="text-2xs text-ink-3 mt-1">{timeAgo(post.created_at)}</p>
                      <div className="mt-2 flex gap-1.5">
                        {['💪', '🔥', '👏'].map((emoji) => {
                          const reactors = post.reactions[emoji] ?? [];
                          const mine = profile ? reactors.includes(profile.id) : false;
                          return (
                            <button
                              key={emoji}
                              type="button"
                              aria-pressed={mine}
                              onClick={() => {
                                if (!profile) return;
                                const next = { ...post.reactions };
                                next[emoji] = mine ? reactors.filter((id) => id !== profile.id) : [...reactors, profile.id];
                                void put('feed_posts', { ...post, reactions: next });
                              }}
                              className={`px-2.5 h-7 rounded-lg border text-xs transition-colors ${
                                mine ? 'border-brand/50 bg-brand-soft' : 'border-line hover:border-line-strong'
                              }`}
                            >
                              {emoji} {reactors.length > 0 && <span className="tabular ml-0.5">{reactors.length}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
