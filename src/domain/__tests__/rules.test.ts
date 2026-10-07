import { describe, expect, it } from 'vitest';
import {
  divisionForPac,
  fillBlankMatches,
  levelForXp,
  normalizeFillBlank,
  pacFromCounts,
  xpForQuestion,
} from '../rules';
import { DIVISION_BANDS, LEVEL_THRESHOLDS, QUESTION_XP } from '../constants';

describe('xpForQuestion / QUESTION_XP (SQL xp_from_question mirror)', () => {
  it('awards the exact XP per question type', () => {
    expect(xpForQuestion('match')).toBe(2);
    expect(xpForQuestion('multiple_choice')).toBe(4);
    expect(xpForQuestion('fill_blank')).toBe(6);
    expect(xpForQuestion('sum_alternatives')).toBe(8);
  });

  it('pins the XP table so a rule change breaks the test', () => {
    expect(QUESTION_XP).toEqual({
      match: 2,
      multiple_choice: 4,
      fill_blank: 6,
      sum_alternatives: 8,
    });
  });
});

describe('domain constant tables (SQL parity guards)', () => {
  it('pins the level thresholds (L1..L5) exactly', () => {
    expect(LEVEL_THRESHOLDS).toEqual([
      { level: 1, min: 0, max: 99 },
      { level: 2, min: 100, max: 249 },
      { level: 3, min: 250, max: 499 },
      { level: 4, min: 500, max: 999 },
      { level: 5, min: 1000, max: 1999 },
    ]);
  });

  it('pins the division bands exactly', () => {
    expect(DIVISION_BANDS).toEqual([
      { division: 'Bronze', min: 0, max: 59 },
      { division: 'Prata', min: 60, max: 74 },
      { division: 'Gold', min: 75, max: 84 },
      { division: 'Platina', min: 85, max: 94 },
      { division: 'Diamante', min: 95, max: 100 },
    ]);
  });
});

describe('levelForXp', () => {
  it('resolves boundary XP values to the correct level', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(249)).toBe(2);
    expect(levelForXp(250)).toBe(3);
    expect(levelForXp(999)).toBe(4);
    expect(levelForXp(1000)).toBe(5);
    expect(levelForXp(1999)).toBe(5);
    expect(levelForXp(2000)).toBe(6);
    expect(levelForXp(4000)).toBe(7);
  });

  it('clamps non-positive XP to level 1', () => {
    expect(levelForXp(-50)).toBe(1);
  });
});

describe('divisionForPac', () => {
  it('resolves boundary PAC values to the correct division', () => {
    expect(divisionForPac(59)).toBe('Bronze');
    expect(divisionForPac(60)).toBe('Prata');
    expect(divisionForPac(74)).toBe('Prata');
    expect(divisionForPac(75)).toBe('Gold');
    expect(divisionForPac(84)).toBe('Gold');
    expect(divisionForPac(85)).toBe('Platina');
    expect(divisionForPac(94)).toBe('Platina');
    expect(divisionForPac(95)).toBe('Diamante');
    expect(divisionForPac(100)).toBe('Diamante');
  });

  it('clamps the low end to Bronze', () => {
    expect(divisionForPac(0)).toBe('Bronze');
  });

  it('classifies fractional PAC in the band gaps like the SQL (open bounds)', () => {
    // PAC = correct/total*100 is frequently fractional; these would regress to
    // 'Diamante' under the old integer-band lookup. They must match
    // SQL division_for_pac: < 60 -> Bronze, <= 74 -> Prata, <= 84 -> Gold.
    expect(divisionForPac(59.5)).toBe('Bronze');
    expect(divisionForPac(60.5)).toBe('Prata');
    expect(divisionForPac(74.5)).toBe('Gold');
    expect(divisionForPac(84.5)).toBe('Platina');
    expect(divisionForPac(94.5)).toBe('Diamante');
  });
});

describe('pacFromCounts', () => {
  it('returns 0 when total is 0', () => {
    expect(pacFromCounts(0, 0)).toBe(0);
    expect(pacFromCounts(5, 0)).toBe(0);
  });

  it('computes correct/total * 100', () => {
    expect(pacFromCounts(3, 4)).toBe(75);
  });
});

describe('normalizeFillBlank', () => {
  it('ignores case, accents and surrounding whitespace', () => {
    expect(normalizeFillBlank('  Ação ')).toBe('acao');
    expect(fillBlankMatches('Ação', 'acao')).toBe(true);
    expect(fillBlankMatches('  AÇÃO  ', 'acao')).toBe(true);
  });

  it('collapses internal whitespace', () => {
    expect(normalizeFillBlank('a   b')).toBe('a b');
  });

  it('distinguishes genuinely different answers', () => {
    expect(fillBlankMatches('casa', 'carro')).toBe(false);
  });
});
