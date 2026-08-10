import { parsePhoneNumberWithError } from "libphonenumber-js";

/**
 * Normalizes any raw phone string to E.164 (e.g. "+919876543210"), or
 * returns null if it can't be confidently parsed. Every entry point that
 * accepts a phone number — lead discovery, CSV import, contact creation,
 * inbound WhatsApp webhook matching — calls this once, so Lead.phoneE164 /
 * ContactMethod.normalizedValue are reliable dedup and matching keys instead
 * of best-effort string comparisons.
 *
 * `defaultCountry` (ISO 3166-1 alpha-2, e.g. "IN") is used only when the raw
 * number has no country code of its own — pass the tenant's/campaign's
 * default region rather than guessing.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountry?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = parsePhoneNumberWithError(trimmed, defaultCountry as never);
    return parsed.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}
