import { env } from "@virtelon/config";
import type { AIProvider } from "./AIProvider";
import { ClaudeAIProvider } from "./providers/claude.provider";
import { MockAIProvider } from "./providers/mock.provider";

/** Same honest-fallback pattern as every other provider factory in this
 * codebase: real provider when configured, clearly-labeled mock otherwise —
 * never a fake result presented as real (docs/ARCHITECTURE.md §31). */
export function getAIProvider(): AIProvider {
  if (env.ANTHROPIC_API_KEY) {
    return new ClaudeAIProvider(env.ANTHROPIC_API_KEY);
  }
  return new MockAIProvider();
}
