import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { Prisma } from "@prisma/client";
import database from "./plugins/database.js";
import auth from "./plugins/auth.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import tenantRoutes from "./routes/tenant.js";
import teamRoutes from "./routes/teams.js";
import auditRoutes from "./routes/audits.js";
import { config, corsOrigins } from "./config.js";

const frontendDistDir = path.resolve(process.env.FRONTEND_DIST_DIR ?? path.join(process.cwd(), "frontend", "dist"));
const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

async function fileExists(filePath: string) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: { redact: ["req.headers.authorization", "body.password"] },
    trustProxy: config.TRUST_PROXY,
  });
  await app.register(helmet);
  await app.register(cors, { origin: corsOrigins.length ? corsOrigins : false });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  // Matches the Spring config: 5MB per photo, 20MB per request.
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 10, fields: 10 } });
  await app.register(swagger, {
    openapi: { info: { title: "SafeSpot API", version: "0.1.0", description: "Multi-tenant workplace safety reporting API" } },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(database);
  await app.register(auth);

  app.get("/health", async () => ({ status: "ok", service: "safespot-backend" }));
  app.get("/ready", async (_req, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: "ready", service: "safespot-backend" };
    } catch {
      return reply.code(503).send({ status: "not_ready", service: "safespot-backend" });
    }
  });

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(tenantRoutes, { prefix: "/api/tenant" });
  await app.register(teamRoutes, { prefix: "/api/teams" });
  await app.register(auditRoutes, { prefix: "/api/audits" });

  // Local/dev SPA fallback. On Vercel the static frontend is served from
  // public/ by the platform and this handler only sees /api traffic.
  app.get("/*", async (req, reply) => {
    const requestPath = new URL(req.raw.url ?? "/", "http://localhost").pathname;
    if (requestPath.startsWith("/api/")) return reply.code(404).send({ error: "Route not found", code: "NOT_FOUND" });

    const decodedPath = decodeURIComponent(requestPath);
    const candidate = path.resolve(frontendDistDir, decodedPath === "/" ? "index.html" : decodedPath.slice(1));
    const safeCandidate = candidate === frontendDistDir || candidate.startsWith(`${frontendDistDir}${path.sep}`);
    const filePath = safeCandidate && await fileExists(candidate) ? candidate : path.join(frontendDistDir, "index.html");

    if (!await fileExists(filePath)) return reply.code(404).send({ error: "Frontend build not found", code: "FRONTEND_NOT_BUILT" });
    reply.type(mimeTypes[path.extname(filePath)] ?? "application/octet-stream");
    return reply.send(createReadStream(filePath));
  });

  app.setErrorHandler((error, _req, reply) => {
    const err = error as Error & { statusCode?: number; issues?: { message: string }[] };
    if (err.name === "ZodError") {
      const message = err.issues?.[0]?.message ?? "Validation failed";
      return reply.code(400).send({ error: message, code: "VALIDATION_ERROR" });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return reply.code(404).send({ error: "Record not found", code: "NOT_FOUND" });
      if (error.code === "P2002") return reply.code(409).send({ error: "A record with these values already exists", code: "CONFLICT" });
      if (error.code === "P2003") return reply.code(400).send({ error: "Referenced record is invalid", code: "INVALID_REFERENCE" });
    }
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    app.log.error(err);
    return reply.code(err.statusCode ?? 500).send({ error: "Internal server error" });
  });

  return app;
}

let appPromise: ReturnType<typeof buildApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= buildApp().then(async app => {
    await app.ready();
    return app;
  });
  const app = await appPromise;
  app.server.emit("request", req, res);
}
