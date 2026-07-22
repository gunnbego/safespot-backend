import "fastify";
import type { PrismaClient, Role } from "@prisma/client";

export interface AuthContext {
  userId: number;
  username: string;
  role: Role;
  organisationId: number;
  organisationSlug: string;
}

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    auth: AuthContext;
  }
}
