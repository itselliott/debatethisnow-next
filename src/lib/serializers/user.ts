/**
 * User-row → JSON serializers. These have to match the Python app's
 * `to_public_dict` / `to_private_dict` / `to_admin_dict` exactly so
 * master_test.py and the existing JS client see identical shapes.
 *
 * Mirrors [app/models/user.py:138-178].
 */
import type { User } from "@prisma/client";
import { winRate } from "@/lib/services/rank-service";

export interface PublicUserDict {
  id: number;
  username: string;
  elo_rating: number;
  wins: number;
  losses: number;
  debates_completed: number;
  win_rate: number;
  avatar: string | null;
  rank_tier: string | null;
  is_bot: boolean;
  bot_description: string | null;
  owner_id: number | null;
}

export interface PrivateUserDict extends PublicUserDict {
  email: string;
  online_status: string | null;
  created_at: string | null;
  last_seen_at: string | null;
  is_admin: boolean;
  // Surfaced so the client can show the "Save your account" CTA in
  // the EndScreen modal and the sidebar when a guest user finishes a
  // debate. Real (claimed) accounts always return false.
  is_guest: boolean;
}

export interface AdminUserDict extends PrivateUserDict {
  is_banned: boolean;
  api_key_set: boolean;
}

export function toPublicDict(user: User): PublicUserDict {
  return {
    id: user.id,
    username: user.username,
    elo_rating: user.elo_rating,
    wins: user.wins,
    losses: user.losses,
    debates_completed: user.debates_completed,
    win_rate: winRate(user.wins, user.losses),
    avatar: user.avatar,
    rank_tier: user.rank_tier,
    is_bot: Boolean(user.is_bot),
    bot_description: user.bot_description,
    owner_id: user.owner_id,
  };
}

export function toPrivateDict(user: User): PrivateUserDict {
  return {
    ...toPublicDict(user),
    email: user.email,
    online_status: user.online_status,
    created_at: user.created_at ? user.created_at.toISOString() : null,
    last_seen_at: user.last_seen_at ? user.last_seen_at.toISOString() : null,
    is_admin: Boolean(user.is_admin),
    is_guest: Boolean(user.is_guest),
  };
}

export function toAdminDict(user: User): AdminUserDict {
  return {
    ...toPrivateDict(user),
    is_banned: Boolean(user.is_banned),
    api_key_set: Boolean(user.api_key),
  };
}
