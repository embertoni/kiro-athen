import { describe, expect, it } from 'vitest';
import {
  confirmsUsername,
  isPreferenceEnabled,
  isValidEmail,
  isValidUsername,
  validatePasswordChange,
} from '../helpers';

describe('confirmsUsername', () => {
  it('matches the exact username (whitespace-trimmed)', () => {
    expect(confirmsUsername('alice', 'alice')).toBe(true);
    expect(confirmsUsername('  alice  ', 'alice')).toBe(true);
  });

  it('rejects near-matches and empty input', () => {
    expect(confirmsUsername('Alice', 'alice')).toBe(false);
    expect(confirmsUsername('alic', 'alice')).toBe(false);
    expect(confirmsUsername('', 'alice')).toBe(false);
    expect(confirmsUsername('alice', '')).toBe(false);
  });
});

describe('isValidUsername', () => {
  it('accepts 3-30 char alphanumerics/underscore', () => {
    expect(isValidUsername('bob')).toBe(true);
    expect(isValidUsername('bob_123')).toBe(true);
  });

  it('rejects too short / invalid chars', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('bad name')).toBe(false);
    expect(isValidUsername('bad!')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('validates email shape', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
});

describe('validatePasswordChange', () => {
  it('requires the current password', () => {
    expect(
      validatePasswordChange({
        currentPassword: '',
        newPassword: 'abcdef',
        confirmPassword: 'abcdef',
      }),
    ).toMatch(/senha atual/i);
  });

  it('enforces a minimum length and matching confirmation', () => {
    expect(
      validatePasswordChange({
        currentPassword: 'old123',
        newPassword: 'abc',
        confirmPassword: 'abc',
      }),
    ).toMatch(/6 caracteres/i);
    expect(
      validatePasswordChange({
        currentPassword: 'old123',
        newPassword: 'abcdef',
        confirmPassword: 'abcdeX',
      }),
    ).toMatch(/não coincidem/i);
  });

  it('rejects reusing the current password', () => {
    expect(
      validatePasswordChange({
        currentPassword: 'samepass',
        newPassword: 'samepass',
        confirmPassword: 'samepass',
      }),
    ).toMatch(/diferente/i);
  });

  it('returns null for a valid change', () => {
    expect(
      validatePasswordChange({
        currentPassword: 'old123',
        newPassword: 'new456',
        confirmPassword: 'new456',
      }),
    ).toBeNull();
  });
});

describe('isPreferenceEnabled', () => {
  it('defaults missing keys to enabled', () => {
    expect(isPreferenceEnabled(null, 'missao')).toBe(true);
    expect(isPreferenceEnabled({}, 'missao')).toBe(true);
    expect(isPreferenceEnabled({ pedido_amizade: true }, 'missao')).toBe(true);
  });

  it('honors an explicit false', () => {
    expect(isPreferenceEnabled({ missao: false }, 'missao')).toBe(false);
    expect(isPreferenceEnabled({ missao: true }, 'missao')).toBe(true);
  });
});
