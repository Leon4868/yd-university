import assert from "node:assert/strict";

import { formatEther, parseEther, zeroAddress, type Address } from "viem";

import {
  assertSepolia,
  displayYD,
  getChainContext,
  sameAddress,
  UNISWAP_SEPOLIA,
  uniswapFactoryAbi,
  uniswapPairAbi,
  uniswapRouterAbi,
  waitForTransaction,
} from "./shared.js";

const { publicClient, walletClient, deployer, addresses, params, ydToken } = await getChainContext();

await assertSepolia(await publicClient.getChainId());

assert.ok(
  sameAddress(deployer, params.admin),
  `Connected wallet ${deployer} must match admin ${params.admin}: only the treasury holds YD`,
);

const ydAmount = parseEther(process.env.LIQUIDITY_YD_AMOUNT ?? "20000");
const ethAmount = parseEther(process.env.LIQUIDITY_ETH_AMOUNT ?? "0.02");
// 首次注入即定价，滑点保护对空池没有意义；后续追加时按 1% 容差保护比例
const slippageBps = BigInt(process.env.LIQUIDITY_SLIPPAGE_BPS ?? "100");

const router = UNISWAP_SEPOLIA.router as Address;
const factory = UNISWAP_SEPOLIA.factory as Address;
const weth = UNISWAP_SEPOLIA.weth as Address;

// 不信任硬编码：先让 router 自己确认它挂在哪个 factory / WETH 上
const [onChainFactory, onChainWeth] = await Promise.all([
  publicClient.readContract({ address: router, abi: uniswapRouterAbi, functionName: "factory" }),
  publicClient.readContract({ address: router, abi: uniswapRouterAbi, functionName: "WETH" }),
]);
assert.ok(sameAddress(onChainFactory, factory), `Router factory mismatch: ${onChainFactory}`);
assert.ok(sameAddress(onChainWeth, weth), `Router WETH mismatch: ${onChainWeth}`);

const [ydBalance, ethBalance] = await Promise.all([
  ydToken.read.balanceOf([deployer]) as Promise<bigint>,
  publicClient.getBalance({ address: deployer }),
]);

console.log("admin:", deployer);
console.log("YD balance:", displayYD(ydBalance));
console.log("ETH balance:", formatEther(ethBalance), "ETH");
console.log("adding liquidity:", displayYD(ydAmount), "+", formatEther(ethAmount), "ETH");

assert.ok(ydBalance >= ydAmount, `Not enough YD: have ${displayYD(ydBalance)}, need ${displayYD(ydAmount)}`);
assert.ok(
  ethBalance > ethAmount,
  `Not enough ETH: have ${formatEther(ethBalance)}, need more than ${formatEther(ethAmount)} plus gas`,
);

const existingPair = await publicClient.readContract({
  address: factory,
  abi: uniswapFactoryAbi,
  functionName: "getPair",
  args: [addresses.ydToken, weth],
});

if (existingPair !== zeroAddress) {
  const [reserves, token0] = await Promise.all([
    publicClient.readContract({ address: existingPair, abi: uniswapPairAbi, functionName: "getReserves" }),
    publicClient.readContract({ address: existingPair, abi: uniswapPairAbi, functionName: "token0" }),
  ]);
  const ydIsToken0 = sameAddress(token0, addresses.ydToken);
  const ydReserve = ydIsToken0 ? reserves[0] : reserves[1];
  const ethReserve = ydIsToken0 ? reserves[1] : reserves[0];
  console.log(`\nPair already exists: ${existingPair}`);
  console.log("YD reserve:", displayYD(ydReserve));
  console.log("ETH reserve:", formatEther(ethReserve), "ETH");
  if (ethReserve > 0n) {
    console.log("current rate:", formatEther((ydReserve * 10n ** 18n) / ethReserve), "YD per ETH");
  }
  if (process.env.LIQUIDITY_FORCE !== "1") {
    console.log("\nSet LIQUIDITY_FORCE=1 to add more liquidity on top of the existing pool.");
    process.exit(0);
  }
}

// 空池首投由本次金额定价，因此 min 值设为 0；追加时才需要按比例保护
const isFirstDeposit = existingPair === zeroAddress;
const minToken = isFirstDeposit ? 0n : ydAmount - (ydAmount * slippageBps) / 10_000n;
const minEth = isFirstDeposit ? 0n : ethAmount - (ethAmount * slippageBps) / 10_000n;

const approveHash = await ydToken.write.approve([router, ydAmount]);
await waitForTransaction(publicClient, approveHash, "approve router");

const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
const addHash = await walletClient.writeContract({
  address: router,
  abi: uniswapRouterAbi,
  functionName: "addLiquidityETH",
  args: [addresses.ydToken, ydAmount, minToken, minEth, deployer, deadline],
  value: ethAmount,
});
await waitForTransaction(publicClient, addHash, "addLiquidityETH");

const pair = await publicClient.readContract({
  address: factory,
  abi: uniswapFactoryAbi,
  functionName: "getPair",
  args: [addresses.ydToken, weth],
});
assert.ok(pair !== zeroAddress, "Pair was not created");

const [reserves, token0] = await Promise.all([
  publicClient.readContract({ address: pair, abi: uniswapPairAbi, functionName: "getReserves" }),
  publicClient.readContract({ address: pair, abi: uniswapPairAbi, functionName: "token0" }),
]);
const ydIsToken0 = sameAddress(token0, addresses.ydToken);
const ydReserve = ydIsToken0 ? reserves[0] : reserves[1];
const ethReserve = ydIsToken0 ? reserves[1] : reserves[0];

console.log(`\nYD/WETH pair: ${pair}`);
console.log("YD reserve:", displayYD(ydReserve));
console.log("ETH reserve:", formatEther(ethReserve), "ETH");
console.log("rate:", formatEther((ydReserve * 10n ** 18n) / ethReserve), "YD per ETH");
console.log("\nAdd to apps/web/.env.local:");
console.log(`VITE_UNISWAP_ROUTER_ADDRESS=${router}`);
console.log(`VITE_WETH_ADDRESS=${weth}`);
