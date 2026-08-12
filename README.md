# YD University

YD University 是一个“中心化教务系统 + 链上支付与证书”的学习型全栈 DApp。
课程、视频、评论和进度保存在 PostgreSQL；YD 支付、购买凭证、自动分账和不可转让证书由 Ethereum Sepolia 合约负责。

## 当前可运行范围

- `contracts/`：YD ERC20、课程注册、购买/分账、不可转让证书、CRE 完成报告接收器；Ignition 部署模块已把
  管理员与平台收款地址提为参数，Sepolia 参数写在 `contracts/ignition/parameters.sepolia.json`。
- `apps/api/`：Fastify API，默认使用内置演示数据；也可切换 PostgreSQL。
  - 公开课程：`GET /api/courses`、`GET /api/courses/:slug`，只暴露 `status = 'published'` 的课程，
    未上架课程访问详情返回 404 `COURSE_NOT_FOUND`。
  - 审核流已打通：`/api/me`、创作者申请、管理员审核教师/商家、管理员课程上架、教师建课与提交审核，
    端点清单见 `docs/api-contract.md`。角色只认数据库 `users.role`，请求头/请求体里的角色声明一律忽略。
  - 认证可插拔：`AUTH_MODE=demo`（默认）用 `demo:<privy_user_id>` 令牌本地联调；`AUTH_MODE=privy`
    校验真实 Privy 访问令牌（ES256，公钥取自该 App 的 JWKS），只需要 `PRIVY_APP_ID`。按钱包引导管理员时，
    还需在 Privy 控制台开启 identity token，并在 API 的 `BOOTSTRAP_ADMIN_WALLETS` 配置公开钱包地址。
- `apps/web/`：按 Stitch 设计系统实现的 React 页面，包含首页、课程购买、学习页和个人中心；
  课程详情与学习页渲染真实小节并外链原课程。
  **`/admin` 管理员工作台与 `/creator` 创作者中心已是接真实接口的页面，不再是占位。**
  管理后台入口只对 `role = admin` 显示，页面内部再判一次权限；创作者中心覆盖申请、待审、驳回重提、
  教师建草稿与提交审核。
- `apps/api/migrations/`：`001_initial.sql` 建基线表，`002_review_workflow.sql` 增加角色枚举与教师/课程审核字段，
  `003_creator_identity.sql` 给 `creators` 加 `user_id` 与「同一用户同一 role 只留一条申请」的部分唯一索引。
- `docs/`：冻结需求（v0.2）与架构边界。

### 登录方式

由 Privy 承载，四种方式全部开启：**邮箱 / Google / GitHub / 钱包**（`apps/web/src/auth/AuthContext.tsx` 的
`loginMethods: ["email", "google", "github", "wallet"]`）。Privy 控制台的 Login methods → Socials 还必须分别启用 Google 与 GitHub，否则会返回 `disallowed_login_method`。未配置 `VITE_PRIVY_APP_ID` 时前端自动回退到本地演示登录，
不依赖外部服务也能跑通页面。

### 角色与审核规则

- 四个角色：**学生 / 教师 / 商家 / 管理员**，注册后默认是学生。
- **教师需要管理员审核通过后才能开课。**
- **课程需要管理员审核上架后才对外可见，也才允许上链 `createCourse`。**
- 完整流转图见 `docs/requirements.md` 的「角色与审核流」。

## 第一次启动

```bash
npm install
npm test
npm run typecheck
npm run build
```

启动演示 API（无需数据库）：

```bash
npm run dev:api
```

另开一个终端启动前端：

```bash
npm run dev:web
```

浏览器访问 `http://localhost:5173`。API 默认运行在 `http://localhost:3001`。

## 本地跑通审核流

默认配置（`AUTH_MODE=demo` + `COURSE_DATA_SOURCE=mock`）不需要数据库，内存里预置了四个演示账号。
**用 PostgreSQL 时先把 `003_creator_identity.sql` 执行掉**，见下一节。

### demo token

