import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authed, badRequest, managersOnly, notFound } from "../lib/access.js";
import { mapTeamDto } from "../lib/dto.js";
import { logEvent } from "../lib/audit-log.js";

const nameSchema = z.object({ name: z.string().trim().min(1, "Team name cannot be empty") });
const idParam = z.object({ teamId: z.coerce.number().int() });
const withUsers = { users: { select: { username: true } } } as const;

const routes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: authed }, async (req) => {
    const teams = await app.prisma.team.findMany({
      where: { organisationId: req.auth.organisationId },
      include: withUsers,
      orderBy: { id: "asc" },
    });
    return teams.map(mapTeamDto);
  });

  app.get("/me", { preHandler: authed }, async (req, reply) => {
    const user = await app.prisma.user.findFirst({
      where: { id: req.auth.userId, organisationId: req.auth.organisationId },
    });
    if (!user?.teamId) return reply.code(404).send({ error: "Team not found" });
    const team = await app.prisma.team.findFirst({
      where: { id: user.teamId, organisationId: req.auth.organisationId },
      include: withUsers,
    });
    if (!team) return reply.code(404).send({ error: "Team not found" });
    return mapTeamDto(team);
  });

  app.get("/:teamId", { preHandler: authed }, async (req) => {
    const { teamId } = idParam.parse(req.params);
    const team = await app.prisma.team.findFirst({
      where: { id: teamId, organisationId: req.auth.organisationId },
      include: withUsers,
    });
    if (!team) throw notFound("Team not found");
    return mapTeamDto(team);
  });

  app.post("/", { preHandler: managersOnly }, async (req, reply) => {
    const { name } = nameSchema.parse(req.body);
    const organisationId = req.auth.organisationId;

    const duplicate = await app.prisma.team.findUnique({
      where: { organisationId_name: { organisationId, name } },
    });
    if (duplicate) throw badRequest("Team name already exists");

    const team = await app.prisma.team.create({ data: { organisationId, name }, include: withUsers });

    await logEvent(app, {
      organisationId,
      userId: req.auth.userId,
      action: "CREATE",
      resourceType: "TEAM",
      resourceId: team.id,
      resourceName: team.name,
      request: req,
    });

    return reply.code(201).send(mapTeamDto(team));
  });

  app.put("/:teamId", { preHandler: managersOnly }, async (req) => {
    const { teamId } = idParam.parse(req.params);
    const { name } = nameSchema.parse(req.body);
    const organisationId = req.auth.organisationId;

    const team = await app.prisma.team.findFirst({ where: { id: teamId, organisationId } });
    if (!team) throw notFound("Team not found");

    const duplicate = await app.prisma.team.findUnique({
      where: { organisationId_name: { organisationId, name } },
    });
    if (duplicate && duplicate.id !== teamId) throw badRequest("Team name already exists");

    const updated = await app.prisma.team.update({
      where: { id: teamId },
      data: { name },
      include: withUsers,
    });

    await logEvent(app, {
      organisationId,
      userId: req.auth.userId,
      action: "UPDATE",
      resourceType: "TEAM",
      resourceId: updated.id,
      resourceName: updated.name,
      request: req,
    });

    return mapTeamDto(updated);
  });

  app.delete("/:teamId", { preHandler: managersOnly }, async (req, reply) => {
    const { teamId } = idParam.parse(req.params);
    const organisationId = req.auth.organisationId;

    const team = await app.prisma.team.findFirst({ where: { id: teamId, organisationId }, include: withUsers });
    if (!team) throw notFound("Team not found");
    if (team.users.length > 0) throw badRequest("Move members out of this team before deleting it");

    await app.prisma.team.delete({ where: { id: teamId } });

    await logEvent(app, {
      organisationId,
      userId: req.auth.userId,
      action: "DELETE",
      resourceType: "TEAM",
      resourceId: team.id,
      resourceName: team.name,
      request: req,
    });

    return reply.code(204).send();
  });
};

export default routes;
