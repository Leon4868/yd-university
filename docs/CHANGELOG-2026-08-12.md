# 变更日志 — 2026-08-12

## 角色权限与工作台优化

### 新增

- 统一学生、教师、商家、管理员的导航、路由与服务端权限矩阵。
- 商家分账课程接口与商家中心，教师/商家均可读取并提取 Sepolia `CourseMarket` 待提收益。
- 个人中心使用真实学习进度、YD 余额和链上证书，移除固定假数据与无功能按钮。
- 当前钱包必须与签名 Privy identity token 匹配；同一 Privy 会话切换钱包时同步角色并清除残留管理员权限。
- 教师建课时从已审核商家中选择 20% 分账方，后端拒绝未审核或非商家身份。
- 首页课程筛选改为真实可操作，课程详情移除无效视频预览，已授权钱包直接进入购买步骤。
- 未部署的 YD 兑换功能改为明确的不可用状态，不再展示虚构汇率或可点击假按钮。

### 关键文件

- `apps/web/src/auth/permissions.ts` — 前端角色能力矩阵。
- `apps/web/src/auth/AccessBoundary.tsx` — 页面路由访问控制。
- `apps/api/src/auth/guards.ts` — 当前钱包同步与服务端角色校验。
- `apps/api/src/routes/merchant-courses.ts` — 商家分账课程只读接口。
- `apps/api/src/routes/teacher-courses.ts` — 已审核商家选择与建课绑定校验。
- `apps/web/src/web3/revenue.ts` — 链上分账读取与提取。

### 架构决策

- 隐藏按钮不等于授权，角色接口必须由服务端 `requireRole` 再次校验。
- 客户端钱包地址只作为选择提示，必须在后端验证的 identity token 中存在才可信。
- 分账提取保持 pull-payment，由收款钱包直接调用合约，不由中心化 API 代签。
