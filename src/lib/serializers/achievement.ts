/**
 * Achievement + UserAchievement → JSON. Mirrors
 * [app/models/achievement.py:to_dict] on both rows.
 */
import type { Achievement, UserAchievement } from "@prisma/client";

export interface AchievementDict {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  tier: string | null;
}

export function toAchievementDict(a: Achievement): AchievementDict {
  return {
    code: a.code,
    name: a.name,
    description: a.description,
    icon: a.icon,
    tier: a.tier,
  };
}

export interface UserAchievementDict {
  code: string;
  awarded_at: string | null;
  name: string;
  description: string;
  icon: string;
  tier: string;
}

export function toUserAchievementDict(
  ua: UserAchievement & { achievement: Achievement | null },
): UserAchievementDict {
  const a = ua.achievement;
  return {
    code: ua.code,
    awarded_at: ua.awarded_at ? ua.awarded_at.toISOString() : null,
    name: a?.name ?? ua.code,
    description: a?.description ?? "",
    icon: a?.icon ?? "★",
    tier: a?.tier ?? "bronze",
  };
}
