/**
 * Avatar emoji catalog. Avatars are stored as a single emoji character
 * in the `User.avatar` column — a deliberately small surface area that
 * skips image uploads + CDN + moderation entirely. Users pick from the
 * catalog; the chosen glyph renders wherever a username appears.
 *
 * Categories are purely for the picker UI; the value stored is just
 * the emoji.
 */

export interface AvatarCategory {
  label: string;
  emojis: string[];
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    label: "Beasts",
    emojis: ["🦊", "🐺", "🦁", "🐯", "🦅", "🦉", "🐢", "🐉", "🦈", "🐙", "🦂", "🦅"],
  },
  {
    label: "Symbols",
    emojis: ["⚖️", "⚔️", "🛡️", "🏆", "🎯", "🔥", "⚡", "🌟", "💎", "🗡️", "📜", "🎩"],
  },
  {
    label: "Faces",
    emojis: ["🧙", "🥷", "🦸", "🦹", "🧠", "👑", "🎭", "🤖", "👹", "👺", "💀", "👻"],
  },
  {
    label: "Crafted",
    emojis: ["🌹", "🕊️", "🦄", "🐝", "🎲", "♟️", "🎺", "🎻", "📚", "🖋️", "⚓", "🧭"],
  },
];

export const ALL_AVATARS: string[] = AVATAR_CATEGORIES.flatMap((c) => c.emojis);

export function isValidAvatar(s: unknown): boolean {
  if (typeof s !== "string") return false;
  if (s.length === 0) return true; // empty = no avatar
  // Allow anything in our catalog, plus the legacy "bot" marker so
  // existing bots keep working before backfill.
  return s === "bot" || ALL_AVATARS.includes(s);
}

/**
 * Resolve a stored avatar to something safe to render. Anything that
 * isn't a real catalog glyph (null, empty string, or the Prisma column
 * default `"default"` that every new user starts with) falls through
 * to a deterministic per-username glyph — same user, same glyph,
 * every visit.
 *
 * The earlier guard only filtered null and empty, which meant users
 * with the schema's default avatar value rendered the literal text
 * "default" wherever their face was supposed to be. Fixed by also
 * treating non-catalog strings as fallback.
 */
export function displayAvatar(
  stored: string | null | undefined,
  username: string,
): string {
  if (stored === "bot") return "🤖";
  // Accept only strings that are actual catalog entries. Anything
  // else (null, "", "default", an old emoji we removed, garbage) gets
  // the deterministic fallback below.
  if (typeof stored === "string" && ALL_AVATARS.includes(stored)) {
    return stored;
  }
  // Hash the username to pick a default. Same user always gets the
  // same glyph — gives anon users a stable visual identity without
  // any picker step.
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (h * 31 + username.charCodeAt(i)) | 0;
  }
  return ALL_AVATARS[Math.abs(h) % ALL_AVATARS.length] ?? "🧠";
}
