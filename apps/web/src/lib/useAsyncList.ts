import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

import { ApiError, apiErrorMessage } from "../api/client.ts";

export interface AsyncListState<T> {
  items: T[];
  loading: boolean;
  /** 可读错误文案，null 表示本次加载成功 */
  error: string | null;
  /** ApiError.code，用于按 FORBIDDEN 等分支给不同提示 */
  errorCode: string | null;
  setItems: Dispatch<SetStateAction<T[]>>;
  reload: () => void;
}

/** 列表拉取的统一状态机：加载中 / 失败 / 数据，失败时清空列表避免展示脏数据 */
export function useAsyncList<T>(load: (signal: AbortSignal) => Promise<T[]>): AsyncListState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setItems(data);
        setError(null);
        setErrorCode(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setItems([]);
        setError(apiErrorMessage(cause));
        setErrorCode(cause instanceof ApiError ? cause.code : null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, reloadKey]);

  return { items, loading, error, errorCode, setItems, reload: () => setReloadKey((current) => current + 1) };
}
