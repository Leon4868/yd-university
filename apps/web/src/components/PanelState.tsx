import type { ReactNode } from "react";

/** 加载 / 空 / 错误三态的统一占位块 */
export function PanelState({ tone = "muted", title, description, action }: { tone?: "muted" | "error"; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className={`panel-state ${tone}`}>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
