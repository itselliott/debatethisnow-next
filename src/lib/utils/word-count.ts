/**
 * Word counter — must match Python's `helpers.count_words` byte-for-byte
 * so client + server agree on whether an argument meets MIN_ARGUMENT_WORDS.
 *
 * Python's `re.findall(r"\b\w+\b", text)` uses Unicode-aware `\w` by
 * default — accented letters in "café" count as word characters and
 * "café résumé" is two words. JS's `\w` is ASCII-only even with the
 * `u` flag, so we use an explicit Unicode-property class instead:
 *   [\p{L}\p{N}_]+ = one or more letter / number / underscore code points.
 * Without this, a Spanish/French user's min-word check would over-count.
 * Caught by tests/unit/word-count.test.ts.
 */
const WORD_RE = /[\p{L}\p{N}_]+/gu;

export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const matches = text.match(WORD_RE);
  return matches ? matches.length : 0;
}

export function truncate(text: string, maxLen = 280): string {
  if (!text) return "";
  return text.length <= maxLen ? text : text.slice(0, maxLen - 1) + "…";
}
