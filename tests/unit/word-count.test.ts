import { describe, expect, it } from "vitest";
import { countWords, truncate } from "@/lib/utils/word-count";

describe("countWords", () => {
  it("matches Python's re.findall(r'\\b\\w+\\b') word semantics", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("hello,world. yes!")).toBe(3);
    expect(countWords("  leading  whitespace  ")).toBe(2);
  });

  it("handles empty/null/undefined", () => {
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords(undefined)).toBe(0);
  });

  it("counts unicode word characters", () => {
    expect(countWords("café résumé")).toBe(2);
  });
});

describe("truncate", () => {
  it("returns the original when within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("appends ellipsis when over limit", () => {
    expect(truncate("hello world", 6)).toBe("hello…");
  });
});