令牌形如 `demo:<privy_user_id>`，后端 `DemoAuthVerifier` 只取冒号后面那段当 `users.privy_user_id`，不校验签名，
**仅限本地**。mock 模式预置的四个账号（`apps/api/src/repositories/mock-data.ts`）：

| 身份 | Authorization 头 | `users.role` | 创作者申请 |
| --- | --- | --- | --- |
| 学生 | `Bearer demo:demo-student` | `student` | 无 |
| 教师 | `Bearer demo:demo-teacher` | `teacher` | teacher，已通过，持有 3 门演示课程 |
| 商家 | `Bearer demo:demo-merchant` | `merchant` | merchant，已通过 |
| 管理员 | `Bearer demo:demo-admin` | `admin` | 无 |

### curl 走一遍：学生 → 教师 → 建课 → 上架

```bash
API=http://localhost:3001

# 1. 学生看自己的身份：role=student，creator=null
curl -s $API/api/me -H "Authorization: Bearer demo:demo-student"

# 2. 学生申请成为教师（201）
curl -s -X POST $API/api/creators/applications \
  -H "Authorization: Bearer demo:demo-student" \
  -H "Content-Type: application/json" \
  -d '{"role":"teacher","displayName":"张老师","walletAddress":"0x1111111111111111111111111111111111111111"}'

# 3. 管理员看待审列表，取出申请 id
CID=$(curl -s "$API/api/admin/creators?status=pending" \
  -H "Authorization: Bearer demo:demo-admin" | jq -r '.data[0].id')

# 4. 管理员通过（也可以 /reject 并带 {"reason":"资料不全"}，驳回后学生可用同一接口重新提交）
curl -s -X POST $API/api/admin/creators/$CID/approve -H "Authorization: Bearer demo:demo-admin"

# 5. 再看学生身份：role 已升为 teacher
curl -s $API/api/me -H "Authorization: Bearer demo:demo-student" | jq '.data.role'

# 6. 该教师建课草稿（priceYD 必须是大于 0 的整数字符串）
COURSE=$(curl -s -X POST $API/api/teacher/courses \
  -H "Authorization: Bearer demo:demo-student" \
  -H "Content-Type: application/json" \
  -d '{"slug":"my-first-course","title":"我的第一门课","summary":"演示课程","category":"Solidity","level":"入门","priceYD":"4"}' \
  | jq -r '.data.id')

# 7. 提交审核：draft -> review
curl -s -X POST $API/api/teacher/courses/$COURSE/submit -H "Authorization: Bearer demo:demo-student"

# 8. 管理员看待上架队列并上架
curl -s "$API/api/admin/courses?status=review" -H "Authorization: Bearer demo:demo-admin"
curl -s -X POST $API/api/admin/courses/$COURSE/publish -H "Authorization: Bearer demo:demo-admin"

# 9. 公开列表里出现这门课
curl -s $API/api/courses | jq '.data[].slug'
```

几条可以顺手验证的边界：

```bash
# 不带 token：401 UNAUTHENTICATED
curl -s $API/api/me
# 非管理员打管理端：403 FORBIDDEN
curl -s $API/api/admin/creators -H "Authorization: Bearer demo:demo-merchant"
# 同一用户同一 role 重复申请：409「你已提交过该角色的申请」
```

mock 模式的数据只在进程内存里，重启 API 即回到初始状态。

### 页面上走一遍

前端未配置 `VITE_PRIVY_APP_ID`（或仍是 `<...>` 占位符）时自动进入演示登录，
顶栏钱包区会出现「演示模式」身份下拉，选项来自 `VITE_DEMO_USER_IDS`（默认
`demo-student,demo-teacher,demo-merchant,demo-admin`），切换即换 `demo:<id>` 令牌重新拉 `/api/me`。

1. 选 **demo-student** → 顶栏点「创作者中心」（`/creator`）→ 填申请身份、显示名、收款钱包 → 提交，页面转为待审状态。
2. 切到 **demo-admin** → 顶栏出现「管理后台」（`/admin`）→「待审教师 / 商家」标签页 → 点「通过」；
   点「驳回」会展开理由输入框，理由必填。
