import type { FastifyPluginAsync } from "fastify";
import { authed } from "../lib/access.js";
import { mapUserDto } from "../lib/dto.js";

const routes: FastifyPluginAsync = async (app) => {
  app.get("/me", { preHandler: authed }, async (req, reply) => {
    const user = await app.prisma.user.findFirst({
      where: { id: req.auth.userId, organisationId: req.auth.organisationId },
      include: { team: true, organisation: true },
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    return mapUserDto(user);
  });
};

export default routes;
