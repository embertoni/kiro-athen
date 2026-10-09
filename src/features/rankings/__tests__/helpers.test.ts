import { describe, expect, it } from 'vitest';
import type { Database } from '@/types/db';
import { mapGlobalRankRow } from '../helpers';

type ViewRow = Database['public']['Views']['global_ranking']['Row'];

const USER = 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu';

describe('mapGlobalRankRow', () => {
  it('maps a fully-populated row through unchanged', () => {
    const row: ViewRow = {
      user_id: USER,
      username: 'ada',
      display_name: 'Ada Lovelace',
      avatar_url: 'https://example.com/a.png',
      xp_global: 1200,
      level: 7,
      streak_count: 4,
      position: 1,
    };
    expect(mapGlobalRankRow(row)).toEqual({
      userId: USER,
      username: 'ada',
      displayName: 'Ada Lovelace',
      avatarUrl: 'https://example.com/a.png',
      xpGlobal: 1200,
      level: 7,
      streakCount: 4,
      position: 1,
    });
  });

  it('coalesces null string/number columns to safe defaults', () => {
    const row: ViewRow = {
      user_id: null,
      username: null,
      display_name: null,
      avatar_url: null,
      xp_global: null,
      level: null,
      streak_count: null,
      position: null,
    };
    expect(mapGlobalRankRow(row)).toEqual({
      userId: '',
      username: '',
      displayName: '',
      avatarUrl: null,
      xpGlobal: 0,
      level: 0,
      streakCount: 0,
      position: 0,
    });
  });

  it('preserves a non-null avatar_url while coalescing other nulls', () => {
    const row: ViewRow = {
      user_id: USER,
      username: 'grace',
      display_name: null,
      avatar_url: 'https://example.com/g.png',
      xp_global: null,
      level: 2,
      streak_count: null,
      position: 5,
    };
    const mapped = mapGlobalRankRow(row);
    expect(mapped.avatarUrl).toBe('https://example.com/g.png');
    expect(mapped.displayName).toBe('');
    expect(mapped.xpGlobal).toBe(0);
    expect(mapped.streakCount).toBe(0);
    expect(mapped.level).toBe(2);
    expect(mapped.position).toBe(5);
  });
});
