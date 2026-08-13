import { useEffect, useState, useSyncExternalStore } from "react";

import { useAuth } from "../auth/AuthContext.tsx";
import { getChainRevision, subscribeChainRevision } from "./chainState.ts";
import { hasSepoliaContractConfig } from "./contracts.ts";
import { readYdBalance } from "./purchase.ts";

export interface YdBalanceState {
  balance: string | null;
  loading: boolean;
  error: string | null;
}

export function useYdBalance(): YdBalanceState {
  const auth = useAuth();
  const revision = useSyncExternalStore(subscribeChainRevision, getChainRevision, getChainRevision);
  const [state, setState] = useState<YdBalanceState>({ balance: null, loading: false, error: null });

  useEffect(() => {
    if (!auth.authenticated || auth.demoMode || !auth.walletReady || !auth.getEthereumProvider || !hasSepoliaContractConfig) {
      setState({ balance: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ balance: null, loading: true, error: null });
    void auth.getEthereumProvider()
      .then(readYdBalance)
      .then(({ balance }) => {
        if (!cancelled) setState({ balance, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ balance: null, loading: false, error: error instanceof Error ? error.message : "读取链上余额失败" });
        }
      });
    return () => { cancelled = true; };
  }, [auth.authenticated, auth.demoMode, auth.getEthereumProvider, auth.walletReady, revision]);

  return state;
}

export function displayYdBalance(balance: string | null) {
  if (balance === null) return "—";
  const [whole, fraction = ""] = balance.split(".");
  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
