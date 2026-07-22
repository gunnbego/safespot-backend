import type { FastifyReply, FastifyRequest } from "fastify";
import { Role } from "@prisma/client";

/** OWNER is treated exactly like MANAGER everywhere in the product. */
export const isManagerRole = (role: Role) => role === Role.MANAGER || role === Role.OWNER;

/** preHandler: any authenticated user of the tenant. */
export const authed = async (request: FastifyRequest) => request.server.authenticate(request);

/** preHandler: managers/owners only. */
export const managersOnly = async (request: FastifyRequest, reply: FastifyReply) => {
  await request.server.authenticate(request);
  if (!isManagerRole(request.auth.role)) {
    return reply.code(403).send({ error: "Forbidden" });
  }
};

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message = "Access denied") => new HttpError(403, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
