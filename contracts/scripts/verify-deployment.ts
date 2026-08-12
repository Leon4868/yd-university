import assert from "node:assert/strict";

import {
  assertContractCode,
  assertSepolia,
  displayYD,
  getChainContext,
  sameAddress,
} from "./shared.js";

const {
  publicClient,
  deployer,
  addresses,
  params,
  ydToken,
  courseRegistry,
  courseMarket,
  courseCertificate,
  completionReceiver,
} = await getChainContext();

await assertSepolia(await publicClient.getChainId());

console.log("Connected deployer:", deployer);
console.log("Configured admin:", params.admin);

await Promise.all([
  assertContractCode(publicClient, addresses.ydToken, "YDToken"),
  assertContractCode(publicClient, addresses.courseRegistry, "CourseRegistry"),
  assertContractCode(publicClient, addresses.courseMarket, "CourseMarket"),
  assertContractCode(publicClient, addresses.courseCertificate, "CourseCertificate"),
  assertContractCode(publicClient, addresses.completionReceiver, "CompletionReceiver"),
]);

assert.ok(
  sameAddress((await courseMarket.read.ydToken()) as typeof addresses.ydToken, addresses.ydToken),
  "CourseMarket.ydToken mismatch",
);
assert.ok(
  sameAddress(
    (await courseMarket.read.registry()) as typeof addresses.courseRegistry,
    addresses.courseRegistry,
  ),
  "CourseMarket.registry mismatch",
);
assert.ok(
  sameAddress(
    (await courseMarket.read.platformTreasury()) as typeof params.platformTreasury,
    params.platformTreasury,
  ),
  "CourseMarket.platformTreasury mismatch",
);
assert.ok(
  sameAddress(
    (await courseCertificate.read.market()) as typeof addresses.courseMarket,
    addresses.courseMarket,
  ),
  "CourseCertificate.market mismatch",
);
assert.ok(
  sameAddress(
    (await completionReceiver.read.certificate()) as typeof addresses.courseCertificate,
    addresses.courseCertificate,
  ),
  "CompletionReceiver.certificate mismatch",
);
assert.ok(
  sameAddress(
    (await completionReceiver.read.forwarder()) as typeof params.creForwarder,
    params.creForwarder,
  ),
  "CompletionReceiver.forwarder mismatch",
);

const minterRole = await courseCertificate.read.MINTER_ROLE();
assert.equal(
  await courseCertificate.read.hasRole([minterRole, addresses.completionReceiver]),
  true,
  "CompletionReceiver is missing CourseCertificate.MINTER_ROLE",
);

const courseManagerRole = await courseRegistry.read.COURSE_MANAGER_ROLE();
assert.equal(
  await courseRegistry.read.hasRole([courseManagerRole, params.admin]),
  true,
  "admin is missing CourseRegistry.COURSE_MANAGER_ROLE",
);

const totalSupply = (await ydToken.read.totalSupply()) as bigint;
const adminBalance = (await ydToken.read.balanceOf([params.admin])) as bigint;
const courseCount = (await courseRegistry.read.courseCount()) as bigint;

console.log("YDToken:", addresses.ydToken);
console.log("CourseRegistry:", addresses.courseRegistry);
console.log("CourseMarket:", addresses.courseMarket);
console.log("CourseCertificate:", addresses.courseCertificate);
console.log("CompletionReceiver:", addresses.completionReceiver);
console.log("YD total supply:", displayYD(totalSupply));
console.log("Admin YD balance:", displayYD(adminBalance));
console.log("Registry course count:", courseCount.toString());
console.log("Deployment verification passed.");
