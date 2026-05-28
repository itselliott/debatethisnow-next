/**
 * UserStats → JSON. Mirrors [app/models/user_stats.py:to_dict].
 */
import type { UserStats } from "@prisma/client";

export interface UserStatsDict {
  peak_elo: number | null;
  avg_words_per_argument: number | null;
  longest_win_streak: number | null;
  current_streak: number | null;
  total_arguments: number | null;
  total_audience_votes: number | null;
  favorite_category: string | null;
}

export function toUserStatsDict(s: UserStats): UserStatsDict {
  return {
    peak_elo: s.peak_elo,
    avg_words_per_argument: s.avg_words_per_argument,
    longest_win_streak: s.longest_win_streak,
    current_streak: s.current_streak,
    total_arguments: s.total_arguments,
    total_audience_votes: s.total_audience_votes,
    favorite_category: s.favorite_category,
  };
}
