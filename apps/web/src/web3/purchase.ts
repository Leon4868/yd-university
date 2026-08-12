import type { EIP1193Provider } from "@privy-io/react-auth";
import { sepolia } from "viem/chains";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
} from "viem";

import { contractAddresses, courseMarketAbi, hasSepoliaContractConfig, SEPOLIA_CHAIN_ID, ydTokenAbi } from "./contracts.ts";

const TOKEN_DECIMALS = 18;

function requireAddress(value: Address | undefined, name: string): Address {
  if (!value) throw new Error(`缺少 ${name} 配置，请检查前端环境变量`);
  return value;
}

async function getConnectedAccount(provider: EIP1193Provider): Promise<Address> {
  const result = await provider.request({ method: "eth_accounts" });
  const accounts = Array.isArray(result) ? result : [];
  const account = accounts.find((item): item is string => typeof item === "string");
  if (!account) throw new Error("当前钱包没有可用的 EVM 地址，请重新连接钱包");
  return account as Address;
}

async function assertSepolia(provider: EIP1193Provider) {
  const result = await provider.request({ method: "eth_chainId" });
  const chainId = typeof result === "string" ? Number.parseInt(result, 16) : Number(result);
  if (chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error("请将钱包切换到 Ethereum Sepolia 后重试");
  }
}

function clients(provider: EIP1193Provider, account: Address) {
  const transport = custom(provider);
  return {
    publicClient: createPublicClient({ chain: sepolia, transport }),
    walletClient: createWalletClient({ account, chain: sepolia, transport }),
  };
}

export interface PurchaseState {
  account: Address;
  balance: string;
  allowance: bigint;
  purchased: boolean;
}

export async function readYdBalance(provider: EIP1193Provider): Promise<{ account: Address; balance: string }> {
  if (!hasSepoliaContractConfig) throw new Error("Sepolia 合约地址尚未配置");
  await assertSepolia(provider);
  const account = await getConnectedAccount(provider);
  const { publicClient } = clients(provider, account);
  const token = requireAddress(contractAddresses.ydToken, "VITE_YD_TOKEN_ADDRESS");
  const balance = await publicClient.readContract({ address: token, abi: ydTokenAbi, functionName: "balanceOf", args: [account] });
  return { account, balance: formatUnits(balance, TOKEN_DECIMALS) };
}

export async function readPurchaseState(provider: EIP1193Provider, courseId: string, priceYD: string): Promise<PurchaseState> {
  if (!hasSepoliaContractConfig) throw new Error("Sepolia 合约地址尚未配置");
  await assertSepolia(provider);
  const account = await getConnectedAccount(provider);
  const { publicClient } = clients(provider, account);
  const token = requireAddress(contractAddresses.ydToken, "VITE_YD_TOKEN_ADDRESS");
  const market = requireAddress(contractAddresses.courseMarket, "VITE_COURSE_MARKET_ADDRESS");
  const [balance, allowance, purchased] = await Promise.all([
    publicClient.readContract({ address: token, abi: ydTokenAbi, functionName: "balanceOf", args: [account] }),
    publicClient.readContract({ address: token, abi: ydTokenAbi, functionName: "allowance", args: [account, market] }),
    publicClient.readContract({ address: market, abi: courseMarketAbi, functionName: "hasPurchased", args: [BigInt(courseId), account] }),
  ]);
  const required = parseUnits(priceYD, TOKEN_DECIMALS);
  return {
    account,
    balance: formatUnits(balance, TOKEN_DECIMALS),
    allowance: allowance >= required ? allowance : 0n,
    purchased,
  };
}

export async function approveCourse(provider: EIP1193Provider, priceYD: string): Promise<Hash | null> {
  if (!hasSepoliaContractConfig) throw new Error("Sepolia 合约地址尚未配置");
  await assertSepolia(provider);
  const account = await getConnectedAccount(provider);
  const { publicClient, walletClient } = clients(provider, account);
  const token = requireAddress(contractAddresses.ydToken, "VITE_YD_TOKEN_ADDRESS");
  const market = requireAddress(contractAddresses.courseMarket, "VITE_COURSE_MARKET_ADDRESS");
  const price = parseUnits(priceYD, TOKEN_DECIMALS);
  const allowance = await publicClient.readContract({ address: token, abi: ydTokenAbi, functionName: "allowance", args: [account, market] });
  if (allowance >= price) return null;
  const hash = await walletClient.writeContract({
    account,
    address: token,
    abi: ydTokenAbi,
    functionName: "approve",
    args: [market, price],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function buyCourse(provider: EIP1193Provider, courseId: string, priceYD: string): Promise<Hash> {
  if (!hasSepoliaContractConfig) throw new Error("Sepolia 合约地址尚未配置");
  await assertSepolia(provider);
  const account = await getConnectedAccount(provider);
  const { publicClient, walletClient } = clients(provider, account);
  const market = requireAddress(contractAddresses.courseMarket, "VITE_COURSE_MARKET_ADDRESS");
  const price = parseUnits(priceYD, TOKEN_DECIMALS);
  const hash = await walletClient.writeContract({
    account,
    address: market,
    abi: courseMarketAbi,
    functionName: "buy",
    args: [BigInt(courseId), price],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
