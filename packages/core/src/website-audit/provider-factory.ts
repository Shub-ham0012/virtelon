import type { WebsiteAuditProvider } from "./WebsiteAuditProvider";
import { HttpWebsiteAuditProvider } from "./providers/http-audit.provider";

/** No API key needed for the lightweight HTTP audit, so this always returns
 * the real provider — kept as a factory (rather than a bare export) so
 * tests/future providers can swap it the same way every other provider does. */
export function getWebsiteAuditProvider(): WebsiteAuditProvider {
  return new HttpWebsiteAuditProvider();
}
