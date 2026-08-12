import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { network } from "hardhat";
import {
  formatEther,
  getAddress,
  isAddress,
  type Address,
  type Hash,
} from "viem";

const DEPLOYMENT_FILE = join(
  process.cwd(),
  "ignition/deployments/chain-11155111/deployed_addresses.json",
);
const PARAMETERS_FILE = join(process.cwd(), "ignition/parameters.sepolia.json");

type DeploymentJson = Record<string, string>;

export interface DeployedAddresses {
  ydToken: Address;
  courseRegistry: Address;
  courseMarket: Address;
  courseCertificate: Address;
  completionReceiver: Address;
}

export interface SepoliaParameters {
  admin: Address;
  platformTreasury: Address;
  creForwarder: Address;
  defaultTeacher: Address;
  defaultMerchant: Address;
}

export type CourseRecord = readonly [
  Address,
  Address,
  bigint,
  number,
  number,
  number,
  boolean,
  string,
] & {
  teacher?: Address;
  merchant?: Address;
  priceYD?: bigint;
  teacherShareBps?: number;
  merchantShareBps?: number;
  platformShareBps?: number;
  active?: boolean;
  metadataURI?: string;
};

export function asAddress(value: string, label: string): Address {
  assert.ok(isAddress(value), `${label} is not a valid address: ${value}`);
  return getAddress(value);
}

export function readDeployedAddresses(): DeployedAddresses {
  const json = JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8")) as DeploymentJson;

  return {
    courseRegistry: asAddress(
      json["YDUniversityModule#CourseRegistry"],
      "CourseRegistry",
    ),
    ydToken: asAddress(json["YDUniversityModule#YDToken"], "YDToken"),
    courseMarket: asAddress(
      json["YDUniversityModule#CourseMarket"],
      "CourseMarket",
    ),
    courseCertificate: asAddress(
      json["YDUniversityModule#CourseCertificate"],
      "CourseCertificate",
    ),
    completionReceiver: asAddress(
      json["YDUniversityModule#CompletionReceiver"],
      "CompletionReceiver",
    ),
  };
}

export function readSepoliaParameters(): SepoliaParameters {
  const json = JSON.parse(readFileSync(PARAMETERS_FILE, "utf8")) as {
    YDUniversityModule: Record<string, string>;
  };
  const params = json.YDUniversityModule;

  return {
    admin: asAddress(params.admin, "admin"),
    platformTreasury: asAddress(params.platformTreasury, "platformTreasury"),
    creForwarder: asAddress(params.creForwarder, "creForwarder"),
    defaultTeacher: asAddress(params.defaultTeacher, "defaultTeacher"),
    defaultMerchant: asAddress(params.defaultMerchant, "defaultMerchant"),
  };
}

export async function getChainContext() {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const addresses = readDeployedAddresses();
  const params = readSepoliaParameters();

  const [ydToken, courseRegistry, courseMarket, courseCertificate, completionReceiver] =
    await Promise.all([
      viem.getContractAt("YDToken", addresses.ydToken),
      viem.getContractAt("CourseRegistry", addresses.courseRegistry),
      viem.getContractAt("CourseMarket", addresses.courseMarket),
      viem.getContractAt("CourseCertificate", addresses.courseCertificate),
      viem.getContractAt("CompletionReceiver", addresses.completionReceiver),
    ]);

  return {
    viem,
    publicClient,
    walletClient,
    deployer: walletClient.account.address,
    addresses,
    params,
    ydToken,
    courseRegistry,
    courseMarket,
    courseCertificate,
    completionReceiver,
  };
}

export async function assertSepolia(chainId: number): Promise<void> {
  assert.equal(chainId, 11155111, `Expected Sepolia chainId 11155111, got ${chainId}`);
}

export async function assertContractCode(
  publicClient: Awaited<ReturnType<typeof getChainContext>>["publicClient"],
  address: Address,
  label: string,
): Promise<void> {
  const code = await publicClient.getCode({ address });
  assert.ok(code !== undefined && code !== "0x", `${label} has no code at ${address}`);
}

export function sameAddress(left: Address, right: Address): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function courseTeacher(course: CourseRecord): Address {
  return course.teacher ?? course[0];
}

export function courseMerchant(course: CourseRecord): Address {
  return course.merchant ?? course[1];
}

export function coursePrice(course: CourseRecord): bigint {
  return course.priceYD ?? course[2];
}

export function courseMetadataURI(course: CourseRecord): string {
  return course.metadataURI ?? course[7];
}

export function courseActive(course: CourseRecord): boolean {
  return course.active ?? course[6];
}

export function displayYD(amount: bigint): string {
  return `${formatEther(amount)} YD`;
}

export async function waitForTransaction(
  publicClient: Awaited<ReturnType<typeof getChainContext>>["publicClient"],
  hash: Hash,
  label: string,
): Promise<void> {
  console.log(`${label} tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success", `${label} transaction reverted`);
  console.log(`${label} confirmed in block ${receipt.blockNumber}`);
}

export async function findCourseByMetadataURI(
  courseRegistry: Awaited<ReturnType<typeof getChainContext>>["courseRegistry"],
  metadataURI: string,
): Promise<bigint | null> {
  const courseCount = (await courseRegistry.read.courseCount()) as bigint;

  for (let courseId = 1n; courseId <= courseCount; courseId += 1n) {
    const course = (await courseRegistry.read.getCourse([courseId])) as CourseRecord;
    if (courseMetadataURI(course) === metadataURI) {
      return courseId;
    }
  }

  return null;
}
