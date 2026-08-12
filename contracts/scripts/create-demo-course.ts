import assert from "node:assert/strict";

import { parseEther } from "viem";

import {
  assertSepolia,
  asAddress,
  type CourseRecord,
  courseActive,
  courseMerchant,
  coursePrice,
  courseTeacher,
  displayYD,
  findCourseByMetadataURI,
  getChainContext,
  sameAddress,
  waitForTransaction,
} from "./shared.js";

const {
  publicClient,
  deployer,
  params,
  courseRegistry,
} = await getChainContext();

await assertSepolia(await publicClient.getChainId());

assert.ok(
  sameAddress(deployer, params.admin),
  `Connected wallet ${deployer} must match admin ${params.admin} to create courses`,
);

const teacher = asAddress(
  process.env.COURSE_TEACHER_ADDRESS ?? params.defaultTeacher,
  "COURSE_TEACHER_ADDRESS",
);
const merchant = asAddress(
  process.env.COURSE_MERCHANT_ADDRESS ?? params.defaultMerchant,
  "COURSE_MERCHANT_ADDRESS",
);
const priceYD = parseEther(process.env.COURSE_PRICE_YD ?? "4");
const metadataURI =
  process.env.COURSE_METADATA_URI ?? "ipfs://yd-university/solidity-from-zero";

const existingCourseId = await findCourseByMetadataURI(courseRegistry, metadataURI);
if (existingCourseId !== null) {
  const course = await courseRegistry.read.getCourse([existingCourseId]) as CourseRecord;
  console.log(`Course already exists: #${existingCourseId.toString()}`);
  console.log("teacher:", courseTeacher(course));
  console.log("merchant:", courseMerchant(course));
  console.log("price:", displayYD(coursePrice(course)));
  console.log("active:", courseActive(course));
  process.exit(0);
}

console.log("Creating demo course on Sepolia");
console.log("teacher:", teacher);
console.log("merchant:", merchant);
console.log("price:", displayYD(priceYD));
console.log("metadataURI:", metadataURI);

const tx = await courseRegistry.write.createCourse([
  teacher,
  merchant,
  priceYD,
  7000,
  2000,
  1000,
  metadataURI,
]);
await waitForTransaction(publicClient, tx, "createCourse");

const courseId = await findCourseByMetadataURI(courseRegistry, metadataURI);
assert.ok(courseId !== null, "Created course was not found by metadataURI");
console.log(`Created courseId: #${courseId.toString()}`);
