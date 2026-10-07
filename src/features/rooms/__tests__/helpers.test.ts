import { describe, expect, it } from 'vitest';
import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
  buildRoomJoinLink,
  compareByPacDesc,
  compareByXpDesc,
  formatAccessCode,
  generateAccessCode,
  isValidAccessCodeFormat,
  normalizeAccessCode,
  pacDisplay,
  sortByPacDesc,
  sortByXpDesc,
} from '../helpers';

describe('access code generation + normalization', () => {
  it('generates a code of the requested length from the allowed alphabet', () => {
    const code = generateAccessCode();
    expect(code).toHaveLength(ACCESS_CODE_LENGTH);
    for (const ch of code) {
      expect(ACCESS_CODE_ALPHABET).toContain(ch);
    }
    expect(generateAccessCode(8)).toHaveLength(8);
  });

  it('normalizes to uppercase alphanumerics, stripping separators', () => {
    expect(normalizeAccessCode('abc-def')).toBe('ABCDEF');
    expect(normalizeAccessCode('  ab 12  ')).toBe('AB12');
    expect(normalizeAccessCode('a!b@c#1')).toBe('ABC1');
    expect(normalizeAccessCode('')).toBe('');
  });
});

describe('formatAccessCode', () => {
  it('groups into blocks of 3 by default', () => {
    expect(formatAccessCode('ABCDEF')).toBe('ABC-DEF');
    expect(formatAccessCode('abc-def')).toBe('ABC-DEF');
    expect(formatAccessCode('ABCD')).toBe('ABC-D');
  });

  it('respects a custom group size and empty input', () => {
    expect(formatAccessCode('ABCDEF', 2)).toBe('AB-CD-EF');
    expect(formatAccessCode('')).toBe('');
    expect(formatAccessCode('   ')).toBe('');
  });
});

describe('isValidAccessCodeFormat', () => {
  it('accepts plausible codes and rejects too-short/too-long ones', () => {
    expect(isValidAccessCodeFormat('ABC-DEF')).toBe(true);
    expect(isValidAccessCodeFormat('abc')).toBe(false); // < 4 after normalize
    expect(isValidAccessCodeFormat('A'.repeat(17))).toBe(false);
  });
});

describe('buildRoomJoinLink', () => {
  it('derives a /rooms?join link from the code (no email needed)', () => {
    expect(buildRoomJoinLink('ABC-DEF', 'https://athen.app')).toBe(
      'https://athen.app/rooms?join=ABCDEF',
    );
  });

  it('normalizes the code before encoding', () => {
    expect(buildRoomJoinLink('ab c1', 'https://x.io')).toBe(
      'https://x.io/rooms?join=ABC1',
    );
  });
});

describe('ranking comparators', () => {
  it('orders by XP desc, breaking ties by name asc', () => {
    const sorted = sortByXpDesc([
      { xp: 100, name: 'Bruno' },
      { xp: 300, name: 'Ana' },
      { xp: 100, name: 'Ana' },
    ]);
    expect(sorted.map((r) => `${r.name}:${r.xp}`)).toEqual([
      'Ana:300',
      'Ana:100',
      'Bruno:100',
    ]);
  });

  it('compareByXpDesc returns the right sign', () => {
    expect(
      compareByXpDesc({ xp: 5, name: 'a' }, { xp: 3, name: 'b' }),
    ).toBeLessThan(0);
    expect(
      compareByXpDesc({ xp: 3, name: 'a' }, { xp: 5, name: 'b' }),
    ).toBeGreaterThan(0);
  });

  it('orders by PAC desc with name tiebreaker', () => {
    const sorted = sortByPacDesc([
      { pac: 50, name: 'Zoe' },
      { pac: 90, name: 'Ivo' },
      { pac: 50, name: 'Ana' },
    ]);
    expect(sorted.map((r) => r.name)).toEqual(['Ivo', 'Ana', 'Zoe']);
    expect(
      compareByPacDesc({ pac: 10, name: 'a' }, { pac: 20, name: 'b' }),
    ).toBeGreaterThan(0);
  });

  it('does not mutate the input array', () => {
    const input = [
      { xp: 1, name: 'a' },
      { xp: 2, name: 'b' },
    ];
    const snapshot = [...input];
    sortByXpDesc(input);
    expect(input).toEqual(snapshot);
  });
});

describe('pacDisplay (PAC/division mapping)', () => {
  it('maps PAC to the mirrored division band with a color', () => {
    expect(pacDisplay(0).division).toBe('Bronze');
    expect(pacDisplay(59).division).toBe('Bronze');
    expect(pacDisplay(60).division).toBe('Prata');
    expect(pacDisplay(74).division).toBe('Prata');
    expect(pacDisplay(75).division).toBe('Gold');
    expect(pacDisplay(84).division).toBe('Gold');
    expect(pacDisplay(85).division).toBe('Platina');
    expect(pacDisplay(94).division).toBe('Platina');
    expect(pacDisplay(95).division).toBe('Diamante');
    expect(pacDisplay(100).division).toBe('Diamante');
    expect(pacDisplay(50).color).toBeTruthy();
  });

  it('rounds the value to one decimal and clamps out-of-range input', () => {
    expect(pacDisplay(83.26).value).toBe(83.3);
    expect(pacDisplay(-10).value).toBe(0);
    expect(pacDisplay(150).division).toBe('Diamante');
    expect(pacDisplay(Number.NaN).value).toBe(0);
  });

  it('prefers a valid server-provided division', () => {
    // Server says Gold even though a naive mirror of 50 would be Bronze.
    expect(pacDisplay(50, 'Gold').division).toBe('Gold');
    // Unknown server label falls back to the mirror.
    expect(pacDisplay(95, 'Nonsense').division).toBe('Diamante');
  });
});
