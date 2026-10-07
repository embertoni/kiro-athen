import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { NormalizeDatabase } from '@/types/supabase-compat';

/**
 * The generated `Database` type uses plain `interface` row shapes, which the
 * installed @supabase/supabase-js version rejects (it needs rows assignable to
 * `Record<string, unknown>`). `NormalizeDatabase` rewrites those rows through a
 * mapped type so the typed client resolves tables instead of falling back to
 * `never`. See src/types/supabase-compat.ts for the full explanation.
 */
type SupabaseDatabase = NormalizeDatabase<Database>;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in development so a missing .env.local is obvious.
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and set ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  );
}

/**
 * Typed Supabase client. The server (RLS + domain functions) is authoritative;
 * this client only reads/writes within the policies the backend enforces.
 */
export const supabase = createClient<SupabaseDatabase>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
