import { describe, expect, it } from 'vitest';
import { extractErrorMessage, formatError } from '../errors';

const FALLBACK = 'Não foi possível salvar o curso';

describe('extractErrorMessage', () => {
  it('reads the message from an Error instance', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('reads the message from a plain string', () => {
    expect(extractErrorMessage('falhou')).toBe('falhou');
  });

  it('trims surrounding whitespace', () => {
    expect(extractErrorMessage('  spaced  ')).toBe('spaced');
  });

  it('reads a PostgrestError-shaped object with code/details/hint', () => {
    const err = {
      message: 'duplicate key value violates unique constraint',
      details: 'Key (slug)=(x) already exists.',
      hint: 'Use another slug.',
      code: '23505',
    };
    expect(extractErrorMessage(err)).toBe(
      'duplicate key value violates unique constraint [23505 — Key (slug)=(x) already exists. — Use another slug.]',
    );
  });

  it('reads a PostgrestError-shaped object with only a message', () => {
    expect(extractErrorMessage({ message: 'row not found' })).toBe(
      'row not found',
    );
  });

  it('reads an AuthError-shaped object (message only)', () => {
    const authError = { message: 'Invalid login credentials', status: 400 };
    expect(extractErrorMessage(authError)).toBe('Invalid login credentials');
  });

  it('ignores null/undefined extra fields on PostgrestError shapes', () => {
    const err = {
      message: 'constraint failed',
      details: null,
      hint: null,
      code: null,
    };
    expect(extractErrorMessage(err)).toBe('constraint failed');
  });

  it('returns null for null/undefined', () => {
    expect(extractErrorMessage(null)).toBeNull();
    expect(extractErrorMessage(undefined)).toBeNull();
  });

  it('returns null for empty strings and objects without a message', () => {
    expect(extractErrorMessage('')).toBeNull();
    expect(extractErrorMessage('   ')).toBeNull();
    expect(extractErrorMessage({ code: '500' })).toBeNull();
    expect(extractErrorMessage(42)).toBeNull();
  });
});

describe('formatError', () => {
  it('combines the fallback context with an Error cause', () => {
    expect(formatError(new Error('timeout'), FALLBACK)).toBe(
      `${FALLBACK}: timeout`,
    );
  });

  it('combines the fallback context with a PostgrestError cause', () => {
    const err = { message: 'permission denied', code: '42501' };
    expect(formatError(err, FALLBACK)).toBe(
      `${FALLBACK}: permission denied [42501]`,
    );
  });

  it('combines the fallback context with an AuthError cause', () => {
    const err = { message: 'Email not confirmed' };
    expect(formatError(err, 'Não foi possível entrar')).toBe(
      'Não foi possível entrar: Email not confirmed',
    );
  });

  it('combines the fallback context with a string cause', () => {
    expect(formatError('rede indisponível', FALLBACK)).toBe(
      `${FALLBACK}: rede indisponível`,
    );
  });

  it('returns the bare fallback when there is no cause', () => {
    expect(formatError(null, FALLBACK)).toBe(FALLBACK);
    expect(formatError(undefined, FALLBACK)).toBe(FALLBACK);
    expect(formatError({}, FALLBACK)).toBe(FALLBACK);
  });

  it('returns the cause alone when the fallback is empty', () => {
    expect(formatError(new Error('boom'), '')).toBe('boom');
  });

  it('does not duplicate when the cause equals the fallback', () => {
    expect(formatError(FALLBACK, FALLBACK)).toBe(FALLBACK);
  });
});
