import { describe, expect, it } from 'vitest';
import { nextTheme, resolveInitialTheme } from '../theme';

describe('resolveInitialTheme', () => {
  it('prefers a valid stored light value', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
  });

  it('prefers a valid stored dark value', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark');
  });

  it('falls back to OS dark preference when nothing stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(undefined, true)).toBe('dark');
  });

  it('falls back to light when nothing stored and OS prefers light', () => {
    expect(resolveInitialTheme(null, false)).toBe('light');
  });

  it('ignores invalid stored values', () => {
    expect(resolveInitialTheme('purple', false)).toBe('light');
    expect(resolveInitialTheme('', true)).toBe('dark');
  });
});

describe('nextTheme', () => {
  it('toggles light to dark and back', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });
});
