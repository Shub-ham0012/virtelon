import { env } from "@virtelon/config";
import type { SocialPresenceProvider } from "./SocialPresenceProvider";
import { GoogleCustomSearchProvider } from "./providers/google-custom-search.provider";
import { MockSocialPresenceProvider } from "./providers/mock.provider";

/** Same honest-fallback pattern as every other provider factory in this
 * codebase: real provider when configured, clearly-labeled mock otherwise —
 * never a fake result presented as real (docs/ARCHITECTURE.md §31). */
export function getSocialPresenceProvider(): SocialPresenceProvider {
  if (env.GOOGLE_SEARCH_API_KEY && env.GOOGLE_SEARCH_ENGINE_ID) {
    return new GoogleCustomSearchProvider(env.GOOGLE_SEARCH_API_KEY, env.GOOGLE_SEARCH_ENGINE_ID);
  }
  return new MockSocialPresenceProvider();
}
