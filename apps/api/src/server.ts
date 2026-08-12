import { buildApp } from "./app.js";
import { createAuthVerifier } from "./auth/verifier.js";
import { readEnv } from "./env.js";
import { createRepositories } from "./repositories/create-repositories.js";

const env = readEnv();
const repositories = createRepositories(env);
const authVerifier = createAuthVerifier(env);
const bootstrapAdminSubjects = env.BOOTSTRAP_ADMIN_SUBJECTS.split(",")
  .map((subject) => subject.trim())
  .filter(Boolean);
const bootstrapAdminWallets = env.BOOTSTRAP_ADMIN_WALLETS.split(",")
  .map((wallet) => wallet.trim().toLowerCase())
  .filter((wallet) => /^0x[0-9a-f]{40}$/.test(wallet));
const app = await buildApp({ repositories, authVerifier, bootstrapAdminSubjects, bootstrapAdminWallets, logger: true });

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
