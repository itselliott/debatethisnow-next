/**
 * Per-user settings service. Mirrors [app/services/settings_service.py]
 * and the whitelist from [app/models/user_settings.py:ALLOWED_SETTINGS].
 *
 * Keys NOT in ALLOWED_SETTINGS are dropped from incoming payloads (returned
 * in `rejected` so the API can surface them). Values are type-checked per
 * key. Locale is enum-restricted to ('en', 'es', null).
 */
import { prisma } from "@/lib/db";

type SettingType = "bool" | "string" | "number";

interface SettingSpec {
  type: SettingType;
  default: unknown;
  description: string;
  /** Allowed values for string-typed enum settings. null is allowed too. */
  enum?: ReadonlyArray<string | null>;
}

export const ALLOWED_SETTINGS: Record<string, SettingSpec> = {
  profile_public: {
    type: "bool",
    default: true,
    description: "Whether non-friends can view your full profile.",
  },
  push_enabled: {
    type: "bool",
    default: false,
    description: "Receive Web Push notifications when the tab is closed.",
  },
  email_digest: {
    type: "bool",
    default: false,
    description: "Receive a weekly email summary.",
  },
  profanity_filter: {
    type: "bool",
    default: false,
    description: "Censor profanity in opponent arguments (client-side only).",
  },
  sound_enabled: {
    type: "bool",
    default: true,
    description: "Play in-app sound cues (turn alerts, vote chime).",
  },
  reduce_motion: {
    type: "bool",
    default: false,
    description: "Disable animations + pulsing badges.",
  },
  locale: {
    type: "string",
    default: null,
    description: "Force language (e.g. 'en', 'es'). Null = auto-detect.",
    enum: ["en", "es", null],
  },
};

function defaults(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(ALLOWED_SETTINGS)) {
    out[key] = spec.default;
  }
  return out;
}

export async function getAll(userId: number): Promise<Record<string, unknown>> {
  const row = await prisma.userSettings.findUnique({
    where: { user_id: userId },
  });
  const out = defaults();
  if (row && row.data && typeof row.data === "object" && !Array.isArray(row.data)) {
    for (const [k, v] of Object.entries(row.data as Record<string, unknown>)) {
      if (k in ALLOWED_SETTINGS) out[k] = v;
    }
  }
  return out;
}

export async function get<T = unknown>(
  userId: number,
  key: string,
  fallback: T | undefined = undefined,
): Promise<T | undefined> {
  if (!(key in ALLOWED_SETTINGS)) return fallback;
  const all = await getAll(userId);
  return (all[key] as T) ?? (ALLOWED_SETTINGS[key]!.default as T) ?? fallback;
}

export interface SetManyResult {
  effective: Record<string, unknown>;
  rejected: string[];
}

export async function setMany(
  userId: number,
  changes: Record<string, unknown>,
): Promise<SetManyResult> {
  if (changes === null || typeof changes !== "object" || Array.isArray(changes)) {
    throw new Error("changes must be a dict");
  }
  const rejected: string[] = [];
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    const spec = ALLOWED_SETTINGS[key];
    if (!spec) {
      rejected.push(key);
      continue;
    }
    if (spec.type === "bool" && typeof value !== "boolean") {
      rejected.push(key);
      continue;
    }
    if (
      spec.type === "string" &&
      value !== null &&
      typeof value !== "string"
    ) {
      rejected.push(key);
      continue;
    }
    if (spec.type === "number" && typeof value !== "number") {
      rejected.push(key);
      continue;
    }
    if (spec.enum) {
      if (
        !spec.enum.includes(value as string | null)
      ) {
        rejected.push(key);
        continue;
      }
    }
    cleaned[key] = value;
  }

  if (Object.keys(cleaned).length > 0) {
    const existing = await prisma.userSettings.findUnique({
      where: { user_id: userId },
    });
    const merged = {
      ...((existing?.data as Record<string, unknown> | null) ?? {}),
      ...cleaned,
    };
    await prisma.userSettings.upsert({
      where: { user_id: userId },
      update: { data: merged as object },
      create: { user_id: userId, data: merged as object },
    });
  }

  return { effective: await getAll(userId), rejected };
}
