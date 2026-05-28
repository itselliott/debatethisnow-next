/**
 * Auth business logic — mirrors [app/services/auth_service.py].
 *
 * Two public verbs:
 *   - registerUser({ username, email, password })
 *   - authenticate({ identifier, password })
 *
 * Plus OAuth helpers (used by /api/auth/oauth/<provider>/callback routes).
 *
 * Constant-time login: when the identifier doesn't match any user we still
 * run a dummy bcrypt so wall-clock timing doesn't leak account existence.
 */
import { prisma } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  runDummyBcrypt,
} from "@/lib/auth/password";
import { checkUsername } from "@/lib/validation/username";
import type { User } from "@prisma/client";
import { rankTierForElo } from "@/lib/services/rank-service";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function validateEmail(raw: string): string {
  const email = normalizeEmail(raw);
  if (!email || !EMAIL_REGEX.test(email) || email.length > 255) {
    throw new AuthError("invalid email");
  }
  return email;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export async function registerUser(input: RegisterInput): Promise<User> {
  if (!input.username || !input.email || !input.password) {
    throw new AuthError(
      "username, email, and password are required",
    );
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  const usernameCheck = checkUsername(input.username);
  if (!usernameCheck.ok) {
    throw new AuthError(usernameCheck.message ?? "invalid username");
  }
  const username = usernameCheck.cleaned!;
  const email = validateEmail(input.email);

  // Case-insensitive uniqueness on username (Python: SQLAlchemy validator
  // strips whitespace; uniqueness via DB UNIQUE constraint, case-sensitive
  // by default in Postgres — we add explicit lower() comparison here so
  // "Alice" and "alice" don't both register).
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: username, mode: "insensitive" } },
        { email },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    throw new AuthError("username or email already taken", 409);
  }

  const password_hash = await hashPassword(input.password);
  const elo_rating = 1000;
  const rank_tier = rankTierForElo(elo_rating);

  // Wrap user + stats in one transaction so a half-created account is
  // never visible to other readers.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username,
        email,
        password_hash,
        elo_rating,
        wins: 0,
        losses: 0,
        debates_completed: 0,
        avatar: "default",
        rank_tier,
        online_status: "online",
      },
    });
    await tx.userStats.create({
      data: {
        user_id: created.id,
        peak_elo: elo_rating,
        avg_words_per_argument: 0,
        longest_win_streak: 0,
        current_streak: 0,
        total_arguments: 0,
        total_audience_votes: 0,
      },
    });
    return created;
  });
  return user;
}

export interface AuthenticateInput {
  identifier: string;
  password: string;
}

export async function authenticate(input: AuthenticateInput): Promise<User> {
  const identifier = input.identifier.trim();
  if (!identifier || !input.password) {
    throw new AuthError("identifier and password required", 400);
  }
  // username comparison stays case-sensitive (Python's auth_service does
  // the same — usernames are unique exactly as stored). Email comparison
  // is lowercased.
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { email: normalizeEmail(identifier) },
      ],
    },
  });
  if (user === null) {
    // Run a real bcrypt comparison so the no-such-user path takes about
    // the same wall-clock time as a wrong-password path.
    await runDummyBcrypt(input.password);
    throw new AuthError("invalid credentials", 401);
  }
  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) {
    throw new AuthError("invalid credentials", 401);
  }
  if (user.is_banned) {
    throw new AuthError("banned", 403);
  }

  // Touch last_seen + online_status. Best-effort — never fail the login if
  // this update bounces.
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { last_seen_at: new Date(), online_status: "online" },
    });
  } catch (err) {
    console.warn(
      "[auth] last_seen update failed:",
      err instanceof Error ? err.message : err,
    );
  }
  return user;
}
