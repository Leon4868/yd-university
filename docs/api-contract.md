# YD University API 契约 v0.2

本文件是前后端唯一的接口事实来源。改接口先改这里。
当前内容已与 `apps/api/src` 的实现逐条核对。

成功响应统一包一层 `data`：`{ "data": ... }`。

## 认证

认证做成可插拔的两段式（`apps/api/src/auth/verifier.ts`），本地演示与真实 Privy 共用同一业务鉴权层：

```
Authorization: Bearer <token>
```

- `AuthVerifier` 接口：`verify(token) => Promise<{ subject: string; email?: string; wallet?: string } | null>`
  - `subject` 对应 `users.privy_user_id`。
- `DemoAuthVerifier`（`AUTH_MODE=demo`，默认）：token 形如 `demo:<privy_user_id>`，取出 subject，不做任何签名校验。
  前缀不匹配或 subject 为空一律返回 `null`。
- `PrivyAuthVerifier`（`AUTH_MODE=privy`）：用 `jose` 校验 Privy 签发的 ES256 访问令牌，公钥取自
  `https://auth.privy.io/api/v1/apps/<PRIVY_APP_ID>/jwks.json`，并强制 `issuer=privy.io`、`audience=<PRIVY_APP_ID>`。
  `subject` 取 JWT 的 `sub`（形如 `did:privy:xxx`）。**只需要 `PRIVY_APP_ID`**；缺它启动即报错，不静默降级。
  `PRIVY_APP_SECRET` 只在将来调用 Privy 服务端 API 取用户资料时才需要，令牌校验用不到。
  签名、过期、issuer/audience 不匹配一律返回 `null`（统一 401，不区分原因以免被探测）。

鉴权在 `apps/api/src/auth/guards.ts`：`requireUser` 解析 Bearer → `verify` → 用 subject 回库查 `users`，
前两步失败都是 401；`requireRole(...roles)` 在此基础上比对 `users.role`，不匹配 403。

**首次登录建号**：verifier 带 `autoProvision` 标记。`PrivyAuthVerifier` 为 `true`——校验通过但库里没有该 subject 时，
按 `role='student'` 自动建号（用户名由 DID 尾段生成，可后续修改）。`DemoAuthVerifier` 为 `false`——未知 subject 一律 401，
避免任意字符串开号。**自动建号永远只给学生角色，不存在通过登录直接拿到高权限的路径。**

**管理员引导**：`BOOTSTRAP_ADMIN_SUBJECTS` 是逗号分隔的 `privy_user_id` 白名单，命中的账号在登录时把
`users.role` 落库为 `admin`。`BOOTSTRAP_ADMIN_WALLETS` 是逗号分隔的钱包白名单，但只有后端验证
`privy-id-token` 后得到的钱包地址才会生效，不能用普通请求头伪造。前端需在 Privy Dashboard 的
`User management > Authentication > Advanced` 打开 `Return user data in an identity token`。
白名单只在服务端 env 生效，请求头/请求体里的角色声明依旧无法影响角色。

**钱包角色映射**：`WALLET_ROLE_MAPPINGS` 使用 `address=role` 形式配置多个映射，例如
`0x...=teacher,0x...=merchant`。映射仅对后端验证过的 Privy identity token 钱包生效；未映射钱包首次登录仍为
`student`。映射角色是测试/运营白名单，会覆盖该钱包登录账号的数据库角色，因此教师和商户若采用此方式将跳过申请审核。

前端用 `x-active-wallet` 表明当前实际连接的钱包，后端只会在该地址同时存在于签名有效的 `privy-id-token.linked_accounts`
时采用它；单独伪造该请求头会得到 401。切换已验证钱包后会同步 `users.primary_wallet` 与映射角色；从已映射钱包切到普通钱包时
回到 `student`，避免同一 Privy subject 残留管理员权限。钱包映射的教师/商家可按钱包地址复用预置的已审核创作者资料。

**角色一律以数据库 `users.role` 为准，绝不信任请求体或请求头里的角色声明。**
未登录 401 `UNAUTHENTICATED`；已登录但角色不足 403 `FORBIDDEN`。

## 错误响应

统一形状 `{ "error": "CODE", "message": "可读说明" }`。

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | 参数校验失败（zod 第一条 issue 拼进 message），以及框架层 4xx（JSON 解析失败、载荷过大等） |
| 401 | `UNAUTHENTICATED` | 缺少 token / token 无效 / subject 在库里没有对应用户 |
| 403 | `FORBIDDEN` | 角色不足，或教师/商家身份未通过审核 |
| 404 | `NOT_FOUND` | 资源不存在、对当前用户不可见，或路由不存在 |
| 409 | `INVALID_STATE_TRANSITION` | 状态机不允许的流转，以及唯一约束冲突 |
| 500 | `INTERNAL_SERVER_ERROR` | 未预期的服务端异常 |

