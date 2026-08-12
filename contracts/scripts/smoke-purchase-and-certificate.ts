import assert from "node:assert/strict";

import { keccak256, stringToHex } from "viem";

import {
  assertSepolia,
  courseActive,
  courseMetadataURI,
  coursePrice,
  type CourseRecord,
  displayYD,
  findCourseByMetadataURI,
  getChainContext,
  sameAddress,
  waitForTransaction,
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

assert.ok(
  sameAddress(deployer, params.creForwarder),
  `Connected wallet ${deployer} must match CompletionReceiver forwarder ${params.creForwarder}`,
);

const metadataURI =
  process.env.COURSE_METADATA_URI ?? "ipfs://yd-university/solidity-from-zero";
const courseId =
  process.env.COURSE_ID !== undefined
    ? BigInt(process.env.COURSE_ID)
    : await findCourseByMetadataURI(courseRegistry, metadataURI);

assert.ok(courseId !== null, "No course found. Run npm run chain:create-course first.");

const student = deployer;
const course = await courseRegistry.read.getCourse([courseId]) as CourseRecord;
const priceYD = coursePrice(course);
assert.equal(courseActive(course), true, `Course #${courseId.toString()} is not active`);

console.log(`Using course #${courseId.toString()}: ${courseMetadataURI(course)}`);
console.log("student:", student);
console.log("price:", displayYD(priceYD));

const studentBalance = (await ydToken.read.balanceOf([student])) as bigint;
assert.ok(
  studentBalance >= priceYD,
  `Student balance ${displayYD(studentBalance)} is below course price ${displayYD(priceYD)}`,
);

const allowance = (await ydToken.read.allowance([student, addresses.courseMarket])) as bigint;
if (allowance < priceYD) {
  const approveTx = await ydToken.write.approve([addresses.courseMarket, priceYD]);
  await waitForTransaction(publicClient, approveTx, "approve");
} else {
  console.log("approve skipped: allowance already covers price");
}

const alreadyPurchased = await courseMarket.read.hasPurchased([courseId, student]);
if (!alreadyPurchased) {
  const buyTx = await courseMarket.write.buy([courseId, priceYD]);
  await waitForTransaction(publicClient, buyTx, "buy");
} else {
  console.log("buy skipped: student already purchased this course");
}

const existingTokenId = (await courseCertificate.read.certificateOf([
  courseId,
  student,
])) as bigint;
if (existingTokenId !== 0n) {
  console.log(`certificate skipped: token #${existingTokenId.toString()} already exists`);
  process.exit(0);
}

const completionId = keccak256(
  stringToHex(`yd-university:sepolia:${courseId.toString()}:${student.toLowerCase()}`),
);
const consumed = await completionReceiver.read.consumedReports([completionId]);
assert.equal(consumed, false, "Completion report was already consumed but no certificate exists");

const certificateMetadataURI =
  process.env.CERTIFICATE_METADATA_URI ??
  `ipfs://yd-university/certificates/${courseId.toString()}/${student}`;

const completionTx = await completionReceiver.write.onCompletionReport([
  completionId,
  student,
  courseId,
  certificateMetadataURI,
]);
await waitForTransaction(publicClient, completionTx, "onCompletionReport");

const tokenId = (await courseCertificate.read.certificateOf([courseId, student])) as bigint;
assert.notEqual(tokenId, 0n, "Certificate was not minted");
console.log(`Minted certificate token #${tokenId.toString()}`);
