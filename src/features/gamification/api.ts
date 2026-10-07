/**
 * Gamification read helpers: medals and streak surfacing.
 *
 * Medals are granted SERVER-SIDE (grant_medals in 0010); this only reads the
 * catalog + the user's awarded rows so the UI can display them. The 4 MVP
 * medals are first_lesson, on_fire (7-day streak), bookworm (5 courses) and owl
 * (10 lessons). There is intentionally NO "Top da semana", joint streak, or
 * educator-created medal.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { MedalRow, UserMedalRow } from '@/types/database';

export const gamificationKeys = {
  medals: (userId: string | undefined) =>
    ['gamification', 'medals', userId] as const,
};

export interface MedalDisplay {
  medal: MedalRow;
  /** The user's award row, or null when not yet earned. */
  award: UserMedalRow | null;
  earned: boolean;
}

/**
 * Fetch the full medal catalog joined with the user's awards so the UI can show
 * earned (highlighted) and not-yet-earned (dimmed) medals together.
 */
export function useUserMedals(userId: string | undefined) {
  return useQuery<MedalDisplay[]>({
    enabled: !!userId,
    queryKey: gamificationKeys.medals(userId),
    queryFn: async () => {
      const [catalogRes, awardsRes] = await Promise.all([
        supabase.from('medals').select('*'),
        supabase
          .from('user_medals')
          .select('*')
          .eq('user_id', userId as string),
      ]);
      if (catalogRes.error) throw catalogRes.error;
      if (awardsRes.error) throw awardsRes.error;

      const awards = new Map(
        (awardsRes.data ?? []).map((a) => [a.medal_code, a]),
      );
      // Keep the catalog in the canonical MVP order.
      const order = ['first_lesson', 'on_fire', 'bookworm', 'owl'];
      const catalog = [...(catalogRes.data ?? [])].sort(
        (a, b) => order.indexOf(a.code) - order.indexOf(b.code),
      );

      return catalog.map((medal) => {
        const award = awards.get(medal.code) ?? null;
        return { medal, award, earned: !!award };
      });
    },
  });
}
