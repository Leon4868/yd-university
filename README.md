# YD University

YD University 是一个“中心化教务系统 + 链上支付与证书”的学习型全栈 DApp。
课程、视频、评论和进度保存在 PostgreSQL；YD 支付、购买凭证、自动分账和不可转让证书由 Ethereum Sepolia 合约负责。

## 当前可运行范围

- `contracts/`：YD ERC20、课程注册、购买/分账、不可转让证书、CRE 完成报告接收器；Ignition 部署模块已把
  管理员与平台收款地址提为参数，Sepolia 参数写在 `contracts/ignition/parameters.sepolia.json`。
- `apps/api/`：Fastify API，默认使用内置演示课程；也可切换 PostgreSQL。
  `GET /api/courses` 返回已上架课程列表，`GET /api/courses/:slug` 返回含小节的课程详情，
  两者都只暴露 `status = 'published'` 的课程，未上架课程访问详情返回 404 `COURSE_NOT_FOUND`。
- `apps/web/`：按 Stitch 设计系统实现的 React 页面，包含首页、课程购买、学习页、管理员审核工作台和个人中心；
  课程详情与学习页渲染真实小节并外链原课程。
- `apps/api/migrations/`：`001_initial.sql` 建基线表，`002_review_workflow.sql` 增加角色枚举与教师/课程审核字段。
- `docs/`：冻结需求（v0.2）与架构边界。

### 登录方式

由 Privy 承载，四种方式全部开启：**邮箱 / Google / GitHub / 钱包**（`apps/web/src/auth/AuthContext.tsx` 的
`loginMethods: ["email", "google", "github", "wallet"]`）。未配置 `VITE_PRIVY_APP_ID` 时前端自动回退到本地演示登录，
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

## PostgreSQL 模式

1. 复制根目录 `.env.example` 为 `.env`，只在本地填入密码。
2. 启动数据库：`docker compose up -d postgres`。
3. 按顺序执行 `apps/api/migrations/001_initial.sql`、`apps/api/migrations/002_review_workflow.sql`（002 可重复执行）。
4. 在 `apps/api/.env` 设置 `COURSE_DATA_SOURCE=postgres` 和 `DATABASE_URL`。

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
| `defaultTeacher` | `0xe1E5016aF35DfD90ccb6Bc03654D156b3f29764D` | 演示教师钱包，当前只供后续建课脚本取用 |
| `defaultMerchant` | `0x283A754de403b0Ee48560964f9f7C21491916499` | 演示商家钱包，同上 |

`YDUniversity.ts` 只消费 `admin` 与 `platformTreasury`，且两者已带默认值，因此本地部署不传参数文件也能跑。

### 3. 部署

```bash
# 本地网络，使用模块内默认地址
npm run deploy:local -w @yd/contracts

# Sepolia，必须手动追加参数文件
npx hardhat ignition deploy --network sepolia \
  ignition/modules/YDUniversity.ts \
  --parameters ignition/parameters.sepolia.json
```

`contracts/package.json` 的 `deploy:sepolia` 脚本暂未内置 `--parameters`，跑 Sepolia 时请按上面的完整命令追加，
否则会用模块默认地址部署。

### 4. 回填前端地址

部署完成后把四个合约地址写入前端私有 `.env`（占位符见 `apps/web/.env.example`）：
`VITE_CHAIN_ID=11155111`、`VITE_YD_TOKEN_ADDRESS`、`VITE_COURSE_REGISTRY_ADDRESS`、
`VITE_COURSE_MARKET_ADDRESS`、`VITE_COURSE_CERTIFICATE_ADDRESS`。不要提交任何真实凭证。

## 课程来源

三门演示课程的正文来自公开免费平台 **Cyfrin Updraft**（<https://updraft.cyfrin.io>）：

- Solidity 智能合约开发从入门到实战 —— Patrick Collins，15 节，<https://updraft.cyfrin.io/courses/solidity>
- DeFi 核心原理与协议拆解（Uniswap V2 源码精讲）—— Tasuku Nakamura，14 节，<https://updraft.cyfrin.io/courses/uniswap-v2>
- 智能合约安全：从攻击到防御 —— Patrick Collins，9 节，<https://updraft.cyfrin.io/courses/security>

仓库只保存标题、简介、小节标题与外链，不转存视频或讲义正文，前端点击小节会跳转到原课程页面。
这些**只是演示数据，版权归原作者与 Cyfrin Updraft 所有**；课程价格、评分、学习人数为演示用虚构值，原课程本身免费。
详见 `docs/requirements.md` 的「课程内容来源」。

## 学习顺序

1. 先读 `docs/requirements.md`，理解冻结规则、审核流和哪些数据上链。
2. 运行合约测试，观察 `approve -> buy -> pendingWithdrawals`。
3. 启动 API，访问 `/health`、`/api/courses` 与 `/api/courses/solidity-from-zero`。
4. 启动前端，体验课程详情中的两步购买状态机，以及管理员工作台的审核入口。
5. 最后再部署 Sepolia、接 Privy、Uniswap 和 Chainlink CRE。
