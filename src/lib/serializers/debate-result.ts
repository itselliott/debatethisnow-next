/**
 * DebateResult → JSON. Mirrors [app/models/debate_result.py:to_dict].
 */
import type { DebateResult } from "@prisma/client";

export interface DebateResultDict {
  id: number;
  debate_id: number;
  winner_id: number | null;
  loser_id: number | null;
  final_score_player1: number | null;
  final_score_player2: number | null;
  ai_score_player1: number | null;
  ai_score_player2: number | null;
  votes_player1: number | null;
  votes_player2: number | null;
  elo_change_winner: number | null;
  elo_change_loser: number | null;
  summary: string | null;
  created_at: string | null;
}

export function toDebateResultDict(r: DebateResult): DebateResultDict {
  return {
    id: r.id,
    debate_id: r.debate_id,
    winner_id: r.winner_id,
    loser_id: r.loser_id,
    final_score_player1: r.final_score_player1,
    final_score_player2: r.final_score_player2,
    ai_score_player1: r.ai_score_player1,
    ai_score_player2: r.ai_score_player2,
    votes_player1: r.votes_player1,
    votes_player2: r.votes_player2,
    elo_change_winner: r.elo_change_winner,
    elo_change_loser: r.elo_change_loser,
    summary: r.summary,
    created_at: r.created_at ? r.created_at.toISOString() : null,
  };
}