409 的 message 区分三种冲突来源（`apps/api/src/repositories/errors.ts`）：

| 冲突 | message |
| --- | --- |
| 同一用户同一 role 重复申请 | 你已提交过该角色的申请 |
| 钱包已被别人的同 role 申请占用 | 该钱包已被其他申请占用 |
| 课程 slug 重复 | 该课程 slug 已被占用 |

**既有偏离（公开课程端点）**：`GET /api/courses/:slug` 的错误体只有 `{ "error": ... }`，没有 `message`，
code 为 `COURSE_NOT_FOUND`（404）与 `INVALID_COURSE_SLUG`（400），不在上表内。这是 v0.1 就有的形状，
基线测试 `apps/api/test/app.test.ts` 断言了它，本轮未改。

## 端点

### 身份

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/me` | 已登录 | 返回当前用户与角色 |

`GET /api/me` → `{ data: { id, username, avatarUrl, primaryWallet, role, creator } }`
其中 `role` ∈ `student` \| `teacher` \| `merchant` \| `admin`；
`creator` 通常为当前用户最近一条创作者申请；钱包映射的教师/商家会优先返回同钱包的已审核创作者资料（无则 `null`）：
`{ id, role, displayName, walletAddress, reviewStatus, rejectionReason, reviewedAt }`。
审核人 `reviewedBy`、`verifiedAt`、`userId` 属内部字段，不下发。

### 创作者申请

| 方法 | 路径 | 权限 | 成功码 | 说明 |
| --- | --- | --- | --- | --- |
| POST | `/api/creators/applications` | student | 201 | 申请成为 teacher 或 merchant |
| GET | `/api/creators/applications/mine` | 已登录 | 200 | 查看自己最近一条申请，没有则 `{ data: null }` |

`POST` body：`{ role: "teacher" \| "merchant", displayName: string(1..80), walletAddress: /^0x[0-9a-fA-F]{40}$/ }`
响应体与 `/api/me` 的 `creator` 同形。

- 同一用户同一 role 已有 `pending` 或 `approved` 申请 → 409「你已提交过该角色的申请」。
- 该 role 下钱包已被别的申请占用 → 409「该钱包已被其他申请占用」。
- 已 `rejected` 允许重新提交，复用同一行并重置为 `pending`，清空 `rejection_reason`。

### 管理员：教师/商家审核

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/creators?status=pending` | admin | 待审列表，`status` 可选 pending/approved/rejected，默认 pending |
| POST | `/api/admin/creators/:id/approve` | admin | 通过 |
| POST | `/api/admin/creators/:id/reject` | admin | 驳回，body `{ reason: string(1..500) }` |

三个端点的 `:id` 必须是 uuid，否则 400；申请不存在 404。
列表与审核结果的单项比 `/api/me` 的 `creator` 多两个字段：

```
{ ...creatorView, createdAt, applicant: { id, username, role, primaryWallet } | null }
```

`applicant` 为 `null` 只出现在 001 时代遗留的、没有 `user_id` 的存量行上。

通过后：`review_status='approved'`、写 `verified_at`/`reviewed_by`/`reviewed_at`，
并在同一事务内把申请人的 `users.role` 升为该 `creators.role`（`role <> 'admin'` 兜底，admin 不被降级）。
驳回后：`review_status='rejected'`、必填 `rejection_reason`，`users.role` 不变。
非 `pending` 状态再次审核 → 409。

### 管理员：课程上架审核

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/admin/courses?status=review` | admin | 默认 `review`，可选 draft/review/published/archived |
| POST | `/api/admin/courses/:id/publish` | admin | 上架 |
| POST | `/api/admin/courses/:id/reject` | admin | 驳回，body `{ reason: string(1..500) }` |

课程视图为 `ManagedCourse`：公开课程字段（`id`/`slug`/`title`/`summary`/`category`/`level`/`priceYD`/
`lessonCount`/`coverTone`/`status`/`courseUrl` 等）之外，附带 `teacherId`、`submittedAt`、`reviewedAt`、
`rejectionReason`、`publishedAt`、`createdAt`。

上架：`status='published'`，写 `reviewed_by`/`reviewed_at`/`published_at`（002 的 CHECK 约束要求三者齐全）。
仅允许从 `review` 上架，其它状态 → 409。
驳回：退回 `draft` 并写 `rejection_reason`，仅允许从 `review` 驳回。
`:id` 非 uuid → 400，课程不存在 → 404。

### 教师：我的课程

| 方法 | 路径 | 权限 | 成功码 | 说明 |
| --- | --- | --- | --- | --- |
| GET | `/api/teacher/merchants` | 已审核通过的 teacher | 200 | 可选的已审核商家列表 |
| GET | `/api/teacher/courses` | 已审核通过的 teacher | 200 | 自己的全部课程（含未上架） |
| POST | `/api/teacher/courses` | 已审核通过的 teacher | 201 | 建草稿 |
| POST | `/api/teacher/courses/:id/submit` | 课程所属 teacher | 200 | 提交审核 |

`POST /api/teacher/courses` body：

| 字段 | 约束 |
| --- | --- |
| `merchantId` | UUID，且必须指向 `review_status='approved'` 的 merchant 创作者资料 |
| `slug` | 1..120，`/^[a-z0-9-]+$/` |
| `title` | 1..160 |
| `summary` | 1..500 |
| `category` | 1..60 |
| `level` | `入门` \| `进阶` \| `高级` |
| `priceYD` | 字符串正整数 `/^[1-9][0-9]{0,29}$/`（对应 `numeric(78,0)` 且 `> 0`，不接受小数） |
| `coverTone?` | `violet` \| `blue` \| `teal` |
| `courseUrl?` | `http(s)://` 开头，≤2000 |
| `providerName?` | 1..60 |
| `sections?` | ≤200 项，每项 `{ title(1..160), originalTitle?(1..160), durationSeconds?(0..86400) }`；不接受章节视频或外链字段 |

