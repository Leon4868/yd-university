# YD University API 契约 v0.2

本文件是前后端唯一的接口事实来源。改接口先改这里。

## 认证

Privy App ID 尚未提供，因此认证做成可插拔的两段式：

```
Authorization: Bearer <token>
```

- `AuthVerifier` 接口：`verify(token) => { subject: string; email?: string; wallet?: string } | null`
  - `subject` 对应 `users.privy_user_id`。
- `DemoAuthVerifier`（`AUTH_MODE=demo`，默认）：token 形如 `demo:<privy_user_id>`，直接返回该 subject。
- `PrivyAuthVerifier`（`AUTH_MODE=privy`）：读 `PRIVY_APP_ID` / `PRIVY_APP_SECRET` 校验访问令牌。
  未配置凭证时启动即报错，不静默降级。

**角色一律以数据库 `users.role` 为准，绝不信任请求体或请求头里的角色声明。**
未登录 401 `UNAUTHENTICATED`；已登录但角色不足 403 `FORBIDDEN`。

## 错误响应

统一形状 `{ "error": "CODE", "message": "可读说明" }`。

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | 参数校验失败 |
| 401 | `UNAUTHENTICATED` | 缺少/无效 token |
| 403 | `FORBIDDEN` | 角色不足 |
| 404 | `NOT_FOUND` | 资源不存在或对当前用户不可见 |
| 409 | `INVALID_STATE_TRANSITION` | 状态机不允许的流转 |

## 端点

### 身份

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/me` | 已登录 | 返回当前用户与角色 |

`GET /api/me` → `{ data: { id, username, avatarUrl, primaryWallet, role, creator } }`
其中 `role` ∈ `student` \| `teacher` \| `merchant` \| `admin`；
`creator` 为当前用户的创作者申请（无则 `null`）：`{ id, role, displayName, walletAddress, reviewStatus, rejectionReason, reviewedAt }`。

### 创作者申请

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/creators/applications` | 已登录 | 申请成为 teacher 或 merchant |
| GET | `/api/creators/applications/mine` | 已登录 | 查看自己的申请 |

`POST` body：`{ role: "teacher" \| "merchant", displayName: string(1..80), walletAddress: /^0x[0-9a-fA-F]{40}$/ }`
- 同一用户同一 role 已有 `pending` 或 `approved` 申请 → 409。
- 已 `rejected` 允许重新提交，复用同一行并重置为 `pending`，清空 `rejection_reason`。

### 管理员：教师/商家审核

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/creators?status=pending` | admin | 待审列表，`status` 可选 pending/approved/rejected，默认 pending |
| POST | `/api/admin/creators/:id/approve` | admin | 通过 |
| POST | `/api/admin/creators/:id/reject` | admin | 驳回，body `{ reason: string(1..500) }` |

通过后：`review_status='approved'`、写 `verified_at`/`reviewed_by`/`reviewed_at`，
并把申请人的 `users.role` 升为该 `creators.role`（admin 不被降级）。
驳回后：`review_status='rejected'`、必填 `rejection_reason`，`users.role` 不变。
非 `pending` 状态再次审核 → 409。

### 管理员：课程上架审核

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/courses?status=review` | admin | 默认 `review`，可选 draft/review/published/archived |
| POST | `/api/admin/courses/:id/publish` | admin | 上架 |
| POST | `/api/admin/courses/:id/reject` | admin | 驳回，body `{ reason: string(1..500) }` |

上架：`status='published'`，写 `reviewed_by`/`reviewed_at`/`published_at`（002 的 CHECK 约束要求三者齐全）。
仅允许从 `review` 上架，其它状态 → 409。
驳回：退回 `draft` 并写 `rejection_reason`，仅允许从 `review` 驳回。

### 教师：我的课程

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/teacher/courses` | 已审核通过的 teacher | 自己的全部课程（含未上架） |
| POST | `/api/teacher/courses` | 已审核通过的 teacher | 建草稿 |
| POST | `/api/teacher/courses/:id/submit` | 课程所属 teacher | 提交审核 |

`POST /api/teacher/courses` body：
`{ slug, title, summary, category, level, priceYD, coverTone?, courseUrl?, providerName?, sections?: [{ title, originalTitle?, url?, durationSeconds? }] }`
创建后 `status='draft'`。`slug` 重复 → 409。
提交审核：仅允许 `draft` → `review`，写 `submitted_at`，清空上轮 `rejection_reason`；其它状态 → 409。

**未通过审核的教师调用以上任一端点 → 403。**

### 公开课程（既有，不变）

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/courses` | 公开 | 只返回 `published` |
| GET | `/api/courses/:slug` | 公开 | 只返回 `published`，含 sections |
