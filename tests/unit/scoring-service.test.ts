import { describe, expect, it } from "vitest";
import {
  aiScoreDebate,
  bestArgument,
  combineScores,
  roundBreakdown,
  summarizeDebate,
} from "@/lib/services/scoring-service";

const debate = { player1_id: 1, player2_id: 2 };

function msg(
  authorId: number,
  content: string,
  round = 1,
  phase = "opening",
) {
  return {
    author_id: authorId,
    content,
    round_number: round,
    phase,
  };
}

describe("aiScoreDebate", () => {
  it("returns 0/0 when no messages", () => {
    const r = aiScoreDebate(debate, []);
    expect(r.aiP1).toBe(0);
    expect(r.aiP2).toBe(0);
  });

  it("scores each author independently and averages per author", () => {
    const goodArg =
      "Therefore the evidence in this study clearly demonstrates a specific premise. Consequently the conclusion follows. Furthermore the rebuttal cannot stand.";
    const lazyArg = "lol idk whatever";
    const r = aiScoreDebate(debate, [
      msg(1, goodArg),
      msg(2, lazyArg),
    ]);
    expect(r.aiP1).toBeGreaterThan(r.aiP2);
  });
});

describe("combineScores", () => {
  it("AI weight 0.7 + audience 0.3 by default", () => {
    const out = combineScores(80, 60, 4, 1);
    // P1: 80*0.7 + 80*0.3 = 80; P2: 60*0.7 + 20*0.3 = 48
    expect(out.finalP1).toBeCloseTo(80, 1);
    expect(out.finalP2).toBeCloseTo(48, 1);
  });

  it("ties the audience split at 50-50 when no votes cast", () => {
    const out = combineScores(50, 50, 0, 0);
    expect(out.finalP1).toBe(out.finalP2);
  });
});

describe("roundBreakdown", () => {
  it("orders by round number, groups by author", () => {
    const out = roundBreakdown(debate, [
      msg(1, "x".repeat(200), 1, "opening"),
      msg(2, "y".repeat(200), 1, "opening"),
      msg(1, "x".repeat(200), 2, "rebuttal"),
      msg(2, "y".repeat(200), 2, "rebuttal"),
    ]);
    expect(out.length).toBe(2);
    expect(out[0]?.round).toBe(1);
    expect(out[1]?.round).toBe(2);
    expect(out[0]?.phase).toBe("opening");
  });
});

describe("bestArgument", () => {
  it("returns the highest-scoring message", () => {
    const strong =
      "The research is unambiguous. Specifically, the study demonstrates that the premise holds. Furthermore, the rebuttal is unsupported. Therefore the conclusion follows. Consider, for example, the consistent data.";
    const weak = "uh idk lol whatever";
    const out = bestArgument([
      {
        id: 1,
        author_id: 1,
        content: weak,
        round_number: 1,
        phase: "opening",
        author: { username: "p1" },
      },
      {
        id: 2,
        author_id: 2,
        content: strong,
        round_number: 1,
        phase: "opening",
        author: { username: "p2" },
      },
    ]);
    expect(out?.id).toBe(2);
    expect(out?.author_username).toBe("p2");
  });

  it("returns null on empty input", () => {
    expect(bestArgument([])).toBeNull();
  });
});

describe("summarizeDebate", () => {
  it("classifies razor-thin / close / decisive by gap", () => {
    expect(summarizeDebate({ topic: "x" }, 50, 51, 4)).toContain("Razor-thin");
    expect(summarizeDebate({ topic: "x" }, 50, 55, 4)).toContain("close fight");
    expect(summarizeDebate({ topic: "x" }, 50, 80, 4)).toContain("decisive");
  });
});