3. 切回 **demo-student** → 创作者中心已变成教师工作台 → 「新建课程草稿」填 slug / 标题 / 简介 / 分类 / 难度 /
   价格（大于 0 的整数）→ 保存后在「我的课程」里对该草稿点「提交审核」。
4. 切到 **demo-admin** →「待上架课程」标签页 → 点「上架」。
5. 回首页，这门课出现在课程列表里。

`/admin` 不是靠隐藏导航来限权：直接敲 URL 进去，页面自身会判 `role !== "admin"` 并拦下，后端 `requireRole("admin")` 还有一道 403。

## PostgreSQL 模式

1. 复制根目录 `.env.example` 为 `.env`，只在本地填入密码。
2. 启动数据库：`docker compose up -d postgres`。
3. 按顺序执行三个 migration（002、003 可重复执行）：

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/001_initial.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/002_review_workflow.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/003_creator_identity.sql
   ```

   **003 必须执行**，否则 `creators` 没有 `user_id`，创作者申请与 `/api/me` 的申请回显都跑不起来。
4. 在 `apps/api/.env` 设置 `COURSE_DATA_SOURCE=postgres` 和 `DATABASE_URL`。
5. migration 不带任何种子数据。postgres 模式下 `demo:<privy_user_id>` 令牌要能用，
   得先自己在 `users` 里插行（`privy_user_id` 就是令牌冒号后面那段），管理员再手动把 `role` 改成 `admin`。

## Sepolia 部署

### 1. 配置凭证

仓库不含任何私钥。部署前在本地私有 `.env`（或 Hardhat keystore）中配置：

- `SEPOLIA_RPC_URL`
- `SEPOLIA_PRIVATE_KEY`
- `ETHERSCAN_API_KEY`

`.env.example` 里全是尖括号占位符，不要把真实值提交上去。

### 2. 核对部署参数

`contracts/ignition/parameters.sepolia.json` 里是公开的 Sepolia 地址，可直接查看和修改：

| 参数 | 地址 | 用途 |
| --- | --- | --- |
| `admin` | `0x934124d582dd6618309b0905b4DE2631A2892EEe` | 管理员，各合约 AccessControl 的 admin |
| `platformTreasury` | `0x934124d582dd6618309b0905b4DE2631A2892EEe` | 平台收款（与管理员同一地址） |
| `creForwarder` | `0x934124d582dd6618309b0905b4DE2631A2892EEe` | Chainlink CRE forwarder；未接入 CRE 前临时指向管理员，之后用 `setForwarder` 替换 |
| `defaultTeacher` | `0xe1E5016aF35DfD90ccb6Bc03654D156b3f29764D` | 演示教师钱包，当前只供后续建课脚本取用 |
| `defaultMerchant` | `0x283A754de403b0Ee48560964f9f7C21491916499` | 演示商家钱包，同上 |

`YDUniversity.ts` 消费 `admin`、`platformTreasury` 与 `creForwarder`。本地部署不传参数时默认使用 Hardhat
本地默认签名人做 admin/platform/forwarder；Sepolia 部署必须使用参数文件，并保证 `SEPOLIA_PRIVATE_KEY`
对应的钱包就是 `admin`，否则
`CourseCertificate.grantRole` 授权交易无法由 admin 签名。模块会部署
`YDToken`、`CourseRegistry`、`CourseMarket`、`CourseCertificate`、`CompletionReceiver`，
并把 `CourseCertificate.MINTER_ROLE` 授给 `CompletionReceiver`。

### 3. 部署

```bash
# 本地网络，使用模块内默认地址
npm run deploy:local -w @yd/contracts

# Sepolia，必须手动追加参数文件
npm run deploy:sepolia -w @yd/contracts
```

如果要部署后顺手在 Etherscan 验证，可在 `contracts/` 目录跑：

```bash
npx hardhat ignition deploy --network sepolia \
  --parameters ignition/parameters.sepolia.json \
  --verify \
  ignition/modules/YDUniversity.ts
