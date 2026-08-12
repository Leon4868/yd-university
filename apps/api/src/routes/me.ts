import type { FastifyInstance } from "fastify";

import { type AuthGuards, currentUser } from "../auth/guards.js";
import type { CreatorRepository } from "../repositories/creator-repository.js";
import { toCurrentUserView } from "./presenters.js";

export async function registerMeRoutes(
  app: FastifyInstance,
  guards: AuthGuards,
  creators: CreatorRepository,
) {
  app.get("/api/me", { preHandler: guards.requireUser }, async (request) => {
    const user = currentUser(request);
    const creator = await creators.findLatestByUser(user.id);
    return { data: toCurrentUserView(user, creator) };
  });
}
