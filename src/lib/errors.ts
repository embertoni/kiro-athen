/**
 * Shared error-formatting helpers.
 *
 * The app talks to Supabase, which surfaces failures in a few different
 * shapes: thrown `Error` instances, `PostgrestError`-shaped objects for data
 * calls ({ message, details, hint, code } — NOT `instanceof Error`), and
 * `AuthError` objects for auth calls (which carry a `.message`). The old
 * `err instanceof Error ? err.message : 'generic'` pattern silently swallowed
 * the Postgrest/Auth shapes into a generic fallback, which made debugging the
 * page hard.
 *
 * `formatError` extracts a human-readable cause from any of those shapes and
 * combines it with the caller's Portuguese context label so the message always
 * states WHAT failed AND why, whenever a real cause is available.
 */

/** Duck-typed PostgrestError shape (not an `Error` instance in these typings). */
interface PostgrestErrorShape {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasStringMessage(
  value: unknown,
): value is { message: string } & Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    isNonEmptyString((value as { message: unknown }).message)
  );
}

/**
 * Builds a debug-friendly string from a PostgrestError-shaped object. Prefers
 * `message` and appends `code`/`details`/`hint` when they add information.
 */
function formatPostgrestError(err: PostgrestErrorShape): string {
  const base = err.message.trim();
  const extras: string[] = [];

  if (isNonEmptyString(err.code)) {
    extras.push(err.code.trim());
  }
  if (isNonEmptyString(err.details) && err.details.trim() !== base) {
    extras.push(err.details.trim());
  }
  if (isNonEmptyString(err.hint) && err.hint.trim() !== base) {
    extras.push(err.hint.trim());
  }

  return extras.length > 0 ? `${base} [${extras.join(' — ')}]` : base;
}

/**
 * Extracts a human-readable cause from an unknown error, or `null` when no
 * meaningful message is available. Pure and dependency-free.
 */
export function extractErrorMessage(err: unknown): string | null {
  if (err == null) {
    return null;
  }

  if (typeof err === 'string') {
    return isNonEmptyString(err) ? err.trim() : null;
  }

  if (err instanceof Error) {
    return isNonEmptyString(err.message) ? err.message.trim() : null;
  }

  // PostgrestError / AuthError and other `{ message, ... }` shapes.
  if (hasStringMessage(err)) {
    return formatPostgrestError(err as PostgrestErrorShape);
  }

  return null;
}

/**
 * Formats an unknown error into a user-readable, debug-friendly message.
 *
 * The caller supplies a Portuguese `fallback` describing WHAT failed (e.g.
 * "Não foi possível salvar o curso"). When a real underlying cause can be
 * extracted, it is appended so the final message states both the context and
 * the cause: `"${fallback}: ${cause}"`. When no cause is available (or it is
 * identical to the fallback), the bare `fallback` is returned.
 */
export function formatError(err: unknown, fallback: string): string {
  const cause = extractErrorMessage(err);

  if (cause === null) {
    return fallback;
  }

  const trimmedFallback = fallback.trim();
  if (trimmedFallback.length === 0) {
    return cause;
  }

  // Avoid redundant "X: X" when the cause already equals the fallback.
  if (cause === trimmedFallback) {
    return trimmedFallback;
  }

  return `${trimmedFallback}: ${cause}`;
}
