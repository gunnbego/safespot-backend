import { z } from "zod";

process.env.DATABASE_URL ??=
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.safespot_db_prod_POSTGRES_PRISMA_URL ??
  process.env.safespot_db_prod_POSTGRES_URL ??
  process.env.safespot_db_prod_DATABASE_URL;

process.env.DIRECT_URL ??=
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.safespot_db_prod_POSTGRES_URL_NON_POOLING ??
  process.env.safespot_db_prod_DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

export const config = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRATION_MS: z.coerce.number().int().positive().default(86_400_000),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  CORS_ORIGINS: z.string().default(""),
  TRUST_PROXY: z.enum(["true", "false"]).default("false").transform(v => v === "true"),
  JWT_ISSUER: z.string().default("safespot-backend"),
  JWT_AUDIENCE: z.string().default("safespot-app"),
}).parse(process.env);

export const corsOrigins = config.CORS_ORIGINS.split(",").map(v => v.trim()).filter(Boolean);
