/**
 * Guest-user creation + claim. Powers the anon-to-anon challenge
 * flow:
 *
 *   1. Anon visits /play, picks a nickname + topic + side, hits
 *      "Get share link". Server calls `createGuestUser()` + opens a
 *      Challenge row with `target_id = null`. Anon's browser holds a
 *      normal JWT cookie pair tied to their fresh guest user.
 *   2. Anon shares the link (/c/<id>). The friend clicks it, picks
 *      their own nickname, hits "Accept". Server calls
 *      `createGuestUser()` for the friend, updates the challenge to
 *      `target_id = <friend.id>`, and creates the live Debate. Both
 *      tabs now have JWTs tied to guest users.
 *   3. Debate runs identically to a normal one — guests are just
 *      User rows with `is_guest=true`. ELO updates, achievements,
 *      vote history all work without any special-casing.
 *   4. After the debate, the EndScreen modal shows a "Save your
 *      account" CTA. Clicking opens /register?claim=1; the register
 *      route detects the guest cookie + calls `claimGuestAccount()`,
 *      which flips is_guest to false and sets the real email +
 *      password. Username carries over (the guest's auto-generated
 *      `username` field stays unique forever).
 *
 * Design notes:
 *   - Username collisions are handled by appending a random 4-char
 *     suffix to the user-supplied nickname. We retry up to 5 times
 *     in case of a rare unique-constraint race.
 *   - Guests get a placeholder email (`guest+<id>@guest.local`) so
 *     the unique-email constraint stays satisfied without polluting
 *     the real address namespace. Email is replaced on claim.
 *   - Guests get a random unreachable password hash. They can't log
 *     in directly — only via the cookie they got at creation.
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSuffix(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return out;
}

/**
 * Build a username that satisfies the schema's
 * VARCHAR(32) + unique constraint. Strips anything that isn't a
 * word char, appends a 4-char random suffix, caps at 28+suffix=32.
 */
function buildGuestUsername(nickname: string): string {
  // Strip whitespace + non-alphanumerics; preserve underscores.
  const cleaned =
    (nickname || "Guest")
      .replace(/[^A-Za-z0-9_]+/g, "")
      .slice(0, 27) || "Guest";
  return `${cleaned}-${randomSuffix(4)}`;
}

/** Random placeholder email — guaranteed unique via the suffix. */
function buildGuestEmail(): string {
  return `guest+${Date.now()}-${randomSuffix(6).toLowerCase()}@guest.local`;
}

/**
 * Create a fresh guest User row. Retries on the rare unique-
 * constraint collision (e.g. two clients submitted "Anonymous" at
 * the same millisecond). Throws after 5 failed attempts so callers
 * see a 500 rather than a confusing "duplicate username" leak.
 */
export async function createGuestUser(
  nickname: string,
): Promise<User> {
  // Unreachable password hash — the user has no way to know what
  // we hashed, so login-by-credentials is impossible. They can only
  // auth via the cookie we hand back at creation.
  const unreachable = await bcrypt.hash(`guest-${randomSuffix(32)}`, 10);

  for (let attempt = 0; attempt < 5; attempt++) {
    const username = buildGuestUsername(nickname);
    try {
      return await prisma.user.create({
        data: {
          username,
          email: buildGuestEmail(),
          password_hash: unreachable,
          is_guest: true,
        },
      });
    } catch (err) {
      // Prisma throws on unique-constraint violation; just try a
      // different suffix.
      if (attempt === 4) throw err;
    }
  }
  // Unreachable — the loop either returns or throws on attempt 4.
  throw new Error("createGuestUser exhausted retries");
}

export class ClaimError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/**
 * Upgrade a guest user to a full account. Replaces the placeholder
 * email + password_hash, flips is_guest=false, and (optionally)
 * lets the user pick a new username — though by default we keep the
 * one they debated under so their match history stays attributed.
 *
 * Throws ClaimError on:
 *   - User not found or not a guest (race or stale cookie)
 *   - Email or username already taken by another account
 */
export async function claimGuestAccount(
  guestUserId: number,
  opts: {
    email: string;
    password: string;
    newUsername?: string;
  },
): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { id: guestUserId } });
  if (!existing) throw new ClaimError("not_found", "Guest session expired.");
  if (!existing.is_guest) {
    throw new ClaimError(
      "not_guest",
      "This account has already been claimed.",
    );
  }
  const email = opts.email.trim().toLowerCase();
  if (!email || !/.+@.+\..+/.test(email)) {
    throw new ClaimError("bad_email", "Enter a valid email address.");
  }
  if (opts.password.length < 8) {
    throw new ClaimError(
      "bad_password",
      "Password must be at least 8 characters.",
    );
  }
  // Username — optional rename. Default to keeping the guest one
  // (with the trailing -XXXX suffix), which preserves attribution.
  const username = (opts.newUsername ?? existing.username).trim();
  if (username.length === 0 || username.length > 32) {
    throw new ClaimError(
      "bad_username",
      "Username must be 1–32 characters.",
    );
  }

  // Collision check. A SELECT-then-UPDATE race is theoretically
  // possible; the unique-constraint in the catch below is the
  // authoritative guard.
  const collisionEmail = await prisma.user.findFirst({
    where: { email, id: { not: guestUserId } },
    select: { id: true },
  });
  if (collisionEmail) {
    throw new ClaimError(
      "email_taken",
      "An account with that email already exists. Try logging in.",
    );
  }
  if (username !== existing.username) {
    const collisionName = await prisma.user.findFirst({
      where: { username, id: { not: guestUserId } },
      select: { id: true },
    });
    if (collisionName) {
      throw new ClaimError("username_taken", "That username is taken.");
    }
  }

  const hash = await bcrypt.hash(opts.password, 12);
  try {
    return await prisma.user.update({
      where: { id: guestUserId },
      data: {
        email,
        password_hash: hash,
        username,
        is_guest: false,
      },
    });
  } catch (err) {
    // Race lost to the unique constraint.
    throw new ClaimError(
      "email_taken",
      "An account with that email already exists.",
    );
  }
}
