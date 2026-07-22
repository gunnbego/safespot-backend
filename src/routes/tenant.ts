import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import bcrypt from "bcrypt";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authed, badRequest, managersOnly } from "../lib/access.js";
import { mapOrganisationDto, mapUserDto } from "../lib/dto.js";
import { logEvent } from "../lib/audit-log.js";

const optional = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const roleSchema = z
  .string()
  .trim()
  .min(1, "Role cannot be empty")
  .transform(v => v.toUpperCase())
  .refine(v => v === Role.MANAGER || v === Role.MEMBER, "Invalid role")
  .transform(v => v as Role);

const memberSchema = z.object({
  username: z.string().trim().min(1, "Username cannot be empty"),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  role: roleSchema,
  teamId: z.coerce.number().int().positive().optional().nullable(),
});

const idParam = z.object({ userId: z.coerce.number().int() });

const routes: FastifyPluginAsync = async (app) => {
  const currentOrganisation = async (req: FastifyRequest) =>
    app.prisma.organisation.findUniqueOrThrow({ where: { id: req.auth.organisationId } });

  const resolveTeam = async (organisationId: number, teamId?: number | null) => {
    if (teamId == null) return null;
    const team = await app.prisma.team.findFirst({ where: { id: teamId, organisationId } });
    if (!team) throw badRequest("Team not found");
    return team;
  };

  const findMember = async (organisationId: number, userId: number) => {
    const user = await app.prisma.user.findFirst({ where: { id: userId, organisationId } });
    if (!user) throw badRequest("User not found");
    return user;
  };

  // The SPA historically called /tenant/me; the rewrite brief names /tenant/context.
  app.get("/me", { preHandler: authed }, async (req) => mapOrganisationDto(await currentOrganisation(req)));
  app.get("/context", { preHandler: authed }, async (req) => mapOrganisationDto(await currentOrganisation(req)));

  app.get("/members", { preHandler: authed }, async (req) => {
    const members = await app.prisma.user.findMany({
      where: { organisationId: req.auth.organisationId },
      include: { team: true, organisation: true },
      orderBy: { id: "asc" },
    });
    return members.map(mapUserDto);
  });

  app.post("/invite", { preHandler: managersOnly }, async (req, reply) => {
    const body = memberSchema.extend({ password: z.string().min(1, "Password cannot be empty") }).parse(req.body);
    const organisationId = req.auth.organisationId;

    const existing = await app.prisma.user.findUnique({
      where: { organisationId_username: { organisationId, username: body.username } },
    });
    if (existing) throw badRequest("Username already exists in this organization");

    const team = await resolveTeam(organisationId, body.teamId);
    const user = await app.prisma.user.create({
      data: {
        organisationId,
        username: body.username,
        email: optional(body.email),
        phone: optional(body.phone),
        role: body.role,
        teamId: team?.id ?? null,
        passwordHash: await bcrypt.hash(body.password, 12),
      },
      include: { team: true, organisation: true },
    });

    await logEvent(app, {
      organisationId,
      userId: req.auth.userId,
      action: "CREATE",
      resourceType: "USER",
      resourceId: user.id,
      resourceName: user.username,
      details: { event: "invite", role: user.role },
      request: req,
    });

    return reply.code(201).send(mapUserDto(user));
  });

  app.put("/members/:userId", { preHandler: managersOnly }, async (req) => {
    const { userId } = idParam.parse(req.params);
    const body = memberSchema.parse(req.body);
    const organisationId = req.auth.organisationId;

    const user = await findMember(organisationId, userId);
    if (user.username !== body.username) {
      const clash = await app.prisma.user.findUnique({
        where: { organisationId_username: { organisationId, username: body.username } },
      });
      if (clash) throw badRequest("Username already exists in this organization");
    }

    const team = await resolveTeam(organisationId, body.teamId);
    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: {
        username: body.username,
        email: optional(body.email),
        phone: optional(body.phone),
        role: body.role,
        teamId: team?.id ?? null,
      },
      include: { team: true, organisation: true },
    });

    await logEvent(app, {
      organisationId,
      userId: req.auth.userId,
      action: "UPDATE",
      resourceType: "USER",
      resourceId: updated.id,
      resourceName: updated.username,
      request: req,
    });

    return mapUserDto(updated);
  });

  app.patch("/members/:userId/password", { preHandler: managersOnly }, async (req) => {
    const { userId } = idParam.parse(req.params);
    const body = z.object({ password: z.string().min(1, "Password cannot be empty") }).parse(req.body);
    const organisationId = req.auth.organisationId;

    const user = await findMember(organisationId, userId);
    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(body.password, 12) },
      include: { team: true, organisation: true },
    });

    await logEvent(app, {
      organisationId,
      userId: req.auth.userId,
      action: "UPDATE",
      resourceType: "USER",
      resourceId: updated.id,
      resourceName: updated.username,
      details: { event: "password_reset" },
      request: req,
    });

    return mapUserDto(updated);
  });

  app.delete("/members/:userId", { preHandler: managersOnly }, async (req, reply) => {
    const { userId } = idParam.parse(req.params);
    const organisationId = req.auth.organisationId;

    const user = await findMember(organisationId, userId);
    if (user.id === req.auth.userId) throw badRequest("Managers cannot delete their own account");

    await app.prisma.user.delete({ where: { id: user.id } });

    await logEvent(app, {
      organisationId,
      userId: req.auth.userId,
      action: "DELETE",
      resourceType: "USER",
      resourceId: user.id,
      resourceName: user.username,
      request: req,
    });

    return reply.code(204).send();
  });
};

export default routes;
