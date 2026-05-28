/**
 * /results/<id> — end-screen recap. Polls /api/debates/<id> until the
 * result row exists (or status flips to completed/abandoned).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toDebateDict } from "@/lib/serializers/debate";
import { toDebateResultDict } from "@/lib/serializers/debate-result";
import {
  bestArgument,
  roundBreakdown,
} from "@/lib/services/scoring-service";

export const metadata = { title: "Results · DebateThis" };

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const debateId = Number.parseInt(id, 10);
  if (!Number.isInteger(debateId)) notFound();
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      player1: true,
      player2: true,
      result: true,
      messages: {
        include: { author: { select: { username: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (!debate) notFound();

  const d = toDebateDict(debate, { includeMessages: false });
  const result = debate.result ? toDebateResultDict(debate.result) : null;
  const breakdown =
    debate.messages.length > 0 ? roundBreakdown(debate, debate.messages) : [];
  const best =
    debate.messages.length > 0 ? bestArgument(debate.messages) : null;

  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Results
        </span>
        <h1 className="mt-1 font-display text-3xl">{d.topic}</h1>
        <p className="text-sm text-sepia">
          {d.category} · {debate.messages.length} arguments
        </p>
      </header>

      {result ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <ScoreCard
            name={d.player1?.username ?? "?"}
            final={result.final_score_player1 ?? 0}
            ai={result.ai_score_player1 ?? 0}
            votes={result.votes_player1 ?? 0}
            delta={d.elo_delta_player1 ?? 0}
            isWinner={result.winner_id === d.player1?.id}
          />
          <ScoreCard
            name={d.player2?.username ?? "?"}
            final={result.final_score_player2 ?? 0}
            ai={result.ai_score_player2 ?? 0}
            votes={result.votes_player2 ?? 0}
            delta={d.elo_delta_player2 ?? 0}
            isWinner={result.winner_id === d.player2?.id}
          />
        </section>
      ) : (
        <p className="rounded border border-gold bg-paper-2 p-4 text-sm text-sepia">
          Result not finalized yet — refresh in a few seconds.
        </p>
      )}

      {result?.summary ? (
        <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
          <h2 className="mb-2 font-display text-lg">Verdict</h2>
          <p className="text-sm leading-relaxed text-ink">{result.summary}</p>
        </section>
      ) : null}

      {breakdown.length > 0 ? (
        <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
          <h2 className="mb-3 font-display text-lg">Round Breakdown</h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-sepia">
              <tr>
                <th className="text-left">Round</th>
                <th className="text-right">{d.player1?.username ?? "P1"}</th>
                <th className="text-right">{d.player2?.username ?? "P2"}</th>
                <th className="text-right">Edge</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((r) => {
                const edge = r.score_p1 - r.score_p2;
                return (
                  <tr key={r.round} className="border-t border-ink/30">
                    <td className="py-2">
                      R{r.round} · {r.phase}
                    </td>
                    <td className="text-right">{r.score_p1.toFixed(1)}</td>
                    <td className="text-right">{r.score_p2.toFixed(1)}</td>
                    <td
                      className={`text-right font-display ${
                        edge > 0
                          ? "text-red"
                          : edge < 0
                            ? "text-red"
                            : "text-sepia"
                      }`}
                    >
                      {Math.abs(edge) < 0.1
                        ? "TIE"
                        : edge > 0
                          ? `◂ +${edge.toFixed(1)}`
                          : `+${(-edge).toFixed(1)} ▸`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {best ? (
        <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
          <h2 className="mb-2 font-display text-lg">Argument of the Match</h2>
          <div className="text-xs uppercase tracking-wider text-sepia">
            {best.author_username} · score {best.score.toFixed(1)}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {best.content}
          </p>
        </section>
      ) : null}

      <div className="flex justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded border-2 border-ink bg-paper-2 px-4 py-2 font-condensed text-sm uppercase tracking-widest hover:bg-ink hover:text-paper"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function ScoreCard({
  name,
  final,
  ai,
  votes,
  delta,
  isWinner,
}: {
  name: string;
  final: number;
  ai: number;
  votes: number;
  delta: number;
  isWinner: boolean;
}) {
  return (
    <div
      className={`rounded border-2 ${isWinner ? "border-red" : "border-ink"} bg-paper p-4 shadow-press-sm`}
    >
      <div className="flex items-center justify-between">
        <div className="font-display text-lg">{name}</div>
        {isWinner ? (
          <span className="rounded bg-red px-2 py-0.5 font-condensed text-xs uppercase tracking-widest text-paper">
            Winner
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-sepia">
        <span>
          Final{" "}
          <strong className="font-display text-ink">{final.toFixed(1)}</strong>
        </span>
        <span>
          AI{" "}
          <strong className="font-display text-ink">{ai.toFixed(1)}</strong>
        </span>
        <span>
          Votes <strong className="font-display text-ink">{votes}</strong>
        </span>
        <span>
          Elo Δ{" "}
          <strong
            className={`font-display ${delta > 0 ? "text-green-action" : delta < 0 ? "text-red" : "text-ink"}`}
          >
            {delta > 0 ? "+" : ""}
            {delta}
          </strong>
        </span>
      </div>
    </div>
  );
}
