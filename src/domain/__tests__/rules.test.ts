import { describe, expect, it } from 'vitest';
import {
  divisionForPac,
  fillBlankMatches,
  levelForXp,
  normalizeFillBlank,
  pacFromCounts,
} from '../rules';

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
