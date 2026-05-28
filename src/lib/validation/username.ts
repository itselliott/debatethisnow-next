/**
 * Username validation — must match [app/models/user.py:_validate_username]
 * AND the reserved-name list in the same file. Used by:
 *   - POST /api/auth/register
 *   - PATCH /api/auth/me/username
 *   - OAuth find-or-create (suffix the candidate until it passes)
 *
 * Block the `deleted_` and `gone-` prefixes so a registering user can't
 * impersonate a placeholder we use after self-deletion.
 */

export const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "moderator",
  "mod",
  "support",
  "help",
  "official",
  "staff",
  "team",
  "debatethis",
  "debate",
  "anonymous",
  "anon",
  "null",
  "none",
  "owner",
  "operator",
  "security",
  "abuse",
]);

export type UsernameError =
  | "required"
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "reserved"
  | "reserved_prefix";

export interface UsernameCheckResult {
  ok: boolean;
  error?: UsernameError;
  message?: string;
  cleaned?: string;
}

/**
 * Mirrors the Python validator. Trims whitespace, applies length + regex +
 * reserved-name + prefix checks. Returns a structured result instead of
 * throwing (so callers can decide whether to 400 or to suffix-retry).
 */
export function checkUsername(raw: unknown): UsernameCheckResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, error: "required", message: "Username required" };
  }
  const cleaned = raw.trim();
  if (cleaned.length < USERNAME_MIN) {
    return {
      ok: false,
      error: "too_short",
      message: `Username must be at least ${USERNAME_MIN} characters`,
    };
  }
  if (cleaned.length > USERNAME_MAX) {
    return {
      ok: false,
      error: "too_long",
      message: `Username must be at most ${USERNAME_MAX} characters`,
    };
  }
  if (!USERNAME_REGEX.test(cleaned)) {
    return {
      ok: false,
      error: "invalid_chars",
      message:
        "Username must contain only letters, numbers, underscore, hyphen",
    };
  }
  const lower = cleaned.toLowerCase();
  if (RESERVED_USERNAMES.has(lower)) {
    return {
      ok: false,
      error: "reserved",
      message: "That username is reserved",
    };
  }
  if (lower.startsWith("deleted_") || lower.startsWith("gone-")) {
    return {
      ok: false,
      error: "reserved_prefix",
      message: "That username prefix is reserved",
    };
  }
  return { ok: true, cleaned };
}
