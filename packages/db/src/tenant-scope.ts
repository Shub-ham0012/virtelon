import { rawPrisma } from "./client";

/**
 * Tenant isolation strategy (see docs/ARCHITECTURE.md §G):
 *
 * - "Direct" models carry an `organizationId` column. The extension injects
 *   it into every `where` on read/update/delete, and stamps it onto every
 *   `create` (overwriting anything the caller tried to pass — a forged
 *   organizationId in input can never leak through).
 * - "Nested" models (junction/child tables one or two hops from a direct
 *   model — Contact, ContactMethod, OutreachMessage, etc.) don't carry their
 *   own organizationId; the extension instead merges a relation filter that
 *   walks up to the owning tenant. Prisma allows extra non-unique filters
 *   alongside a unique `where` (findUnique included), so this works for
 *   single-row lookups too.
 * - Any model NOT listed in either map fails closed: the extension throws
 *   rather than letting an unscoped query through silently. Adding a new
 *   tenant-owned model to schema.prisma without adding it here is a build/
 *   test-time error, not a silent isolation hole.
 * - `User` and `Organization` themselves are deliberately excluded — nobody
 *   should query them through a tenant-scoped client; the organizationId is
 *   already known by the caller, and User is not owned by a single org.
 */

const DIRECT_MODELS = new Set([
  "Membership",
  "LeadSource",
  "LeadImportBatch",
  "Lead",
  "ScoringConfig",
  "ServiceOffering",
  "Campaign",
  "OutreachAccount",
  "MessageTemplate",
  "Conversation",
  "InboundMessage",
  "WebhookEvent",
  "OutreachLimit",
  "BlocklistEntry",
  "FollowUpRule",
  "Integration",
  "Subscription",
  "UsageRecord",
  "AuditLog",
  "Notification",
]);

const NESTED_SCOPE: Record<string, (organizationId: string) => Record<string, unknown>> = {
  Contact: (organizationId) => ({ lead: { organizationId } }),
  WebsiteAudit: (organizationId) => ({ lead: { organizationId } }),
  LeadScore: (organizationId) => ({ lead: { organizationId } }),
  AIAnalysis: (organizationId) => ({ lead: { organizationId } }),
  CampaignLead: (organizationId) => ({ campaign: { organizationId } }),
  OutreachMessage: (organizationId) => ({ lead: { organizationId } }),
  FollowUp: (organizationId) => ({ lead: { organizationId } }),
  Activity: (organizationId) => ({ lead: { organizationId } }),
  ContactMethod: (organizationId) => ({ contact: { lead: { organizationId } } }),
  OutreachEvent: (organizationId) => ({ message: { lead: { organizationId } } }),
};

const WHERE_SCOPED_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "findMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
  "upsert",
]);

function mergeWhere(existing: unknown, addition: Record<string, unknown>) {
  return { ...(typeof existing === "object" && existing ? existing : {}), ...addition };
}

// Prisma can't fully type-check a generic $allOperations handler that
// branches on `model` across every model in the schema (this is a known
// limitation of the extension API, not a bug in this code) — the handler is
// typed loosely and verified instead by the integration tests in
// tenant-scope.test.ts, which exercise every branch below against a real
// database.
type AllOperationsParams = {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
};

export function createTenantScopedClient(organizationId: string) {
  if (!organizationId) {
    throw new Error("createTenantScopedClient: organizationId is required");
  }

  return rawPrisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations(params: unknown) {
          const { model, operation, args, query } = params as AllOperationsParams;
          if (!model) return query(args);

          if (DIRECT_MODELS.has(model)) {
            const a = args as Record<string, unknown>;
            if (operation === "create") {
              a.data = { ...(a.data as Record<string, unknown>), organizationId };
            } else if (operation === "createMany") {
              const data = a.data as Record<string, unknown>[] | Record<string, unknown>;
              a.data = Array.isArray(data) ? data.map((d) => ({ ...d, organizationId })) : { ...data, organizationId };
            } else if (operation === "upsert") {
              a.where = mergeWhere(a.where, { organizationId });
              a.create = { ...(a.create as Record<string, unknown>), organizationId };
            } else if (WHERE_SCOPED_OPERATIONS.has(operation)) {
              a.where = mergeWhere(a.where, { organizationId });
            }
            return query(a);
          }

          // Organization is the tenant boundary itself, not a tenant-owned
          // child row — the only legitimate tenant-client operation on it is
          // "read/update the caller's own row." Creation happens once, at
          // registration, via the raw client (no tenant exists yet); deletion
          // is a deliberately separate, more sensitive operation.
          if (model === "Organization") {
            const a = args as Record<string, unknown>;
            const allowed = new Set(["findFirst", "findUnique", "update"]);
            if (!allowed.has(operation)) {
              throw new Error(`tenant-scope: operation "${operation}" on Organization is not permitted via the tenant-scoped client`);
            }
            a.where = mergeWhere(a.where, { id: organizationId });
            return query(a);
          }

          const nestedScope = NESTED_SCOPE[model];
          if (nestedScope) {
            const a = args as Record<string, unknown>;
            const scope = nestedScope(organizationId);
            if (operation === "upsert") {
              a.where = mergeWhere(a.where, scope);
            } else if (WHERE_SCOPED_OPERATIONS.has(operation)) {
              a.where = mergeWhere(a.where, scope);
            }
            // "create"/"createMany" on a nested model are intentionally left
            // unscoped here: the contract is that a child row is only ever
            // created with a parent id obtained from a prior scoped query
            // (e.g. a Lead already fetched via this same client), so the FK
            // itself already can't point at another tenant's data.
            return query(a);
          }

          throw new Error(
            `tenant-scope: model "${model}" has no tenant-scoping rule defined in packages/db/src/tenant-scope.ts — ` +
              `add it to DIRECT_MODELS or NESTED_SCOPE before querying it from tenant-facing code.`
          );
        },
      },
    },
  });
}

export type TenantScopedClient = ReturnType<typeof createTenantScopedClient>;
