import { buildApp } from "./app.js";
import { createAuthVerifier } from "./auth/verifier.js";
import { readEnv } from "./env.js";
import { createRepositories } from "./repositories/create-repositories.js";
import type { UserRole } from "./domain/user.js";

const env = readEnv();
const repositories = createRepositories(env);
const authVerifier = createAuthVerifier(env);
const bootstrapAdminSubjects = env.BOOTSTRAP_ADMIN_SUBJECTS.split(",")
  .map((subject) => subject.trim())
  .filter(Boolean);
const bootstrapAdminWallets = env.BOOTSTRAP_ADMIN_WALLETS.split(",")
  .map((wallet) => wallet.trim().toLowerCase())
  .filter((wallet) => /^0x[0-9a-f]{40}$/.test(wallet));
const validRoles = new Set<UserRole>(["student", "teacher", "merchant", "admin"]);
const walletRoles = new Map<string, UserRole>();
for (const entry of env.WALLET_ROLE_MAPPINGS.split(",")) {
  const [rawWallet, rawRole] = entry.split("=").map((part) => part.trim().toLowerCase());
  if (rawWallet && rawRole && /^0x[0-9a-f]{40}$/.test(rawWallet) && validRoles.has(rawRole as UserRole)) {
    walletRoles.set(rawWallet, rawRole as UserRole);
  }
}
const app = await buildApp({ repositories, authVerifier, bootstrapAdminSubjects, bootstrapAdminWallets, walletRoles, logger: true });

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