创建后 `status='draft'`，教师归属为当前用户已通过审核的 `creators.id`，20% 分账方为所选已审核商家；无效商家 → 400，`slug` 重复 → 409。
提交审核：仅允许 `draft` → `review`，写 `submitted_at`，清空上轮 `rejection_reason`；其它状态 → 409。
提交别人的课程或不存在的课程 → 404（不泄露存在性），`:id` 非 uuid → 400。

**未通过审核的教师调用以上任一端点 → 403「教师身份尚未通过审核」**（先判资质，再校验参数）。

### 商家：分账课程

| 方法 | 路径 | 权限 | 成功码 | 说明 |
| --- | --- | --- | --- | --- |
| GET | `/api/merchant/courses` | 已审核通过的 merchant | 200 | 返回 `merchant_id` 为当前商家的全部课程 |

返回 `ManagedCourse[]`，只读且不允许指定其他商家 ID。角色不为 `merchant` 或资质未通过均返回 403。
链上可提取收益不经过此 API，前端直接读取 `CourseMarket.pendingWithdrawals(currentWallet)`；提取时由当前钱包签名调用
`CourseMarket.withdraw()`。

### 公开课程（既有，不变）

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/courses` | 公开 | 只返回 `published` |
| GET | `/api/courses/:slug` | 公开 | 只返回 `published`，含 sections |

### 学习进度

课程小节不再承载视频或外部链接，**学员点击「完成本节」即视为学完该节**，进度落库。

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/learning/courses/:slug/progress` | student / teacher / merchant | 我在该课程的进度 |
| POST | `/api/learning/courses/:slug/sections/:sectionId/complete` | student / teacher / merchant | 标记完成，幂等 |
| DELETE | `/api/learning/courses/:slug/sections/:sectionId/complete` | student / teacher / merchant | 取消完成，幂等 |

三者响应同形 `CourseProgress`：

```
{
  courseId, slug,
  totalSections: number,
  completedSectionIds: string[],
  completedCount: number,
  percent: number,          // 向下取整的百分比，0..100
  completed: boolean,       // percent === 100 且 totalSections > 0
  completedAt: string|null  // 首次达到 100% 的时间，回退后不清空
}
```

- 只对 `status='published'` 的课程开放，其它一律 404 `NOT_FOUND`。
- `sectionId` 必须属于该课程，否则 404；非 uuid → 400。
- 完成写入 `lesson_progress(user_id, section_id, completed_at)`，主键冲突时更新，保证幂等。
- `totalSections = 0` 的课程 `percent` 记 0、`completed` 为 false，避免空课程被判定完成。
- 达到 100% 后，后端用独立发证钱包调用 `CourseCertificate.mintCertificate` 铸造不可转让证书。发证前先读链上 `certificateOf` 跳过已发的，失败由定时扫描重试，重复触发不会重复铸造。

### 小节字段变更（v0.3）

`CourseSection` 移除 `url`：不再有视频地址或原课程外链。保留 `title`、`originalTitle`、`durationSeconds`
（`durationSeconds` 语义改为「预计学习时长」，与视频无关）。
`POST /api/teacher/courses` 的 `sections[]` 同步移除 `url` 字段，传了会被 zod 拒绝。

课程级的 `courseUrl`、`providerName`、`teacherXUrl` / `teacherXHandle` / `providerXUrl` 继续保留，用于展示课程来源与讲师/平台信息。
只有章节级的视频/原课程外链被移除；学生在平台内点击“完成本节”即可记录该章节学习完成。
`POST /api/teacher/courses` 的 `courseUrl` 仍可作为课程来源链接传入，`sections[]` 不再接受 `url` 字段。
