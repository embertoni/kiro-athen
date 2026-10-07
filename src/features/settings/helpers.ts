/**
 * Pure helpers for the account settings feature (unit-tested; no I/O).
 *
 * These validate the destructive account-deletion confirmation (the user must
 * type their exact username) and the common field edits so the UI can disable
 * actions and show inline errors before touching the server.
 */

/**
 * True when the typed confirmation exactly matches the account's username.
 * Trims surrounding whitespace but is otherwise case-sensitive and exact, so a
 * user cannot accidentally delete by typing a near-match.
 */
export function confirmsUsername(
  typed: string,
  actualUsername: string,
): boolean {
  if (!actualUsername) return false;
  return typed.trim() === actualUsername.trim();
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

/** Validate a username: 3-30 chars, letters/digits/underscore. */
export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username.trim());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate an email address shape (same regex family as AuthProvider). */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Validate a password-change form. Returns an error message (pt-BR) or null when
 * valid. Requires the current password (reauth happens server-side), a new
 * password of at least 6 chars that differs from the current one, and a matching
 * confirmation.
 */
export function validatePasswordChange(
  input: PasswordChangeInput,
): string | null {
  if (!input.currentPassword) {
    return 'Informe sua senha atual.';
  }
  if (input.newPassword.length < 6) {
    return 'A nova senha deve ter ao menos 6 caracteres.';
  }
  if (input.newPassword !== input.confirmPassword) {
    return 'As senhas não coincidem.';
  }
  if (input.newPassword === input.currentPassword) {
    return 'A nova senha deve ser diferente da atual.';
  }
  return null;
}

/** The notification types a user can toggle in settings (mirrors the DB enum). */
export const PREFERENCE_KEYS = [
  'atualizacao_curso',
  'pedido_amizade',
  'convite_sala',
  'missao',
  'lembrete_estudo',
] as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

/**
 * Resolve whether a given notification type is enabled given the stored
 * preferences map. A missing key defaults to enabled (true).
 */
export function isPreferenceEnabled(
  prefs: Record<string, boolean> | null | undefined,
  key: PreferenceKey,
): boolean {
  if (!prefs) return true;
  if (!(key in prefs)) return true;
  return prefs[key] !== false;
}
