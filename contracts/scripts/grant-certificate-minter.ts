import assert from "node:assert/strict";

import {
  asAddress,
  assertSepolia,
  getChainContext,
  sameAddress,
  waitForTransaction,
} from "./shared.js";

/**
 * 把 CourseCertificate 的 MINTER_ROLE 授予后端发证钱包。
 *
 * 该钱包只拿铸造权，不给 DEFAULT_ADMIN_ROLE，也不该放 YD 和多余 ETH：
 * 后端一旦被打穿，攻击者最多能给已购课的地址补发证书，动不了资金和角色。
 * 撤销用 REVOKE=1 重跑。
 */
const { publicClient, deployer, addresses, params, courseCertificate } = await getChainContext();

await assertSepolia(await publicClient.getChainId());

const issuer = asAddress(
  process.env.CERTIFICATE_ISSUER_ADDRESS ?? "",
  "CERTIFICATE_ISSUER_ADDRESS",
);
const revoke = process.env.REVOKE === "1";

assert.ok(
  sameAddress(deployer, params.admin),
  `Connected wallet ${deployer} must be the admin ${params.admin} to change roles`,
);
assert.ok(
  !sameAddress(issuer, params.admin),
  "发证钱包不能与管理员是同一个地址：后端被打穿就等于管理员私钥泄露",
);

const minterRole = await courseCertificate.read.MINTER_ROLE();
const hasRole = await courseCertificate.read.hasRole([minterRole, issuer]);

console.log("CourseCertificate:", addresses.courseCertificate);
console.log("issuer:", issuer);
console.log("current MINTER_ROLE:", hasRole);

if (revoke) {
  if (!hasRole) {
    console.log("revoke skipped: issuer does not hold MINTER_ROLE");
  } else {
    const tx = await courseCertificate.write.revokeRole([minterRole, issuer]);
    await waitForTransaction(publicClient, tx, "revokeRole(MINTER_ROLE, issuer)");
  }
} else if (hasRole) {
  console.log("grant skipped: issuer already holds MINTER_ROLE");
} else {
  const tx = await courseCertificate.write.grantRole([minterRole, issuer]);
  await waitForTransaction(publicClient, tx, "grantRole(MINTER_ROLE, issuer)");
}

assert.equal(
  await courseCertificate.read.hasRole([minterRole, issuer]),
  !revoke,
  "MINTER_ROLE state did not change as expected",
);
console.log(revoke ? "MINTER_ROLE revoked" : "MINTER_ROLE granted");
