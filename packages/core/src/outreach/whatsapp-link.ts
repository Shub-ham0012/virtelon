/**
 * Official WhatsApp click-to-chat deep link (wa.me) — opens a chat with the
 * message pre-filled for a human to review and hit send. This is the
 * documented, ToS-compliant way to prefill WhatsApp; it is not automation
 * and requires no Business API account or approval.
 */
export function buildWhatsAppLink(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
