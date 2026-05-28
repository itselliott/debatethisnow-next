/**
 * Elo rating math. Mirrors [app/services/elo_service.py] exactly so
 * existing user.elo_rating values evolve identically under both apps.
 *
 * K-factor read from env (defaults to 32). Score: 1.0 = win, 0.5 = draw,
 * 0.0 = loss.
 */
import { env } from "@/lib/env";

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function calculateDelta(
  rating: number,
  opponentRating: number,
  score: number,
  k: number = env.ELO_K_FACTOR,
): number {
  const expected = expectedScore(rating, opponentRating);
  return Math.round(k * (score - expected));
}

export interface ApplyMatchResult {
  newRatingA: number;
  newRatingB: number;
  deltaA: number;
  deltaB: number;
}

export function applyMatch(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  k: number = env.ELO_K_FACTOR,
): ApplyMatchResult {
  const deltaA = calculateDelta(ratingA, ratingB, scoreA, k);
  const deltaB = calculateDelta(ratingB, ratingA, 1 - scoreA, k);
  return {
    newRatingA: ratingA + deltaA,
    newRatingB: ratingB + deltaB,
    deltaA,
    deltaB,
  };
}
