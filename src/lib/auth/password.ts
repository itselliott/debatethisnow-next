/**
 * Password hashing + verification using bcryptjs, drop-in compatible with
 * the Python app's `bcrypt` hashes — bcryptjs implements the same algorithm
 * and accepts/produces the same `$2a$`/`$2b$` PHC strings, so verifying a
 * hash from the Python users.password_hash column just works.
 *
 * Mirrors [app/services/auth_service.py:23]'s timing-attack mitigation: a
 * precomputed dummy bcrypt is run on the "no such user" path so wall-clock
 * timing doesn't leak whether a given username/email is in the system.
 */
import bcrypt from "bcryptjs";

const ROUNDS = 12; // matches bcrypt.gensalt() default in Python

// Precomputed at module load. Run once, used many times. The exact plaintext
// doesn't matter — what matters is that `compare()` against this hash takes
// ~the same wall time as `compare()` against a real hash.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "timing-attack-dummy",
  ROUNDS,
);

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, ROUNDS);
}

/**
 * Returns true when the plaintext matches the stored hash. Catches any
 * malformed-hash errors and returns false (same semantics as the Python
 * helper, which catches ValueError).
 */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    return false;
  }
}

/**
 * Call this on the "user does not exist" path so the response time of a
 * bad-username login matches a wrong-password login. Discards the result.
 */
export async function runDummyBcrypt(plaintext: string): Promise<void> {
  try {
    await bcrypt.compare(plaintext, DUMMY_PASSWORD_HASH);
  } catch {
    // Don't let dummy-hash issues escape — this path must not throw.
  }
}
