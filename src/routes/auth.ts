import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import bcrypt from "bcrypt";
import { z } from "zod";
import { Role } from "@prisma/client";
import { config } from "../config.js";
import { authed, badRequest } from "../lib/access.js";
import { mapUserDto, wireRole } from "../lib/dto.js";
import { logEvent } from "../lib/audit-log.js";
import type { TokenPayload } from "../plugins/auth.js";

const credentialsSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  organizationSlug: z.string().trim().min(1),
});

const routes: FastifyPluginAsync = async (app) => {
  const findOrganisationForLogin = (slug: string) =>
    app.prisma.organisation.findFirst({
      where: { slug: { equals: slug, mode: "insensitive" } },
    });

  const findUserForLogin = (organisationId: number, username: string) =>
    app.prisma.user.findFirst({
      where: {
        organisationId,
        username: { equals: username, mode: "insensitive" },
      },
      include: { team: true },
    });

  const signToken = (user: { id: number; username: string; role: Role }, organisation: { id: number; slug: string }) =>
    app.jwt.sign(
      {
        sub: String(user.id),
        username: user.username,
        role: user.role,
        organisationId: organisation.id,
        organisationSlug: organisation.slug,
      },
      { expiresIn: Math.floor(config.JWT_EXPIRATION_MS / 1000) },
    );

  app.post("/register", async (req, reply) => {
    const body = credentialsSchema.parse(req.body);

    const organisation = await app.prisma.organisation.findUnique({ where: { slug: body.organizationSlug } });
    if (!organisation) {
      return reply.code(404).send({ error: `Organization not found: ${body.organizationSlug}` });
    }

    const existing = await app.prisma.user.findUnique({
      where: { organisationId_username: { organisationId: organisation.id, username: body.username } },
    });
    if (existing) {
      return reply.code(409).send({ error: "Username already exists in this organization" });
    }

    // First user of an organisation becomes its manager, everyone else a member.
    const hasUsers = (await app.prisma.user.count({ where: { organisationId: organisation.id } })) > 0;
    const role = hasUsers ? Role.MEMBER : Role.MANAGER;

    const user = await app.prisma.user.create({
      data: {
        organisationId: organisation.id,
        username: body.username,
        passwordHash: await bcrypt.hash(body.password, 12),
        role,
      },
    });

    await logEvent(app, {
      organisationId: organisation.id,
      userId: user.id,
      action: "CREATE",
      resourceType: "USER",
      resourceId: user.id,
      resourceName: user.username,
      details: { event: "register" },
      request: req,
    });

    return reply.send({ id: user.id, username: user.username, role: user.role, organizationId: user.organisationId });
  });

  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const body = credentialsSchema.parse(req.body);

    const organisation = await findOrganisationForLogin(body.organizationSlug);
    if (!organisation) {
      return reply.code(404).send({ error: `Organization not found: ${body.organizationSlug}` });
    }

    let user = await findUserForLogin(organisation.id, body.username);
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid username or password" });
    }

    // Safety net kept from the legacy backend: an organisation must always
    // have at least one manager, otherwise the login user is promoted.
    const managerCount = await app.prisma.user.count({
      where: { organisationId: organisation.id, role: { in: [Role.MANAGER, Role.OWNER] } },
    });
    if (managerCount === 0) {
      user = await app.prisma.user.update({ where: { id: user.id }, data: { role: Role.MANAGER }, include: { team: true } });
      app.log.warn({ organisation: organisation.slug, username: user.username }, "No managers existed; promoted login user to MANAGER");
    }

    await logEvent(app, {
      organisationId: organisation.id,
      userId: user.id,
      action: "LOGIN",
      resourceType: "USER",
      resourceId: user.id,
      resourceName: user.username,
      request: req,
    });

    return {
      token: signToken(user, organisation),
      expiresIn: config.JWT_EXPIRATION_MS,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: wireRole(user.role),
        organizationId: user.organisationId,
        teamId: user.teamId,
        teamName: user.team?.name ?? null,
      },
      organizationContext: {
        organizationId: String(organisation.id),
        organizationSlug: organisation.slug,
      },
    };
  });

  const validate = async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return false;
    try {
      const token = app.jwt.verify<TokenPayload>(header.slice(7));
      return Boolean(token.organisationId && token.organisationSlug && token.username);
    } catch {
      return false;
    }
  };

  app.post("/validate", async (req, reply) => {
    if (await validate(req)) return { valid: true };
    return reply.code(401).send({ valid: false });
  });

  app.get("/validate", async (req, reply) => {
    if (await validate(req)) return { valid: true };
    return reply.code(401).send({ valid: false });
  });

  const loadProfile = async (req: FastifyRequest) =>
    app.prisma.user.findFirst({
      where: { id: req.auth.userId, organisationId: req.auth.organisationId },
      include: { team: true, organisation: true },
    });

  app.get("/me", { preHandler: authed }, async (req, reply) => {
    const user = await loadProfile(req);
    if (!user) return reply.code(404).send({ error: "User not found" });
    return mapUserDto(user);
  });

  const updateAccount = async (req: FastifyRequest) => {
    const body = z.object({
      name: z.string().trim().min(1, "Username cannot be empty"),
      email: z.string().trim().email().or(z.literal("")).optional(),
    }).parse(req.body);

    const clash = await app.prisma.user.findUnique({
      where: { organisationId_username: { organisationId: req.auth.organisationId, username: body.name } },
    });
    if (clash && clash.id !== req.auth.userId) {
      throw badRequest("Username already exists in this organization");
    }

    const user = await app.prisma.user.update({
      where: { id: req.auth.userId },
      data: { username: body.name, email: body.email ? body.email : null },
      include: { team: true, organisation: true },
    });

    await logEvent(app, {
      organisationId: req.auth.organisationId,
      userId: req.auth.userId,
      action: "UPDATE",
      resourceType: "USER",
      resourceId: user.id,
      resourceName: user.username,
      details: { event: "account_update" },
      request: req,
    });

    return mapUserDto(user);
  };

  // The SPA calls PUT /auth/profile; the rewrite brief also names PUT /auth/me.
  app.put("/me", { preHandler: authed }, updateAccount);
  app.put("/profile", { preHandler: authed }, updateAccount);
};

export default routes;