```

### 4. 回填前端地址

部署完成后把合约地址写入前端 `.env`（当前 Sepolia 示例值已写入 `apps/web/.env.example`）：
`VITE_CHAIN_ID=11155111`、`VITE_YD_TOKEN_ADDRESS`、`VITE_COURSE_REGISTRY_ADDRESS`、
`VITE_COURSE_MARKET_ADDRESS`、`VITE_COURSE_CERTIFICATE_ADDRESS`。`CompletionReceiver`
地址供后端/CRE 配置使用。不要提交任何真实凭证。

### 5. 链上验收脚本

部署后可以按顺序跑三条 Sepolia smoke test 命令：

```bash
npm run chain:verify -w @yd/contracts
npm run chain:create-course -w @yd/contracts
npm run chain:smoke -w @yd/contracts
```

默认会创建/复用 metadata 为 `ipfs://yd-university/solidity-from-zero` 的演示课程，价格 `4 YD`，
分账 `70/20/10`。如需覆盖，可在命令前追加：
`COURSE_METADATA_URI=... COURSE_PRICE_YD=... COURSE_TEACHER_ADDRESS=... COURSE_MERCHANT_ADDRESS=...`。

## 课程来源

三门演示课程的正文来源于公开免费平台 **Cyfrin Updraft**（<https://updraft.cyfrin.io>），课程级来源链接会保留在课程信息中；章节不提供视频跳转，学生在平台内点击完成即可记录学习进度：

- Solidity 智能合约开发从入门到实战 —— Patrick Collins，15 节，<https://updraft.cyfrin.io/courses/solidity>
- DeFi 核心原理与协议拆解（Uniswap V2 源码精讲）—— Tasuku Nakamura，14 节，<https://updraft.cyfrin.io/courses/uniswap-v2>
- 智能合约安全：从攻击到防御 —— Patrick Collins，9 节，<https://updraft.cyfrin.io/courses/security>

仓库只保存标题、简介、小节标题与外链，不转存视频或讲义正文，前端点击小节会跳转到原课程页面。
这些**只是演示数据，版权归原作者与 Cyfrin Updraft 所有**；课程价格、评分、学习人数为演示用虚构值，原课程本身免费。
详见 `docs/requirements.md` 的「课程内容来源」。

## 切换到真实 Privy 登录

令牌校验走 Privy 的公开 JWKS，**只需要 App ID，不需要 App Secret**。前后端必须同时切换，
否则前端发真实 JWT 而后端只认 `demo:` 前缀，会全站 401。

1. `apps/web/.env`（私有，已在 `.gitignore` 内）：

   ```bash
   VITE_PRIVY_APP_ID=<你的 App ID>
   ```

2. `apps/api/.env`：

   ```bash
   AUTH_MODE=privy
   PRIVY_APP_ID=<同一个 App ID>
   ```

3. 首次登录会按 `role='student'` 自动建号（用户名由 Privy DID 尾段生成）。
   要拿到管理员，把 `GET /api/me` 返回里的 `did:privy:xxx` 填进 `apps/api/.env` 再重启：

   ```bash
   BOOTSTRAP_ADMIN_SUBJECTS=did:privy:xxx
   ```

   白名单只在服务端生效，命中后会把 `users.role` 落库为 `admin`；请求头与请求体依旧无法影响角色。

4. mock 模式的数据不持久化，重启即回到初始状态。要让账号和审核结果留存，
   同时设 `COURSE_DATA_SOURCE=postgres` 并执行 `001`~`003` 三个 migration。

> 真实 App ID、私钥、数据库口令一律只放本地 `.env`，不要写进 `.env.example`、文档或提交信息。

## 学习顺序

1. 先读 `docs/requirements.md`，理解冻结规则、审核流和哪些数据上链。
2. 运行合约测试，观察 `approve -> buy -> pendingWithdrawals`。
3. 启动 API，访问 `/health`、`/api/courses` 与 `/api/courses/solidity-from-zero`。
4. 启动前端，跑一遍「本地跑通审核流」，再体验课程详情中的两步购买状态机。
5. 最后再部署 Sepolia、接 Privy、Uniswap 和 Chainlink CRE。
