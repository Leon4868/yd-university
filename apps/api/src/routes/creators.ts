import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { type AuthGuards, currentUser } from "../auth/guards.js";
import { failValidation } from "../http/errors.js";
import type { CreatorRepository } from "../repositories/creator-repository.js";
import { toCreatorView } from "./presenters.js";
import { walletAddressSchema } from "./schemas.js";

const applicationBodySchema = z.object({
  role: z.enum(["teacher", "merchant"]),
  displayName: z.string().trim().min(1).max(80),
  walletAddress: walletAddressSchema,
});

export async function registerCreatorRoutes(
  app: FastifyInstance,
  guards: AuthGuards,
  creators: CreatorRepository,
) {
  app.post("/api/creators/applications", { preHandler: guards.requireUser }, async (request, reply) => {
    const parsed = applicationBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return failValidation(reply, parsed.error);
    }
    const user = currentUser(request);
    const application = await creators.apply({ userId: user.id, ...parsed.data });
    return reply.code(201).send({ data: toCreatorView(application) });
  });

  app.get("/api/creators/applications/mine", { preHandler: guards.requireUser }, async (request) => {
    const application = await creators.findLatestByUser(currentUser(request).id);
    return { data: application ? toCreatorView(application) : null };
  });
}
