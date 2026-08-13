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

/**
 * Uniswap V2 在 Sepolia 的官方部署。这三个地址已通过链上校验：
 * router.factory() 与 router.WETH() 分别等于下面的 factory / weth。
 */
export const UNISWAP_SEPOLIA = {
  router: "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3",
  factory: "0xF62c03E08ada871A0bEb309762E260a7a6a880E6",
  weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
} as const;

export const uniswapRouterAbi = [
  { type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "WETH", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "addLiquidityETH",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountTokenDesired", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountToken", type: "uint256" },
      { name: "amountETH", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
] as const;

export const uniswapFactoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const uniswapPairAbi = [
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

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
