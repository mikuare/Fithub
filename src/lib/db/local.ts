import type { Profile } from '@/types';
import { AuthError, type Backend, type SignUpInput } from './adapter';
import { primaryKey, type Collection, type Row } from './schema';
import { idbAll, idbByUser, idbDelete, idbDeleteUser, idbGet, idbPut, idbPutMany } from '@/lib/storage/idb';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { uid } from '@/lib/id';
import { nowISO } from '@/lib/date';
import { colorFromString } from '@/lib/utils';

const SESSION_KEY = 'fithub:session';

const normaliseEmail = (email: string) => email.trim().toLowerCase();

/**
 * Local-first backend. Everything is stored in this browser's IndexedDB.
 * No network calls, works offline, and nothing leaves the device — which also
 * means it is single-device and single-browser. Settings states this plainly.
 */
export class LocalBackend implements Backend {
  readonly kind = 'local' as const;
  readonly label = 'This browser (offline)';

  async signUp(input: SignUpInput): Promise<Profile> {
    const email = normaliseEmail(input.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AuthError('Enter a valid email address.', 'invalid_credentials');
    if (input.password.length < 8) throw new AuthError('Use at least 8 characters for your password.', 'weak_password');

    const existing = await this.findCredentialByEmail(email);
    if (existing) throw new AuthError('An account with that email already exists on this device.', 'email_taken');

    const id = uid('usr');
    const profile: Profile = {
      id,
      email,
      full_name: input.full_name.trim() || email.split('@')[0],
      avatar_color: colorFromString(id),
      role: input.role,
      gym_id: null,
      created_at: nowISO(),
      onboarded: false,
      assessment_done: false,
    };
    await idbPut('profiles', id, id, profile);
    await idbPut('credentials', id, id, {
      user_id: id,
      email,
      password_hash: await hashPassword(input.password),
      created_at: nowISO(),
    });
    localStorage.setItem(SESSION_KEY, id);
    return profile;
  }

  async signIn(email: string, password: string): Promise<Profile> {
    const cred = await this.findCredentialByEmail(normaliseEmail(email));
    // Same message for unknown email and wrong password — do not leak which.
    if (!cred) throw new AuthError('Email or password is incorrect.', 'invalid_credentials');
    const ok = await verifyPassword(password, cred.password_hash);
    if (!ok) throw new AuthError('Email or password is incorrect.', 'invalid_credentials');
    const profile = await idbGet<Profile>('profiles', cred.user_id);
    if (!profile) throw new AuthError('That account is missing its profile. Try creating it again.', 'unknown');
    localStorage.setItem(SESSION_KEY, profile.id);
    return profile;
  }

  async signInWithGoogle(): Promise<void> {
    throw new AuthError(
      'Google sign-in needs a Supabase project. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env and restart, or continue with email on this device.',
      'not_supported',
    );
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
  }

  async currentProfile(): Promise<Profile | null> {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return idbGet<Profile>('profiles', id);
  }

  async list<C extends Collection>(collection: C, userId: string): Promise<Row<C>[]> {
    return idbByUser<Row<C>>(collection, userId);
  }

  async listAll<C extends Collection>(collection: C): Promise<Row<C>[]> {
    return idbAll<Row<C>>(collection);
  }

  async get<C extends Collection>(collection: C, key: string): Promise<Row<C> | null> {
    return idbGet<Row<C>>(collection, key);
  }

  async upsert<C extends Collection>(collection: C, row: Row<C>): Promise<Row<C>> {
    const key = primaryKey(collection, row);
    const owner = ownerFor(collection, row);
    await idbPut(collection, key, owner, row);
    return row;
  }

  async upsertMany<C extends Collection>(collection: C, rows: Row<C>[]): Promise<void> {
    await idbPutMany(
      rows.map((row) => ({
        collection,
        id: primaryKey(collection, row),
        userId: ownerFor(collection, row),
        data: row,
      })),
    );
  }

  async remove<C extends Collection>(collection: C, key: string): Promise<void> {
    await idbDelete(collection, key);
  }

  async deleteAccount(userId: string): Promise<void> {
    await idbDeleteUser(userId);
    await idbDelete('profiles', userId);
    await idbDelete('credentials', userId);
    localStorage.removeItem(SESSION_KEY);
  }

  private async findCredentialByEmail(email: string) {
    const all = await idbAll<{ user_id: string; email: string; password_hash: string }>('credentials');
    return all.find((c) => c.email === email) ?? null;
  }
}

/** IndexedDB scopes rows by user for fast per-user reads. */
function ownerFor<C extends Collection>(collection: C, row: Row<C>): string | null {
  const r = row as unknown as Record<string, unknown>;
  if (collection === 'profiles') return (r.id as string) ?? null;
  if (typeof r.user_id === 'string') return r.user_id;
  if (typeof r.trainer_id === 'string') return r.trainer_id;
  if (typeof r.actor_id === 'string') return r.actor_id;
  return null;
}
