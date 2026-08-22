import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Role } from '@/types';
import { AuthError, type Backend, type SignUpInput } from './adapter';
import { ownerColumn, primaryKey, primaryKeyColumn, type Collection, type Row } from './schema';
import { colorFromString } from '@/lib/utils';
import { nowISO } from '@/lib/date';

/**
 * Postgres-backed backend.
 *
 * Table and column names match `supabase/migrations/*.sql` exactly, and every
 * table there has row-level security enabled — this client only ever sees rows
 * the signed-in user is entitled to. Client-side filtering here is a
 * convenience, not the security boundary.
 */
export class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const;
  readonly label = 'Supabase (Postgres)';
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  async signUp(input: SignUpInput): Promise<Profile> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: { data: { full_name: input.full_name, role: input.role } },
    });
    if (error) throw new AuthError(error.message, error.message.match(/already/i) ? 'email_taken' : 'unknown');
    if (!data.user) throw new AuthError('Check your inbox to confirm your email, then sign in.', 'unknown');
    return this.ensureProfile(data.user.id, data.user.email ?? input.email, input.full_name, input.role);
  }

  async signIn(email: string, password: string): Promise<Profile> {
    const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new AuthError('Email or password is incorrect.', 'invalid_credentials');
    const profile = await this.currentProfile();
    if (profile) return profile;
    return this.ensureProfile(data.user.id, data.user.email ?? email, data.user.user_metadata?.full_name ?? '', 'member');
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new AuthError(error.message);
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async currentProfile(): Promise<Profile | null> {
    const { data } = await this.client.auth.getUser();
    if (!data.user) return null;
    const { data: rows } = await this.client.from('profiles').select('*').eq('id', data.user.id).limit(1);
    if (rows && rows.length) return rows[0] as Profile;
    return this.ensureProfile(
      data.user.id,
      data.user.email ?? '',
      (data.user.user_metadata?.full_name as string) ?? '',
      (data.user.user_metadata?.role as Role) ?? 'member',
    );
  }

  private async ensureProfile(id: string, email: string, fullName: string, role: Role): Promise<Profile> {
    const profile: Profile = {
      id, email,
      full_name: fullName || email.split('@')[0],
      avatar_color: colorFromString(id),
      role, gym_id: null,
      created_at: nowISO(),
      onboarded: false, assessment_done: false,
    };
    const { data, error } = await this.client.from('profiles').upsert(profile).select().single();
    if (error) throw new AuthError(error.message);
    return data as Profile;
  }

  async list<C extends Collection>(collection: C, userId: string): Promise<Row<C>[]> {
    const owner = ownerColumn(collection);
    let query = this.client.from(collection).select('*');
    if (owner) query = query.eq(owner, userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Row<C>[];
  }

  async listAll<C extends Collection>(collection: C): Promise<Row<C>[]> {
    const { data, error } = await this.client.from(collection).select('*');
    if (error) throw error;
    return (data ?? []) as Row<C>[];
  }

  async get<C extends Collection>(collection: C, key: string): Promise<Row<C> | null> {
    const { data, error } = await this.client
      .from(collection).select('*').eq(primaryKeyColumn(collection), key).limit(1);
    if (error) throw error;
    return (data?.[0] as Row<C>) ?? null;
  }

  async upsert<C extends Collection>(collection: C, row: Row<C>): Promise<Row<C>> {
    const { data, error } = await this.client
      .from(collection)
      .upsert(row as never, { onConflict: primaryKeyColumn(collection) })
      .select().single();
    if (error) throw error;
    return data as Row<C>;
  }

  async upsertMany<C extends Collection>(collection: C, rows: Row<C>[]): Promise<void> {
    if (!rows.length) return;
    const { error } = await this.client
      .from(collection)
      .upsert(rows as never[], { onConflict: primaryKeyColumn(collection) });
    if (error) throw error;
  }

  async remove<C extends Collection>(collection: C, key: string): Promise<void> {
    const { error } = await this.client.from(collection).delete().eq(primaryKeyColumn(collection), key);
    if (error) throw error;
  }

  async deleteAccount(userId: string): Promise<void> {
    // The `delete_my_account` function (see migrations) removes every owned row
    // inside one transaction, then the auth user itself.
    const { error } = await this.client.rpc('delete_my_account');
    if (error) {
      // Fall back to a best-effort client-side cascade.
      await this.client.from('profiles').delete().eq('id', userId);
      throw error;
    }
    await this.signOut();
  }

  /** Unused by the app but handy for debugging RLS from the console. */
  get raw(): SupabaseClient {
    return this.client;
  }
}

export function primaryKeyOf<C extends Collection>(collection: C, row: Row<C>) {
  return primaryKey(collection, row);
}
