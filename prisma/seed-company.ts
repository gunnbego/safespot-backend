import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

/**
 * Idempotent company/user seed, mirroring the legacy SeedCompanyUser tool.
 *
 * Usage (like TirGeo):
 *   SEED_COMPANY_SLUG="safety-man" SEED_COMPANY_NAME="safety-man" \
 *   SEED_USER_NAME="jimmcd" SEED_USER_PASSWORD="..." npm run db:seed:company
 */

const firstPostgresUrl = (...values: Array<string | undefined>) =>
  values.find(value => typeof value === "string" && /^postgres(?:ql)?:\/\//.test(value.trim()));

process.env.DATABASE_URL = firstPostgresUrl(
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
  process.env.safespot_db_prod_POSTGRES_PRISMA_URL,
  process.env.safespot_db_prod_POSTGRES_URL,
  process.env.safespot_db_prod_DATABASE_URL,
) ?? process.env.DATABASE_URL;

if (!process.env.DATABASE_URL) {
  throw new Error("No valid Postgres DATABASE_URL was found. Set DATABASE_URL (or POSTGRES_URL / safespot_db_prod_* equivalents).");
}

const firstNonBlank = (...values: Array<string | undefined>) =>
  values.find(value => typeof value === "string" && value.trim().length > 0)?.trim();

const organisationSlug = firstNonBlank(process.env.SEED_COMPANY_SLUG) ?? "safety-man";
const organisationName = firstNonBlank(process.env.SEED_COMPANY_NAME) ?? organisationSlug;
const username = firstNonBlank(process.env.SEED_USER_NAME, process.env.SEED_USERNAME) ?? "jimmcd";
const email = firstNonBlank(process.env.SEED_USER_EMAIL, process.env.SEED_EMAIL) ?? null;
const password = firstNonBlank(process.env.SEED_USER_PASSWORD, process.env.SEED_PASSWORD);
const roleInput = (firstNonBlank(process.env.SEED_ROLE, process.env.SEED_USER_ROLE) ?? "MANAGER").toUpperCase();
const teamName = firstNonBlank(process.env.SEED_TEAM_NAME) ?? "Safety Management";

if (!password) {
  throw new Error("Seed password is required. Set SEED_USER_PASSWORD (or SEED_PASSWORD).");
}
if (!(roleInput in Role)) {
  throw new Error(`Invalid SEED_ROLE "${roleInput}". Use OWNER, MANAGER, or MEMBER.`);
}
const role = roleInput as Role;

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);

const organisation = await prisma.organisation.upsert({
  where: { slug: organisationSlug },
  update: { name: organisationName, tier: "pro", subscriptionStatus: "active" },
  create: {
    name: organisationName,
    slug: organisationSlug,
    tier: "pro",
    subscriptionStatus: "active",
    metadata: { seededBy: "seed-company", seededAt: new Date().toISOString() },
  },
});

const team = await prisma.team.upsert({
  where: { organisationId_name: { organisationId: organisation.id, name: teamName } },
  update: {},
  create: { organisationId: organisation.id, name: teamName },
});

const user = await prisma.user.upsert({
  where: { organisationId_username: { organisationId: organisation.id, username } },
  update: { email: email ?? undefined, passwordHash, role, teamId: team.id },
  create: { organisationId: organisation.id, username, email, passwordHash, role, teamId: team.id },
});

if (organisation.createdById == null) {
  await prisma.organisation.update({ where: { id: organisation.id }, data: { createdById: user.id } });
}

await prisma.auditLog.create({
  data: {
    organisationId: organisation.id,
    userId: user.id,
    action: "CREATE",
    resourceType: "USER",
    resourceId: user.id,
    resourceName: user.username,
    details: { event: "seed_company_user" },
  },
});

console.log(`Seeded organisation '${organisationSlug}' with user '${username}' as ${role} (team '${teamName}').`);
await prisma.$disconnect();
