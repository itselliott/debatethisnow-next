/**
 * Typed env access. Mirrors Python's `app/config.py` pattern:
 *   - Dev defaults baked in so local boot + production-build never fail
 *     on a missing env var.
 *   - `validateProdEnv()` runs at server startup and refuses to boot if
 *     any prod-critical secret is missing, default, or too short.
 *
 * Server-component / route-handler code reads `env.XYZ`; the strong-secret
 * check is a separate step called from `server.ts` so build-time imports
 * don't trip on placeholder values.
 */
import { z } from "zod";

const MIN_SECRET_BYTES = 32;

const KNOWN_WEAK_SECRETS: ReadonlySet<string> = new Set([
  "dev-secret-change-me",
  "dev-jwt-secret-change-me",
  "test-secret",
  "test-jwt-secret",
  "change-me",
  "secret",
  "replace-with-the-actual-value-from-the-python-fly-secrets",
]);

function isWeak(value: string | undefined | null): boolean {
  if (!value) return true;
  if (KNOWN_WEAK_SECRETS.has(value)) return true;
  if (Buffer.byteLength(value, "utf8") < MIN_SECRET_BYTES) return true;
  return false;
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  HOSTNAME: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().default("*"),

  DATABASE_URL: z.string().default(""),

  // Dev defaults provided — prod validation in validateProdEnv() will
  // refuse to boot if these are still placeholders.
  JWT_SECRET_KEY: z.string().default("dev-jwt-secret-change-me"),
  SECRET_KEY: z.string().default("dev-secret-change-me"),
  JWT_ACCESS_TOKEN_HOURS: z.coerce.number().int().positive().default(1),
  JWT_REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_MODEL: z.string().default("mistral-small-latest"),
  CEREBRAS_API_KEY: z.string().optional(),
  CEREBRAS_MODEL: z.string().default("llama3.1-70b"),

  ANTHROPIC_API_KEY: z.string().optional(),

  ELO_K_FACTOR: z.coerce.number().int().default(32),
  MATCH_ELO_WINDOW: z.coerce.number().int().default(200),
  STALE_DEBATE_MINUTES: z.coerce.number().int().default(60),
  PREP_SECONDS: z.coerce.number().int().default(30),
  VOTING_WINDOW_SECONDS: z.coerce.number().int().default(15),
  ROUND_OPENING_SECONDS: z.coerce.number().int().default(300),
  ROUND_REBUTTAL_SECONDS: z.coerce.number().int().default(180),
  ROUND_CLOSING_SECONDS: z.coerce.number().int().default(180),
  MAX_ARGUMENT_WORDS: z.coerce.number().int().default(800),
  MAX_ARGUMENT_BYTES: z.coerce.number().int().default(8000),
  DISCONNECT_FORFEIT_SECONDS: z.coerce.number().int().default(90),

  RATELIMIT_AUTH: z.string().default("10 per minute"),
  RATELIMIT_REPORTS: z.string().default("20 per hour"),
  RATELIMIT_VOTES: z.string().default("60 per minute"),
  RATELIMIT_DEFAULT: z.string().default("300 per minute"),

  ADSENSE_CLIENT_ID: z.string().optional(),
  ADSENSE_SLOT_BLOG_HEADER: z.string().optional(),
  ADSENSE_SLOT_BLOG_MID: z.string().optional(),
  ADSENSE_SLOT_BLOG_FOOTER: z.string().optional(),
  ADSENSE_SLOT_BLOG_INDEX: z.string().optional(),
  EXTRA_ADS_TXT_LINES: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  SENTRY_ENVIRONMENT: z.string().optional(),

  DEV_MODE: z
    .enum(["0", "1"])
    .default("0")
    .transform((v) => v === "1"),

  // Optional Domain= attribute for the auth cookies (e.g. .debatethisnow.com).
  // Unset for localhost dev; set in Fly secrets for cross-subdomain cookie
  // sharing during cutover.
  COOKIE_DOMAIN: z.string().optional(),
});

function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Schema with defaults should never reach here — but if a typed
    // coercion fails, surface the issue.
    console.error("\n=== Environment validation failed ===");
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      console.error(`  • ${path}: ${issue.message}`);
    }
    console.error("");
    throw parsed.error;
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;

export function corsOrigins(): string[] | "*" {
  if (env.CORS_ORIGINS.trim() === "*") return "*";
  return env.CORS_ORIGINS
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Production-startup validator. Called from `server.ts` after env is loaded
 * and BEFORE the HTTP listener is bound. Mirrors
 * [app/config.py:ProdConfig.validate] — refuses to boot with weak or
 * default secrets in prod, prints every problem before `process.exit(2)`.
 *
 * No-op outside production. Build-time imports skip this; only the running
 * server enforces it.
 */
export function validateProdEnv(): void {
  if (env.NODE_ENV !== "production") return;
  const problems: string[] = [];
  if (isWeak(process.env.JWT_SECRET_KEY)) {
    problems.push(
      "JWT_SECRET_KEY is missing, weak, or a known default. " +
        `Must be ≥${MIN_SECRET_BYTES} bytes. Generate with: ` +
        `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    );
  }
  if (isWeak(process.env.SECRET_KEY)) {
    problems.push(
      "SECRET_KEY is missing, weak, or a known default. " +
        `Must be ≥${MIN_SECRET_BYTES} bytes.`,
    );
  }
  if ((process.env.CORS_ORIGINS ?? "*").trim() === "*") {
    problems.push(
      "CORS_ORIGINS is wildcard in production. " +
        "Set it to a comma-separated list of allowed origins.",
    );
  }
  const dbUrl = (process.env.DATABASE_URL ?? "").trim();
  if (!dbUrl) {
    problems.push("DATABASE_URL is unset. Set it to your Neon URL.");
  } else if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
    const host = dbUrl.split("@")[1]?.split("/")[0]?.split(":")[0]?.toLowerCase() ?? "";
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!isLocal && !dbUrl.toLowerCase().includes("sslmode=")) {
      problems.push(
        "DATABASE_URL is missing sslmode for a non-localhost host. " +
          "Append ?sslmode=require or &sslmode=require.",
      );
    }
  }
  if (problems.length > 0) {
    process.stderr.write("\n=== Production config refused — fix and restart ===\n");
    for (const p of problems) process.stderr.write(`  • ${p}\n`);
    process.stderr.write("\n");
    process.exit(2);
  }
}
