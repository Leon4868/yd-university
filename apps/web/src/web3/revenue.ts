import type { EIP1193Provider } from "@privy-io/react-auth";
import { formatUnits, type Address, type Hash } from "viem";

import { contractAddresses, courseMarketAbi, hasSepoliaContractConfig } from "./contracts.ts";
import { assertSepolia, clients, getConnectedAccount, requireAddress, TOKEN_DECIMALS } from "./purchase.ts";

export interface RevenueState {
  account: Address;
  amount: string;
  amountRaw: bigint;
}

export async function readPendingRevenue(provider: EIP1193Provider): Promise<RevenueState> {
  if (!hasSepoliaContractConfig) throw new Error("Sepolia 合约地址尚未配置");
  await assertSepolia(provider);
  const account = await getConnectedAccount(provider);
  const { publicClient } = clients(provider, account);
  const market = requireAddress(contractAddresses.courseMarket, "VITE_COURSE_MARKET_ADDRESS");
  const amountRaw = await publicClient.readContract({
    address: market,
    abi: courseMarketAbi,
    functionName: "pendingWithdrawals",
    args: [account],
  });
  return { account, amountRaw, amount: formatUnits(amountRaw, TOKEN_DECIMALS) };
}

export async function withdrawRevenue(provider: EIP1193Provider): Promise<Hash> {
  const state = await readPendingRevenue(provider);
  if (state.amountRaw === 0n) throw new Error("当前钱包没有可提取的 YD 分账");
  const { publicClient, walletClient } = clients(provider, state.account);
  const market = requireAddress(contractAddresses.courseMarket, "VITE_COURSE_MARKET_ADDRESS");
  const hash = await walletClient.writeContract({
    account: state.account,
    address: market,
    abi: courseMarketAbi,
    functionName: "withdraw",
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
