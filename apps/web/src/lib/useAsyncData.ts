import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

import { ApiError, apiErrorMessage } from "../api/client.ts";

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  /** 可读错误文案，null 表示本次加载成功 */
  error: string | null;
  /** ApiError.code，用于按 UNAUTHENTICATED 等分支给不同提示 */
  errorCode: string | null;
  setData: Dispatch<SetStateAction<T | null>>;
  reload: () => void;
}

/** 单个资源的拉取状态机，与 useAsyncList 同构：加载中 / 失败 / 数据，失败时清空数据 */
export function useAsyncData<T>(load: (signal: AbortSignal) => Promise<T>): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setData(value);
        setError(null);
        setErrorCode(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setData(null);
        setError(apiErrorMessage(cause));
        setErrorCode(cause instanceof ApiError ? cause.code : null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, reloadKey]);

  return { data, loading, error, errorCode, setData, reload: () => setReloadKey((current) => current + 1) };
}
