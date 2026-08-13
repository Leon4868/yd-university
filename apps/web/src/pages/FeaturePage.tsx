import { ArrowRight, Coins } from "lucide-react";
import { Link } from "react-router-dom";

import { PanelState } from "../components/PanelState.tsx";

const configs = {
  swap: {
    eyebrow: "YD SWAP",
    title: "兑换 YD",
    description: "兑换合约尚未部署，因此当前不会展示虚构汇率，也不会发起任何钱包交易。",
  },
} as const;

export function FeaturePage({ type }: { type: keyof typeof configs }) {
  const config = configs[type];
  return (
    <div className="page-container feature-page">
      <div className="feature-heading"><span className="feature-icon"><Coins /></span><div><span className="overline">{config.eyebrow}</span><h1>{config.title}</h1><p>{config.description}</p></div></div>
      <PanelState title="功能尚未开放" description="待 YD 兑换合约、报价来源和滑点保护接入后，这里才会开放交易按钮。" action={<Link className="button secondary small" to="/">返回课程市场<ArrowRight size={16} /></Link>} />
    </div>
  );
}
