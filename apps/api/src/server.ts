import { buildApp } from "./app.js";
import { createAuthVerifier } from "./auth/verifier.js";
import { ViemCertificateChain } from "./chain/certificate-chain.js";
import {
  type CertificateIssuer,
  ChainCertificateIssuer,
  DisabledCertificateIssuer,
} from "./chain/certificate-issuer.js";
import { readEnv } from "./env.js";
import { createRepositories } from "./repositories/create-repositories.js";
import type { UserRole } from "./domain/user.js";
import type { Address } from "viem";

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
// buildApp 内部才拿得到 Fastify logger，这里用工厂把发证器接进去，同时留一份引用给启动补发与退出清理
let certificateIssuer: CertificateIssuer = new DisabledCertificateIssuer();
const app = await buildApp({
  repositories,
  authVerifier,
  bootstrapAdminSubjects,
  bootstrapAdminWallets,
  walletRoles,
  logger: true,
  certificateIssuer:
    env.CERTIFICATE_ISSUANCE === "on"
      ? (logger) => {
          const chain = new ViemCertificateChain({
            rpcUrl: env.SEPOLIA_RPC_URL!,
            certificateAddress: env.COURSE_CERTIFICATE_ADDRESS as Address,
            issuerPrivateKey: env.CERTIFICATE_ISSUER_PRIVATE_KEY!,
          });
          // 只打地址，私钥任何时候都不进日志
          logger.info(`证书发放已启用，发证钱包 ${chain.issuerAddress}`);
          certificateIssuer = new ChainCertificateIssuer({
            progress: repositories.progress,
            chain,
            logger,
            sweepIntervalMs: env.CERTIFICATE_SWEEP_INTERVAL_MS,
          });
          return certificateIssuer;
        }
      : undefined,
});

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  // 补发上次进程没发完的证书，覆盖「铸造中途重启」的情况
  certificateIssuer.kick();
} catch (error) {
  app.log.error(error);
  certificateIssuer.stop();
  process.exitCode = 1;
}
