import { z } from "zod";

/**
 * Every var the platform will ever need lives in one schema so a missing or
 * malformed value fails loudly at boot instead of silently at first use.
 * Only the vars Phase 1 actually depends on are required; later-phase vars
 * are optional here and become required in practice once that phase's
 * provider is wired up (enforced by that provider's constructor, not here).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Phase 1 — required
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.string().url(),

  // Phase 7 — background jobs
  REDIS_URL: z.string().url().optional(),

  // Phase 3 — website audit screenshots
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Phase 3 — social/online-presence discovery (Google Custom Search JSON API,
  // used only for finding public profile URLs — never for scraping the
  // social platforms themselves; see docs/ARCHITECTURE.md §0.2)
  GOOGLE_SEARCH_API_KEY: z.string().optional(),
  GOOGLE_SEARCH_ENGINE_ID: z.string().optional(),

  // Phase 4 — AI
  ANTHROPIC_API_KEY: z.string().optional(),
  // Free-tier fallback AI provider when ANTHROPIC_API_KEY isn't set (no
  // billing account required to get a key from Google AI Studio) — see
  // packages/core/src/ai/providers/gemini.provider.ts.
  GEMINI_API_KEY: z.string().optional(),

  // Phase 2 — lead discovery
  GOOGLE_PLACES_API_KEY: z.string().optional(),

  // Phase 6 — outreach
  RESEND_API_KEY: z.string().optional(),
  WHATSAPP_CLOUD_API_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "CREDENTIALS_ENCRYPTION_KEY must be a 32-byte hex string")
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
