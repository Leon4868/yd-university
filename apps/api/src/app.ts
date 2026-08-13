import cors from "@fastify/cors";
import Fastify, { type FastifyError } from "fastify";

import { createAuthGuards } from "./auth/guards.js";
import { type AuthVerifier, DemoAuthVerifier } from "./auth/verifier.js";
import {
  type CertificateIssuer,
  DisabledCertificateIssuer,
  type IssuerLogger,
} from "./chain/certificate-issuer.js";
import type { UserRole } from "./domain/user.js";
import { fail } from "./http/errors.js";
import { createMockRepositories, type Repositories } from "./repositories/create-repositories.js";
import { RepositoryConflictError } from "./repositories/errors.js";
import { registerAdminCourseRoutes } from "./routes/admin-courses.js";
import { registerAdminCreatorRoutes } from "./routes/admin-creators.js";
import { registerCourseRoutes } from "./routes/courses.js";
import { registerCreatorRoutes } from "./routes/creators.js";
import { registerLearningRoutes } from "./routes/learning.js";
import { registerMerchantCourseRoutes } from "./routes/merchant-courses.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerTeacherCourseRoutes } from "./routes/teacher-courses.js";

interface BuildAppOptions {
  repositories?: Repositories;
  authVerifier?: AuthVerifier;
  bootstrapAdminSubjects?: readonly string[];
  bootstrapAdminWallets?: readonly string[];
  walletRoles?: ReadonlyMap<string, UserRole>;
  /** 工厂形式是为了让发证器复用 Fastify 的 logger；不传则不发证，学习流程照常 */
  certificateIssuer?: (logger: IssuerLogger) => CertificateIssuer;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const repositories = options.repositories ?? createMockRepositories();
  const certificateIssuer =
    options.certificateIssuer?.({
      info: (message) => app.log.info(message),
      warn: (message) => app.log.warn(message),
      error: (message) => app.log.error(message),
    }) ?? new DisabledCertificateIssuer();
  const guards = createAuthGuards(
    options.authVerifier ?? new DemoAuthVerifier(),
    repositories.users,
    options.bootstrapAdminSubjects,
    options.bootstrapAdminWallets,
    options.walletRoles,
  );

  await app.register(cors, {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "privy-id-token", "x-active-wallet"],
  });

  app.decorateRequest("currentUser", null);

  app.get("/health", async () => ({
    status: "ok",
    service: "yd-university-api",
  }));

  await registerCourseRoutes(app, repositories.courses);
  await registerMeRoutes(app, guards, repositories.creators);
  await registerCreatorRoutes(app, guards, repositories.creators);
  await registerAdminCreatorRoutes(app, guards, repositories.creators);
  await registerAdminCourseRoutes(app, guards, repositories.adminCourses);
  await registerTeacherCourseRoutes(app, guards, repositories.creators, repositories.teacherCourses);
  await registerMerchantCourseRoutes(app, guards, repositories.creators, repositories.merchantCourses);
  await registerLearningRoutes(
    app,
    guards,
    repositories.courses,
    repositories.progress,
    certificateIssuer,
  );

  app.setNotFoundHandler((_request, reply) => fail(reply, 404, "NOT_FOUND", "接口不存在"));

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof RepositoryConflictError) {
      return fail(reply, 409, "INVALID_STATE_TRANSITION", error.message);
    }
    // Fastify 自带的 4xx（JSON 解析失败、载荷过大等）同样要落到契约错误形状，不能吞成 500
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      return fail(reply, status, "INVALID_REQUEST", "请求格式不正确");
    }
    app.log.error(error);
    return fail(reply, 500, "INTERNAL_SERVER_ERROR", "服务内部错误");
  });

  return app;
}
