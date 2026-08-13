import type { EIP1193Provider } from "@privy-io/react-auth";
import { formatEther, parseUnits, type Address, type Hash } from "viem";

import { contractAddresses, hasSwapConfig, uniswapRouterAbi, ydTokenAbi } from "./contracts.ts";
import { assertSepolia, clients, getConnectedAccount, requireAddress, TOKEN_DECIMALS } from "./purchase.ts";

/** 兑换的默认滑点容忍度，1% */
const DEFAULT_SLIPPAGE_BPS = 100n;
const DEADLINE_SECONDS = 20 * 60;

/** YD/ETH 池子还没建，或池子深度不足以换出所需数量 */
export class SwapUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwapUnavailableError";
  }
}

export interface SwapQuote {
  /** 需要换出的 YD */
  ydOut: bigint;
  /** 按当前池子报价所需的 ETH */
  ethIn: bigint;
  /** 加上滑点保护后实际发送的 ETH 上限，多余部分由 router 退回 */
  ethInMax: bigint;
  /** 当前钱包 ETH 余额 */
  ethBalance: bigint;
  /** ETH 是否够付 ethInMax（不含 gas） */
  affordable: boolean;
}

function swapPath(): readonly [Address, Address] {
  const weth = requireAddress(contractAddresses.weth, "VITE_WETH_ADDRESS");
  const yd = requireAddress(contractAddresses.ydToken, "VITE_YD_TOKEN_ADDRESS");
  return [weth, yd];
}

function assertSwapConfigured() {
  if (!hasSwapConfig) {
    throw new SwapUnavailableError("YD 兑换尚未配置，请先设置 Uniswap router 与 WETH 地址");
  }
}

/**
 * 报价换出指定数量 YD 需要多少 ETH。
 * 用 getAmountsIn + swapETHForExactTokens，保证换到的 YD 正好够买课，
 * 多付的 ETH 由 router 自动退回，不会因为价格波动换少了。
 */
export async function quoteEthForYd(
  provider: EIP1193Provider,
  ydAmount: string,
  slippageBps: bigint = DEFAULT_SLIPPAGE_BPS,
): Promise<SwapQuote> {
  assertSwapConfigured();
  await assertSepolia(provider);
  const account = await getConnectedAccount(provider);
  const { publicClient } = clients(provider, account);
  const router = requireAddress(contractAddresses.uniswapRouter, "VITE_UNISWAP_ROUTER_ADDRESS");
  const ydOut = parseUnits(ydAmount, TOKEN_DECIMALS);

  let amounts: readonly bigint[];
  try {
    amounts = await publicClient.readContract({
      address: router,
      abi: uniswapRouterAbi,
      functionName: "getAmountsIn",
      args: [ydOut, swapPath()],
    });
  } catch {
    // getAmountsIn 在池子不存在或储备不足时会 revert，这里给出可读原因
    throw new SwapUnavailableError("YD/ETH 流动性池尚未创建或深度不足，暂时无法兑换");
  }

  const ethIn = amounts[0];
  const ethInMax = ethIn + (ethIn * slippageBps) / 10_000n;
  const ethBalance = await publicClient.getBalance({ address: account });
  return { ydOut, ethIn, ethInMax, ethBalance, affordable: ethBalance > ethInMax };
}

/** 用 ETH 换出正好 ydAmount 的 YD；返回交易哈希 */
export async function swapEthForExactYd(
  provider: EIP1193Provider,
  ydAmount: string,
  slippageBps: bigint = DEFAULT_SLIPPAGE_BPS,
): Promise<Hash> {
  const quote = await quoteEthForYd(provider, ydAmount, slippageBps);
  if (!quote.affordable) {
    throw new SwapUnavailableError(
      `ETH 余额不足：需要约 ${formatEther(quote.ethInMax)} ETH（不含 gas），当前 ${formatEther(quote.ethBalance)} ETH`,
    );
  }
  const account = await getConnectedAccount(provider);
  const { publicClient, walletClient } = clients(provider, account);
  const router = requireAddress(contractAddresses.uniswapRouter, "VITE_UNISWAP_ROUTER_ADDRESS");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
  const hash = await walletClient.writeContract({
    account,
    address: router,
    abi: uniswapRouterAbi,
    functionName: "swapETHForExactTokens",
    args: [quote.ydOut, swapPath(), account, deadline],
    value: quote.ethInMax,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * 还差多少 YD，用于给兑换页预填数量。
 * 走 parseUnits 整数运算而不是浮点减法，避免出现 3.9999999999 这种预填值。
 */
export function shortfallYd(balance: string | null, priceYD: string): string {
  const required = parseUnits(priceYD, TOKEN_DECIMALS);
  if (balance === null) return priceYD;
  let held: bigint;
  try {
    held = parseUnits(balance, TOKEN_DECIMALS);
  } catch {
    return priceYD;
  }
  return held >= required ? "0" : formatEther(required - held);
}

/** 当前钱包还差多少 YD 才够买课；够则返回 null */
export async function readYdShortfall(
  provider: EIP1193Provider,
  priceYD: string,
): Promise<{ shortfall: string; balance: bigint } | null> {
  await assertSepolia(provider);
  const account = await getConnectedAccount(provider);
  const { publicClient } = clients(provider, account);
  const token = requireAddress(contractAddresses.ydToken, "VITE_YD_TOKEN_ADDRESS");
  const required = parseUnits(priceYD, TOKEN_DECIMALS);
  const balance = await publicClient.readContract({
    address: token,
    abi: ydTokenAbi,
    functionName: "balanceOf",
    args: [account],
  });
  if (balance >= required) return null;
  return { shortfall: formatEther(required - balance), balance };
}
