import { env } from "@virtelon/config";
import type { AIProvider } from "./AIProvider";
import { ClaudeAIProvider } from "./providers/claude.provider";
import { GeminiAIProvider } from "./providers/gemini.provider";
import { MockAIProvider } from "./providers/mock.provider";

/** Same honest-fallback pattern as every other provider factory in this
 * codebase: real provider when configured, clearly-labeled mock otherwise —
 * never a fake result presented as real (docs/ARCHITECTURE.md §31).
 * Claude is preferred when both keys are set (it's the primary/tested
 * provider); Gemini is the free-tier fallback — a Google AI Studio key
 * works without a billing account attached, unlike Anthropic's API. */
export function getAIProvider(): AIProvider {
  if (env.ANTHROPIC_API_KEY) {
    return new ClaudeAIProvider(env.ANTHROPIC_API_KEY);
  }
  if (env.GEMINI_API_KEY) {
    return new GeminiAIProvider(env.GEMINI_API_KEY);
  }
  return new MockAIProvider();
}
