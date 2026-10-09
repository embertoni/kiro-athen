/**
 * Pure helpers for the rankings feature (no Supabase/network imports so they
 * stay unit-testable in isolation).
 */

import type { Database } from '@/types/db';

export interface GlobalRankRow {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  xpGlobal: number;
  level: number;
  streakCount: number;
  position: number;
}

/**
 * The global_ranking VIEW generates every column as nullable, but the app's
 * GlobalRankRow requires non-null string/number fields. Coalesce at this
 * boundary (strings -> '', numbers -> 0) rather than editing the generated
 * types. avatarUrl is legitimately nullable, so it is preserved.
 */
export function mapGlobalRankRow(
  r: Database['public']['Views']['global_ranking']['Row'],
): GlobalRankRow {
  return {
    userId: r.user_id ?? '',
    username: r.username ?? '',
    displayName: r.display_name ?? '',
    avatarUrl: r.avatar_url,
    xpGlobal: r.xp_global ?? 0,
    level: r.level ?? 0,
    streakCount: r.streak_count ?? 0,
    position: r.position ?? 0,
  };
}
