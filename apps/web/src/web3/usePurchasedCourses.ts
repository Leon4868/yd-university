import { useEffect, useState, useSyncExternalStore } from "react";

import { apiErrorMessage, listPublishedCourses } from "../api/client.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { courses } from "../data/courses.ts";
import { getChainRevision, subscribeChainRevision } from "./chainState.ts";
import { hasSepoliaContractConfig } from "./contracts.ts";
import { readPurchasedCourseSlugs } from "./purchase.ts";

export interface PurchasedCoursesState {
  /** 当前钱包已在链上购买的课程 slug */
  slugs: string[];
  loading: boolean;
  error: string | null;
  /** 演示模式没有链上钱包，购买校验不适用，此时不做拦截 */
  bypassed: boolean;
}

const empty: PurchasedCoursesState = { slugs: [], loading: false, error: null, bypassed: false };

/**
 * 已购课程的唯一判定来源是链上 CourseMarket.hasPurchased：
 * 后端尚未同步 CoursePurchased 事件，所以不能用接口数据代替。
 * 钱包地址变化时会重新读取，避免切换 MetaMask 账号后沿用上一个账号的已购状态。
 */
export function usePurchasedCourses(): PurchasedCoursesState {
  const auth = useAuth();
  const revision = useSyncExternalStore(subscribeChainRevision, getChainRevision, getChainRevision);
  const [state, setState] = useState<PurchasedCoursesState>(empty);

  useEffect(() => {
    if (auth.authenticated && auth.demoMode) {
      setState({ ...empty, bypassed: true });
      return;
    }
    const getProvider = auth.getEthereumProvider;
    if (!auth.authenticated || !auth.walletReady || !getProvider || !hasSepoliaContractConfig) {
      setState(empty);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setState({ ...empty, loading: true });
    listPublishedCourses(controller.signal)
      .then(async (courses) => readPurchasedCourseSlugs(await getProvider(), courses))
      .then((slugs) => {
        if (!cancelled) setState({ slugs, loading: false, error: null, bypassed: false });
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setState({ ...empty, error: apiErrorMessage(error, "无法读取链上购买状态") });
      });
    return () => { cancelled = true; controller.abort(); };
  }, [auth.authenticated, auth.demoMode, auth.getEthereumProvider, auth.walletAddress, auth.walletReady, revision]);

  return state;
}

/** 学习入口指向的课程：优先已购课程，演示模式回落到首门演示课；未购买时返回 null 表示不展示入口 */
export function learnEntrySlug(state: PurchasedCoursesState): string | null {
  if (state.slugs.length > 0) return state.slugs[0];
  return state.bypassed ? courses[0].slug : null;
}
