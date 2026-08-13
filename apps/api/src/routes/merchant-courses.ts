import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { CreatorApplication } from "../domain/creator.js";
import { type AuthGuards, currentUser } from "../auth/guards.js";
import { fail } from "../http/errors.js";
import type { CreatorRepository } from "../repositories/creator-repository.js";
import type { MerchantCourseRepository } from "../repositories/merchant-course-repository.js";
import { findApprovedCreator } from "./creator-access.js";

export async function registerMerchantCourseRoutes(
  app: FastifyInstance,
  guards: AuthGuards,
  creators: CreatorRepository,
  courses: MerchantCourseRepository,
) {
  async function resolveMerchant(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<CreatorApplication | null> {
    const merchant = await findApprovedCreator(creators, currentUser(request), "merchant");
    if (!merchant) {
      await fail(reply, 403, "FORBIDDEN", "商家身份尚未通过审核");
      return null;
    }
    return merchant;
  }

  app.get(
    "/api/merchant/courses",
    { preHandler: guards.requireRole("merchant") },
    async (request, reply) => {
      const merchant = await resolveMerchant(request, reply);
      if (!merchant) return reply;
      return { data: await courses.listByMerchant(merchant.id) };
    },
  );
}
