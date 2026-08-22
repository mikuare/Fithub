import type { Backend } from './adapter';
import { LocalBackend } from './local';
import { SupabaseBackend } from './supabase';

export * from './adapter';
export * from './schema';

let instance: Backend | null = null;

/**
 * Picks the Supabase backend when credentials are configured, otherwise falls
 * back to the local browser database so the app is always runnable.
 */
export function backend(): Backend {
  if (instance) return instance;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key && /^https?:\/\//.test(url)) {
    try {
      instance = new SupabaseBackend(url, key);
      return instance;
    } catch {
      // A malformed URL or key should degrade to local rather than break boot.
    }
  }
  instance = new LocalBackend();
  return instance;
}

export function backendKind(): 'local' | 'supabase' {
  return backend().kind;
}
