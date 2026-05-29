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
 * Resolve a stored avatar to something safe to render. Empty / null
 * legacy values fall back to a generic glyph keyed by the username
 * (deterministic per user so they get the same default each visit).
 */
export function displayAvatar(
  stored: string | null | undefined,
  username: string,
): string {
  if (stored && stored !== "bot" && stored !== "") return stored;
  if (stored === "bot") return "🤖";
  // Hash the username to pick a default. Same user always gets the
  // same glyph — gives anon users a stable visual identity without
  // any picker step.
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (h * 31 + username.charCodeAt(i)) | 0;
  }
  return ALL_AVATARS[Math.abs(h) % ALL_AVATARS.length] ?? "🧠";
}
