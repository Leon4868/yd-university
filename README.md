# YD University

YD University 是一个“中心化教务系统 + 链上支付与证书”的学习型全栈 DApp。
课程、视频、评论和进度保存在 PostgreSQL；YD 支付、购买凭证、自动分账和不可转让证书由 Ethereum Sepolia 合约负责。

## 当前可运行范围

- `contracts/`：YD ERC20、课程注册、购买/分账、不可转让证书、CRE 完成报告接收器。
- `apps/api/`：Fastify API，默认使用内置演示课程；也可切换 PostgreSQL。
- `apps/web/`：按 Stitch 设计系统实现的 React 页面，包含首页、课程购买、学习页和个人中心。
- `docs/`：冻结需求与架构边界。

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
3. 执行 `apps/api/migrations/001_initial.sql`。
4. 在 `apps/api/.env` 设置 `COURSE_DATA_SOURCE=postgres` 和 `DATABASE_URL`。

## Sepolia 部署前仍需配置

合约不会读取仓库内的私钥。部署前在本地 Hardhat keystore 或环境变量中配置：

- `SEPOLIA_RPC_URL`
- `SEPOLIA_PRIVATE_KEY`
- `ETHERSCAN_API_KEY`

合约地址部署后再写入前端私有 `.env`。不要提交任何真实凭证。

## 学习顺序

1. 先读 `docs/requirements.md`，理解哪些数据上链。
2. 运行合约测试，观察 `approve -> buy -> pendingWithdrawals`。
3. 启动 API，访问 `/health` 与 `/api/courses`。
4. 启动前端，体验课程详情中的两步购买状态机。
5. 最后再部署 Sepolia、接 Privy、Uniswap 和 Chainlink CRE。
