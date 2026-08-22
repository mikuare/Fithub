import type { Profile, Role } from '@/types';
import type { Collection, Row } from './schema';

export interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
  role: Role;
}

export class AuthError extends Error {
  constructor(message: string, public code: 'invalid_credentials' | 'email_taken' | 'weak_password' | 'not_supported' | 'unknown' = 'unknown') {
    super(message);
    this.name = 'AuthError';
  }
}

export interface Backend {
  /** Human name shown in Settings so the user always knows where data lives. */
  readonly kind: 'local' | 'supabase';
  readonly label: string;

  /* auth */
  signUp(input: SignUpInput): Promise<Profile>;
  signIn(email: string, password: string): Promise<Profile>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  currentProfile(): Promise<Profile | null>;

  /* data */
  list<C extends Collection>(collection: C, userId: string): Promise<Row<C>[]>;
  listAll<C extends Collection>(collection: C): Promise<Row<C>[]>;
  get<C extends Collection>(collection: C, key: string): Promise<Row<C> | null>;
  upsert<C extends Collection>(collection: C, row: Row<C>): Promise<Row<C>>;
  upsertMany<C extends Collection>(collection: C, rows: Row<C>[]): Promise<void>;
  remove<C extends Collection>(collection: C, key: string): Promise<void>;

  /* account lifecycle */
  deleteAccount(userId: string): Promise<void>;
}
