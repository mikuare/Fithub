import { create } from 'zustand';
import type { Profile, Role } from '@/types';
import { AuthError, backend } from '@/lib/db';
import { seedIfEmpty } from '@/lib/db/seed';

type Status = 'booting' | 'anon' | 'authed';

interface AuthState {
  status: Status;
  profile: Profile | null;
  error: string | null;
  busy: boolean;

  boot: () => Promise<void>;
  signUp: (input: { email: string; password: string; full_name: string; role: Role }) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'booting',
  profile: null,
  error: null,
  busy: false,

  boot: async () => {
    try {
      await seedIfEmpty();
      const profile = await backend().currentProfile();
      set({ profile, status: profile ? 'authed' : 'anon' });
    } catch {
      set({ profile: null, status: 'anon' });
    }
  },

  signUp: async (input) => {
    set({ busy: true, error: null });
    try {
      const profile = await backend().signUp(input);
      set({ profile, status: 'authed', busy: false });
      return true;
    } catch (e) {
      set({ error: e instanceof AuthError ? e.message : 'Could not create the account. Please try again.', busy: false });
      return false;
    }
  },

  signIn: async (email, password) => {
    set({ busy: true, error: null });
    try {
      const profile = await backend().signIn(email, password);
      set({ profile, status: 'authed', busy: false });
      return true;
    } catch (e) {
      set({ error: e instanceof AuthError ? e.message : 'Could not sign in. Please try again.', busy: false });
      return false;
    }
  },

  signInWithGoogle: async () => {
    set({ busy: true, error: null });
    try {
      await backend().signInWithGoogle();
      set({ busy: false });
    } catch (e) {
      set({ error: e instanceof AuthError ? e.message : 'Google sign-in is unavailable.', busy: false });
    }
  },

  signOut: async () => {
    await backend().signOut();
    set({ profile: null, status: 'anon' });
  },

  updateProfile: async (patch) => {
    const current = get().profile;
    if (!current) return;
    const next = { ...current, ...patch };
    await backend().upsert('profiles', next);
    set({ profile: next });
  },

  clearError: () => set({ error: null }),
}));
