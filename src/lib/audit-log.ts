import type { FastifyInstance, FastifyRequest } from "fastify";

/**
 * Tenant-scoped audit logging (equivalent of the legacy `audit_log` table).
 * Failures are swallowed so logging can never break the main request.
 */
export async function logEvent(
  app: FastifyInstance,
  entry: {
    organisationId: number;
    userId?: number | null;
    action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "EXPORT";
    resourceType: string;
    resourceId?: number | null;
    resourceName?: string | null;
    details?: Record<string, unknown>;
    request?: FastifyRequest;
  },
) {
  try {
    await app.prisma.auditLog.create({
      data: {
        organisationId: entry.organisationId,
        userId: entry.userId ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        resourceName: entry.resourceName ?? null,
        ipAddress: entry.request?.ip ?? null,
        details: (entry.details ?? undefined) as never,
      },
    });
  } catch (error) {
    app.log.warn({ err: error }, "audit log write failed");
  }
}
