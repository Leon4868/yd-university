/**
 * 链上状态版本号。
 *
 * 顶栏余额、已购课程这些读取挂在常驻组件上，钱包发生写操作后它们的依赖不会变化，
 * 因此需要一个显式信号来触发重新读取。任何成功的链上写交易（兑换、购买）都应调用
 * bumpChainRevision，订阅方会据此重新拉取。
 */
let revision = 0;
const listeners = new Set<() => void>();

export function bumpChainRevision() {
  revision += 1;
  for (const listener of listeners) listener();
}

export function subscribeChainRevision(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getChainRevision() {
  return revision;
}
