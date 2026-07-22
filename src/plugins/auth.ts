import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { config } from "../config.js";

export interface TokenPayload {
  sub: string;
  username: string;
  role: string;
  organisationId: number;
  organisationSlug: string;
}

const unauthorized = (message: string) =>
  Object.assign(new Error(message), { statusCode: 401 });

export default fp(async (app) => {
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { iss: config.JWT_ISSUER, aud: config.JWT_AUDIENCE },
    verify: { allowedIss: config.JWT_ISSUER, allowedAud: config.JWT_AUDIENCE },
  });

  // Every protected route derives its tenant from the JWT claims — never from
  // the request body — and re-checks the user still exists in that tenant.
  app.decorate("authenticate", async (request) => {
    let token: TokenPayload;
    try {
      token = await request.jwtVerify<TokenPayload>();
    } catch {
      throw unauthorized("Invalid or expired token");
    }
    if (!token.organisationId || !token.organisationSlug || !token.username) {
      throw unauthorized("Token is missing tenant context");
    }
    const userId = Number(token.sub);
    const user = await app.prisma.user.findFirst({
      where: { id: Number.isFinite(userId) ? userId : -1, organisationId: token.organisationId },
      select: { id: true, username: true, role: true, organisationId: true },
    });
    if (!user) throw unauthorized("Account no longer exists in this organisation");
    request.auth = {
      userId: user.id,
      username: user.username,
      role: user.role,
      organisationId: user.organisationId,
      organisationSlug: token.organisationSlug,
    };
  });
});
