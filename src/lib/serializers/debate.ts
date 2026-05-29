/**
 * Debate row → JSON. Must match [app/models/debate.py:Debate.to_dict]
 * byte-for-byte so master_test.py and the existing JS client see the
 * exact same shape we ship today.
 *
 * Note `is_showcase` and `showcase_phase` are derived (mirror the Python
 * `_user_is_bot` fallback that also catches `_bot`-suffixed accounts
 * created before the is_bot column existed).
 */
import type {
  Debate,
  DebateMessage,
  User,
} from "@prisma/client";
import { toPublicDict, type PublicUserDict } from "@/lib/serializers/user";
import { toDebateMessageDict, type DebateMessageDict } from "@/lib/serializers/debate-message";

const TOTAL_ROUNDS = 3;

function userIsBot(
  user: Pick<User, "username" | "email" | "is_bot"> | null | undefined,
): boolean {
  if (!user) return false;
  if (user.is_bot) return true;
  const uname = user.username ?? "";
  const email = user.email ?? "";
  return uname.endsWith("_bot") || email.endsWith("@debatethis-bots.com");
}

function secondsRemaining(deadline: Date | null): number {
  if (!deadline) return 0;
  const diff = (deadline.getTime() - Date.now()) / 1000;
  return Math.max(0, Math.floor(diff));
}

type DebateForSerialize = Debate & {
  player1: User | null;
  player2: User | null;
  messages?: (DebateMessage & { author: { username: string } | null })[];
};

export interface DebateDict {
  id: number;
  topic: string;
  category: string | null;
  mode: string;
  status: string;
  phase: string | null;
  is_prep: boolean;
  is_showcase: boolean;
  showcase_phase: string;
  current_round: number | null;
  current_turn_user_id: number | null;
  seconds_remaining: number;
  turn_deadline: string | null;
  score_player1: number | null;
  score_player2: number | null;
  votes_player1: number | null;
  votes_player2: number | null;
  winner_id: number | null;
  side_player1: string | null;
  side_player2: string | null;
  elo_delta_player1: number | null;
  elo_delta_player2: number | null;
  player1: PublicUserDict | null;
  player2: PublicUserDict | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  messages?: DebateMessageDict[];
}

export function toDebateDict(
  debate: DebateForSerialize,
  options: { includeMessages?: boolean } = {},
): DebateDict {
  const isShowcase =
    userIsBot(debate.player1) && userIsBot(debate.player2);

  let showcasePhase = "";
  if (isShowcase && debate.status === "live") {
    if (debate.current_turn_user_id !== null) {
      showcasePhase = "speaking";
    } else if ((debate.current_round ?? 0) >= TOTAL_ROUNDS) {
      showcasePhase = "awaiting_vote";
    } else {
      showcasePhase = "between_rounds";
    }
  }

  const out: DebateDict = {
    id: debate.id,
    topic: debate.topic,
    category: debate.category,
    mode: debate.mode ?? "competitive",
    status: debate.status,
    phase: debate.phase,
    is_prep: Boolean(debate.is_prep),
    is_showcase: isShowcase,
    showcase_phase: showcasePhase,
    current_round: debate.current_round,
    current_turn_user_id: debate.current_turn_user_id,
    seconds_remaining: secondsRemaining(debate.turn_deadline),
    turn_deadline: debate.turn_deadline ? debate.turn_deadline.toISOString() : null,
    score_player1: debate.score_player1,
    score_player2: debate.score_player2,
    votes_player1: debate.votes_player1,
    votes_player2: debate.votes_player2,
    winner_id: debate.winner_id,
    side_player1: debate.side_player1,
    side_player2: debate.side_player2,
    elo_delta_player1: debate.elo_delta_player1,
    elo_delta_player2: debate.elo_delta_player2,
    player1: debate.player1 ? toPublicDict(debate.player1) : null,
    player2: debate.player2 ? toPublicDict(debate.player2) : null,
    created_at: debate.created_at.toISOString(),
    started_at: debate.started_at ? debate.started_at.toISOString() : null,
    completed_at: debate.completed_at ? debate.completed_at.toISOString() : null,
  };
  if (options.includeMessages && debate.messages) {
    out.messages = debate.messages.map(toDebateMessageDict);
  }
  return out;
}
