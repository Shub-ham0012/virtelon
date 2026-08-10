/**
 * Seeds Virtelon as tenant #1 — entirely as data, proving the platform
 * never hard-codes a specific tenant's identity or configuration. Any other
 * agency could run this same script with different values and get an
 * equally first-class tenant.
 */
import bcrypt from "bcryptjs";
import { rawPrisma } from "./client";

async function main() {
  const passwordHash = await bcrypt.hash("virtelon-dev-password", 12);

  const organization = await rawPrisma.organization.upsert({
    where: { slug: "virtelon" },
    update: {},
    create: {
      name: "Virtelon",
      slug: "virtelon",
      plan: "AGENCY",
      timezone: "Asia/Kolkata",
      branding: { primaryColor: "#2f5fd6" },
      services: ["Website Development", "Web Applications", "Custom Software", "AI Automation", "Digital Marketing"],
    },
  });

  const owner = await rawPrisma.user.upsert({
    where: { email: "owner@virtelon.dev" },
    update: {},
    create: {
      email: "owner@virtelon.dev",
      name: "Virtelon Owner",
      passwordHash,
    },
  });

  await rawPrisma.membership.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: owner.id } },
    update: {},
    create: {
      organizationId: organization.id,
      userId: owner.id,
      role: "OWNER",
      joinedAt: new Date(),
    },
  });

  await rawPrisma.scoringConfig.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      // Mirrors DEFAULT_SCORING_WEIGHTS in packages/core/src/lead-scoring —
      // duplicated (not imported) since packages/db can't depend on
      // packages/core without creating a circular dependency. Keep in sync.
      weights: {
        websiteOpportunity: 30,
        businessQuality: 20,
        onlinePresenceOpportunity: 25,
        categoryFit: 15,
        contactability: 10,
      },
      threshold: 70,
    },
  });

  await rawPrisma.outreachLimit.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      dailyLimit: 20, // Virtelon's initial target — configurable per tenant, never hard-coded in code
    },
  });

  await rawPrisma.serviceOffering.upsert({
    where: { id: "seed-virtelon-website-dev" },
    update: {},
    create: {
      id: "seed-virtelon-website-dev",
      organizationId: organization.id,
      name: "Website Development",
      description: "Custom business websites built for local search visibility and lead capture.",
      targetIndustries: ["coaching", "restaurants", "hotels", "gyms", "salons", "clinics"],
      targetBusinessTypes: ["local service business"],
      painPoints: ["no website", "outdated design", "no clear call-to-action"],
      pitchAngles: ["local competitors already have strong websites", "missed leads from search"],
      portfolioUrls: [],
    },
  });

  console.log(`Seeded organization "${organization.name}" (${organization.slug})`);
  console.log(`Owner login: owner@virtelon.dev / virtelon-dev-password`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await rawPrisma.$disconnect();
  });
