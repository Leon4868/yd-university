import type { Address } from "viem";

export const SEPOLIA_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? "11155111");
const addressPattern = /^0x[0-9a-fA-F]{40}$/;

function readAddress(name: string): Address | undefined {
  const value = String(import.meta.env[name] ?? "").trim();
  return addressPattern.test(value) ? value as Address : undefined;
}

export const contractAddresses = {
  ydToken: readAddress("VITE_YD_TOKEN_ADDRESS"),
  courseRegistry: readAddress("VITE_COURSE_REGISTRY_ADDRESS"),
  courseMarket: readAddress("VITE_COURSE_MARKET_ADDRESS"),
  courseCertificate: readAddress("VITE_COURSE_CERTIFICATE_ADDRESS"),
  completionReceiver: readAddress("VITE_COMPLETION_RECEIVER_ADDRESS"),
};

export const hasSepoliaContractConfig = Boolean(
  SEPOLIA_CHAIN_ID === 11155111
  && contractAddresses.ydToken
  && contractAddresses.courseRegistry
  && contractAddresses.courseMarket
  && contractAddresses.courseCertificate,
);

export const ydTokenAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const courseMarketAbi = [
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [{ name: "courseId", type: "uint256" }, { name: "maxPrice", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "pendingWithdrawals",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "hasPurchased",
    stateMutability: "view",
    inputs: [{ name: "courseId", type: "uint256" }, { name: "student", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const courseCertificateAbi = [
  {
    type: "function",
    name: "certificateOf",
    stateMutability: "view",
    inputs: [{ name: "courseId", type: "uint256" }, { name: "student", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

export function sepoliaTransactionUrl(hash: string) {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

export function sepoliaCertificateUrl(tokenId: string | number) {
  const certificate = contractAddresses.courseCertificate;
  if (!certificate) return "https://sepolia.etherscan.io";
  return `https://sepolia.etherscan.io/token/${certificate}?a=${tokenId}`;
}
