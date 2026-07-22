import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { PhotoPurpose, Prisma } from "@prisma/client";
import { authed, badRequest, forbidden, isManagerRole, notFound } from "../lib/access.js";
import { mapAuditDto } from "../lib/dto.js";
import { readMultipart, type UploadedPhoto } from "../lib/multipart.js";
import { logEvent } from "../lib/audit-log.js";

const createSchema = z.object({
  title: z.string().trim().min(1, "Audit title is required"),
  notes: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  severity: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  teamId: z.coerce.number().int().positive().optional().nullable(),
});

const resolveSchema = z.object({ comment: z.string().optional().nullable() }).optional().nullable();
const idParam = z.object({ auditId: z.coerce.number().int() });

const defaultIfBlank = (value: string | null | undefined, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
};

const blankToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const withNames = {
  createdBy: { select: { username: true } },
  resolvedBy: { select: { username: true } },
} as const;

const routes: FastifyPluginAsync = async (app) => {
  const currentUser = async (req: FastifyRequest) => {
    const user = await app.prisma.user.findFirst({
      where: { id: req.auth.userId, organisationId: req.auth.organisationId },
    });
    if (!user) throw badRequest("User not found");
    return user;
  };

  const photoData = (organisationId: number, reportId: number, photos: UploadedPhoto[], purpose: PhotoPurpose) =>
    photos.map(photo => ({
      organisationId,
      reportId,
      fileName: photo.fileName,
      contentType: photo.contentType,
      sizeBytes: photo.buffer.length,
      data: new Uint8Array(photo.buffer),
      purpose,
    }));

  const loadDto = async (req: FastifyRequest, reportId: number, includePhotos: boolean) => {
    const organisationId = req.auth.organisationId;
    const report = await app.prisma.safetyReport.findFirst({
      where: { id: reportId, organisationId },
      include: { ...withNames, _count: { select: { photos: true } } },
    });
    if (!report) return null;
    const photos = includePhotos
      ? await app.prisma.safetyReportPhoto.findMany({
          where: { organisationId, reportId },
          orderBy: { id: "asc" },
        })
      : null;
    return mapAuditDto(report, req.auth, photos, report._count.photos);
  };

  const listDtos = async (req: FastifyRequest, where: Prisma.SafetyReportWhereInput) => {
    const reports = await app.prisma.safetyReport.findMany({
      where: { ...where, organisationId: req.auth.organisationId },
      include: { ...withNames, _count: { select: { photos: true } } },
      orderBy: { createdAt: "desc" },
    });
    return reports.map(report => mapAuditDto(report, req.auth, null, report._count.photos));
  };

  app.post("/", { preHandler: authed }, async (req, reply) => {
    let payload: unknown = req.body;
    let photos: UploadedPhoto[] = [];
    if (req.isMultipart()) {
      const parsed = await readMultipart(req, ["audit"]);
      payload = parsed.json ?? {};
      photos = parsed.photos;
    }
    const body = createSchema.parse(payload);
    const organisationId = req.auth.organisationId;

    const user = await currentUser(req);
    const teamId = body.teamId ?? user.teamId;
    if (teamId == null) throw badRequest("User is not assigned to a team");

    const team = await app.prisma.team.findFirst({ where: { id: teamId, organisationId } });
    if (!team) throw badRequest("Team not found");
    if (user.teamId !== team.id) throw forbidden("User cannot submit audits for this team");

    const report = await app.prisma.safetyReport.create({
      data: {
        organisationId,
        teamId: team.id,
        createdById: user.id,
        title: body.title,
        notes: body.notes ?? null,
        category: defaultIfBlank(body.category, "General"),
        severity: defaultIfBlank(body.severity, "Low"),
        status: defaultIfBlank(body.status, "Open"),
      },
    });
    if (photos.length) {
      await app.prisma.safetyReportPhoto.createMany({
        data: photoData(organisationId, report.id, photos, PhotoPurpose.HAZARD),
      });
    }

    await logEvent(app, {
      organisationId,
      userId: user.id,
      action: "CREATE",
      resourceType: "AUDIT",
      resourceId: report.id,
      resourceName: report.title,
      details: { photoCount: photos.length },
      request: req,
    });

    const dto = await loadDto(req, report.id, true);
    return reply.code(201).header("location", `/api/audits/${report.id}`).send(dto);
  });

  app.get("/mine", { preHandler: authed }, async (req) =>
    listDtos(req, { createdById: req.auth.userId }));

  app.get("/team", { preHandler: authed }, async (req) => {
    if (isManagerRole(req.auth.role)) return listDtos(req, {});
    const user = await currentUser(req);
    if (user.teamId == null) throw notFound(`No team found for user ${user.username}`);
    return listDtos(req, { teamId: user.teamId });
  });

  app.get("/team/:teamId", { preHandler: authed }, async (req) => {
    const { teamId } = z.object({ teamId: z.coerce.number().int() }).parse(req.params);
    const organisationId = req.auth.organisationId;

    const team = await app.prisma.team.findFirst({ where: { id: teamId, organisationId } });
    if (!team) throw forbidden("Team not found or does not belong to this tenant");

    if (!isManagerRole(req.auth.role)) {
      const user = await currentUser(req);
      if (user.teamId !== team.id) throw forbidden("Access denied to audits for this team");
    }
    return listDtos(req, { teamId: team.id });
  });

  app.get("/:auditId", { preHandler: authed }, async (req, reply) => {
    const { auditId } = idParam.parse(req.params);
    const dto = await loadDto(req, auditId, true);
    if (!dto) return reply.code(404).send({ error: "Audit not found" });
    return dto;
  });

  app.patch("/:auditId/resolve", { preHandler: authed }, async (req) => {
    const { auditId } = idParam.parse(req.params);
    const organisationId = req.auth.organisationId;

    let payload: unknown = req.body ?? {};
    let photos: UploadedPhoto[] = [];
    if (req.isMultipart()) {
      const parsed = await readMultipart(req, ["resolution"]);
      payload = parsed.json ?? {};
      photos = parsed.photos;
    }
    const body = resolveSchema.parse(payload);

    if (!isManagerRole(req.auth.role)) throw forbidden("Only managers can resolve audits");

    const report = await app.prisma.safetyReport.findFirst({ where: { id: auditId, organisationId } });
    if (!report) throw notFound("Audit not found");

    await app.prisma.safetyReport.update({
      where: { id: report.id },
      data: {
        status: "Resolved",
        resolvedById: req.auth.userId,
        resolvedAt: new Date(),
        resolutionComment: blankToNull(body?.comment),
      },
    });
    if (photos.length) {
      await app.prisma.safetyReportPhoto.createMany({
        data: photoData(organisationId, report.id, photos, PhotoPurpose.RESOLUTION),
      });
    }

    await logEvent(app, {
      organisationId,
      userId: req.auth.userId,
      action: "UPDATE",
      resourceType: "AUDIT",
      resourceId: report.id,
      resourceName: report.title,
      details: { event: "resolve", photoCount: photos.length },
      request: req,
    });

    return loadDto(req, report.id, true);
  });
};

export default routes;
