import { ArrowRight, Coins, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatEther } from "viem";

import { useAuth } from "../auth/AuthContext.tsx";
import { PanelState } from "../components/PanelState.tsx";
import { bumpChainRevision } from "../web3/chainState.ts";
import { hasSwapConfig, SEPOLIA_CHAIN_ID, sepoliaTransactionUrl } from "../web3/contracts.ts";
import { readYdBalance } from "../web3/purchase.ts";
import { quoteEthForYd, swapEthForExactYd, SwapUnavailableError, type SwapQuote } from "../web3/swap.ts";

/** 默认换够一门课的价格 */
const DEFAULT_YD_AMOUNT = "4";
const amountPattern = /^\d+(\.\d{1,18})?$/;

function formatEth(wei: bigint) {
  const [whole, fraction = ""] = formatEther(wei).split(".");
  const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function SwapPage() {
  const auth = useAuth();
  const [params] = useSearchParams();
  // 从课程页带来的缺口数量只作预填，用户可以随意改成想兑换的数量
  const suggested = params.get("need");
  const from = params.get("from");
  return (
    <div className="page-container feature-page">
      <div className="feature-heading">
        <span className="feature-icon"><Coins /></span>
        <div>
          <span className="overline">YD SWAP</span>
          <h1>兑换 YD</h1>
          <p>通过 Uniswap V2 用 Sepolia ETH 换取 YD，兑换数量由你自己决定，换到的 YD 可用于购买任意课程。</p>
        </div>
      </div>
      <SwapBody key={auth.walletAddress ?? "anonymous"} suggested={suggested} from={from} />
    </div>
  );
}

function SwapBody({ suggested, from }: { suggested: string | null; from: string | null }) {
  const auth = useAuth();
  const [amount, setAmount] = useState(
    suggested && amountPattern.test(suggested) && Number(suggested) > 0 ? suggested : DEFAULT_YD_AMOUNT,
  );
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [ydBalance, setYdBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const navigate = useNavigate();

  const getProvider = auth.getEthereumProvider;
  const backHref = from ? `/courses/${from}` : "/";
  const valid = amountPattern.test(amount) && Number(amount) > 0;

  const refreshBalance = useCallback(() => {
    if (!getProvider) return;
    void getProvider().then(readYdBalance).then(({ balance }) => setYdBalance(balance)).catch(() => setYdBalance(null));
  }, [getProvider]);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  // 兑换成功后自动返回来源页；留 2 秒让用户看到成功状态和交易链接
  useEffect(() => {
    if (!txHash) return;
    const timer = setTimeout(() => navigate(backHref), 2000);
    return () => clearTimeout(timer);
  }, [backHref, navigate, txHash]);

  useEffect(() => {
    if (!getProvider || !hasSwapConfig || !valid) {
      setQuote(null);
      setQuoteError(valid ? null : "请输入大于 0 的 YD 数量");
      return;
    }
    let cancelled = false;
    setQuoting(true);
    void (async () => {
      try {
        const result = await quoteEthForYd(await getProvider(), amount);
        if (!cancelled) { setQuote(result); setQuoteError(null); }
      } catch (error: unknown) {
        if (!cancelled) { setQuote(null); setQuoteError(error instanceof Error ? error.message : "无法读取兑换报价"); }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [amount, getProvider, valid]);

  if (!auth.authenticated) {
    return <PanelState title="请先登录" description="兑换需要由你的钱包签名，登录后才能继续。" action={<button type="button" className="button primary small" onClick={auth.login}>登录</button>} />;
  }
  if (!hasSwapConfig) {
    return <PanelState tone="error" title="兑换尚未配置" description="缺少 Uniswap router 或 WETH 地址配置，请在前端环境变量中补齐 VITE_UNISWAP_ROUTER_ADDRESS 与 VITE_WETH_ADDRESS。" action={<Link className="button secondary small" to="/">返回课程市场<ArrowRight size={16} /></Link>} />;
  }
  if (auth.demoMode || !getProvider) {
    return <PanelState title="需要钱包登录" description="演示模式没有连接链上钱包，请使用钱包登录后再兑换。" action={<Link className="button secondary small" to="/">返回课程市场<ArrowRight size={16} /></Link>} />;
  }

  const poolMissing = quoteError !== null && quoteError.includes("流动性池");

  const handleSwap = async () => {
    if (!auth.switchEthereumChain || !quote?.affordable) return;
    setBusy(true);
    setActionError(null);
    try {
      await auth.switchEthereumChain(SEPOLIA_CHAIN_ID);
      const hash = await swapEthForExactYd(await getProvider(), amount);
      setTxHash(hash);
      // 通知顶栏余额、已购课程等常驻读取重新拉取链上状态
      bumpChainRevision();
      refreshBalance();
    } catch (error: unknown) {
      setActionError(error instanceof SwapUnavailableError || error instanceof Error ? error.message : "兑换失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="purchase-card swap-card">
      <div className="purchase-header">
        <span>当前 YD 余额</span>
        <strong>{ydBalance ?? "—"} YD</strong>
        <small>Ethereum Sepolia</small>
      </div>
      <label className="swap-field">
        <span>想换到的 YD 数量</span>
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.trim())} aria-label="兑换的 YD 数量" />
      </label>
      {suggested && <p className="purchase-help">已按课程差额预填 {suggested} YD，你可以改成任意数量。</p>}
      {quoting && <p className="purchase-help">正在按当前池子报价…</p>}
      {quote && (
        <div className="swap-quote">
          <p className="purchase-help">
            预计需要 <strong>{formatEth(quote.ethIn)} ETH</strong>，实际发送上限 {formatEth(quote.ethInMax)} ETH（含 1% 滑点保护，多余部分自动退回）。
          </p>
          <p className="purchase-help">当前钱包 ETH 余额：{formatEth(quote.ethBalance)} ETH</p>
        </div>
      )}
      {poolMissing ? (
        <p className="inline-alert">YD/ETH 流动性池尚未创建，暂时无法兑换。需要管理员先向 Uniswap V2 注入 YD/ETH 流动性（<code>npm run chain:add-liquidity -w @yd/contracts</code>）。</p>
      ) : quoteError && <p className="inline-alert">{quoteError}</p>}
      {quote && !quote.affordable && <p className="inline-alert">ETH 余额不足以完成本次兑换，请先领取 Sepolia 测试 ETH。</p>}
      <button type="button" className="button primary full" disabled={busy || !quote?.affordable} onClick={() => void handleSwap()}>
        {busy ? "等待钱包确认…" : quote?.affordable ? `用 ${formatEth(quote.ethIn)} ETH 兑换 ${amount} YD` : "暂不可兑换"}
        <ArrowRight size={18} />
      </button>
      {actionError && <p className="inline-alert">{actionError}</p>}
      {txHash && (
        <>
          <p className="swap-success">兑换成功，正在返回{from ? "课程页" : "课程市场"}…</p>
          <a className="explorer-link" href={sepoliaTransactionUrl(txHash)} target="_blank" rel="noreferrer">查看兑换交易<ExternalLink size={14} /></a>
          <Link className="button secondary full" to={backHref}>
            {from ? "立即返回课程" : "立即返回课程市场"}<ArrowRight size={16} />
          </Link>
        </>
      )}
      <p className="purchase-help">兑换走 Uniswap V2 的 <code>swapETHForExactTokens</code>，按你填写的 YD 数量精确换出，多付的 ETH 由 router 退回。</p>
    </div>
  );
}
