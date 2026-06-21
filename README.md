# 工业园区碳资产核算系统

基于 Next.js 14 + NestJS + Prisma + PostgreSQL 的全栈碳资产核算平台，覆盖企业填报、核证抽样、配额结转三大核心业务流程。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 (App Router) + React 18 + TypeScript | 前台+管理端一体，Zustand 状态管理，Tailwind CSS |
| 后端 | NestJS 10 + TypeScript | 分层架构，Controller → Service → PrismaService |
| ORM | Prisma 5 | PostgreSQL 表结构管理、类型安全查询 |
| 数据库 | PostgreSQL 14+ | 支持 Decimal 高精度、复合唯一键、事务 |
| 认证 | JWT (@nestjs/jwt) + bcrypt + RBAC | 三角色体系：ENTERPRISE / VERIFIER / ADMIN |

## 项目结构

```
1211/
├── package.json              # npm workspaces 根
├── backend/                  # NestJS API 服务
│   ├── prisma/
│   │   ├── schema.prisma     # 数据模型（16 张表 + 8 个枚举）
│   │   └── seed.ts           # 演示数据种子
│   ├── src/
│   │   ├── auth/             # JWT 认证 + RBAC 权限
│   │   ├── audit-log/        # 不可覆盖审计日志（字段级变更聚合）
│   │   ├── enterprise/       # 企业档案
│   │   ├── energy-consumption/ # 能源消耗填报 + 自动计算排放量
│   │   ├── production-output/  # 产品产量填报
│   │   ├── emission-factor/    # 排放因子管理
│   │   ├── emission-report/    # 月度排放报告 + 提交/状态机
│   │   ├── verification/       # 第三方核证：抽样 → 凭证核查 → 缺失扣减 → 锁定
│   │   └── quota/              # 配额管理：基线锁定 + 跨年度结转
│   ├── .env                    # 环境变量（需配置 DATABASE_URL）
│   └── tsconfig.build.json
└── frontend/                 # Next.js 前端
    └── src/app/
        ├── login/             # 登录页
        ├── enterprise/        # 企业端：填报 / 产量 / 报告 / 配额
        ├── verifier/          # 核证员端：任务列表 / 抽样 / 凭证核查
        └── admin/             # 园区管理员端：企业 / 因子 / 配额 / 结转 / 审计
```

## 环境要求

- **Node.js** ≥ 18.17（Next.js 14 要求）
- **PostgreSQL** ≥ 14（支持 Decimal、复合唯一键）
- **npm** ≥ 9（workspaces 支持）

## 快速启动

### 1. 配置环境变量

编辑 `backend/.env`（已提供示例模板 `.env.example`）：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/carbon_accounting?schema=public"
JWT_SECRET="change-this-to-a-random-secret-key-please-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

### 2. 安装依赖（workspace 根目录）

```bash
cd 1211
npm install
```

安装完成后：
- 前端 `node_modules/.bin/next` 命令可用
- 后端 `node_modules/.bin/nest` 和 `node_modules/.bin/prisma` 命令可用

### 3. 初始化数据库

```bash
# 生成 Prisma Client（生成 TypeScript 类型）
npm run prisma:generate

# 执行数据库迁移（首次会创建所有表）
npm run prisma:migrate -- --name init

# 写入演示数据（3 个用户 + 3 家企业 + 5 个排放因子 + 6 个月填报数据 + 配额）
npm run prisma:seed
```

### 4. 启动开发服务

**终端 A - 后端 API（端口 3001）：**
```bash
npm run dev:backend
```

**终端 B - 前端 Next.js（端口 3000）：**
```bash
npm run dev:frontend
```

访问 http://localhost:3000 即可使用。前端已配置 rewrite，将 `/api/*` 代理到后端 `localhost:3001/api/*`。

### 5. 生产构建

```bash
# 后端构建（输出到 backend/dist/）
npm run build:backend

# 前端构建（输出到 frontend/.next/）
npm run build:frontend
```

## 演示账号

种子数据已预置 3 个账号，密码均为 **`123456`**：

| 用户名 | 角色 | 说明 |
|--------|------|------|
| `admin` | ADMIN（园区管理员） | 企业管理、因子配置、配额分配、结转操作、审计日志 |
| `verifier` | VERIFIER（第三方核证员） | 核证任务列表、凭证抽样、缺失扣减、完成核证 |
| `enterprise` | ENTERPRISE（企业填报员） | 华东钢铁制造有限公司，能源/产量填报、报告提交、配额查看 |

## 五大主流程演示指南

### 流程 1：企业填报（能源消耗 + 产量 + 报告提交）

**登录账号：** `enterprise` / `123456`

1. 进入 **能源消耗填报** (`/enterprise/energy`)
   - 选择年份和月份（建议 2024 年 6 月，尚未提交）
   - 点击「+ 新增记录」，选择能源类型（如 COAL 煤炭）
   - 输入消耗量（如 1500 吨），填写凭证号（发票号）
   - 保存后系统自动计算排放量 = 消耗量 × 排放因子
   - 可在页面看到排放因子参考值和预估排放量

2. 进入 **产量填报** (`/enterprise/output`)
   - 同一月份新增产品（如「热轧钢板」50000 吨）

3. 回到能源消耗页面，点击 **「提交报告」**
   - 月度排放报告状态从 `DRAFT` → `SUBMITTED`
   - verificationStatus 进入 `PENDING`，等待核证员接单

---

### 流程 2：核证抽样（第三方核证员抽取凭证）

**登录账号：** `verifier` / `123456`

1. 进入 **核证任务列表** (`/verifier/tasks`)
   - 系统自动为所有 `SUBMITTED` 状态的报告生成待核证任务
   - 点击某条任务（如华东钢铁 2024 年 4 月，状态 PENDING）

2. 在任务详情页（`/verifier/tasks/[taskId]`）
   - 页面显示：填报排放量、已核证调整、缺失凭证数、预计最终核证量
   - 点击 **「开始抽样」**（可填入随机种子以复现抽样结果）
   - 系统使用 **Mulberry32 确定性伪随机算法** 从该月份能源消耗记录中抽取 N 个凭证样本
   - 抽样结果展示为表格，包含凭证号、能源类型、申报值、实际值编辑框

---

### 流程 3：缺失凭证扣减（关键凭证缺失 → 排放量从核证结果扣除）

承接上一步抽样结果：

1. 在抽样凭证表格中，对每条样本：
   - 录入 **实际值**（与申报值有差异时，可点击「+ 调整」创建核证调整记录）
   - 选择 **关键凭证** 状态：「完整」或「缺失凭证」

2. 若将某条标记为「**缺失凭证**」：
   - 该行高亮为红色背景
   - 页面底部出现警告条：⚠ 存在缺失关键凭证的记录，对应排放量将按 `排放因子 × 申报值` 计算后从核证总量中扣除

3. 点击 **「✓ 完成核证并锁定报告」**
   - 系统后端 `verification.service.ts → completeTask()` 执行：
     1. 汇总所有 `isComplete=false` 的缺失凭证排放量之和（`incompleteEmissionDeduction`）
     2. `verifiedEmission = totalEmission + adjustments - incompleteEmissionDeduction`
     3. 级联锁定：`EnergyConsumption.isLocked = true`、`ProductionOutput.isLocked = true`、`EmissionReport.isLocked = true`
     4. 写入审计日志（VERIFY 动作 + 所有字段变更）
   - 确认后报告状态变为 `VERIFIED`

---

### 流程 4：核证后锁定月份（企业端无法再修改）

**登录账号：** `enterprise` / `123456`

1. 回到能源消耗填报页面，选择一个已通过核证的月份（如 2024 年 1-3 月，种子数据预置为已锁定）
2. 页面顶部显示 **🔒 黄色锁定提示条**：「该月数据已通过核证并锁定，企业端无法修改」
3. 「+ 新增记录」、每行「编辑」「删除」按钮均被 `disabled`
4. 产量填报页面对已锁定月份同样禁用所有编辑操作
5. 后端服务层 `checkMonthLocked()` 作为**最终防线**，即使绕过前端直接发 API 也会抛出 `BadRequestException`

---

### 流程 5：上一年度基线锁定 → 跨年度配额结转

**登录账号：** `admin` / `123456`

进入 **基线锁定与跨年度结转** (`/admin/carryover`)，包含两个 Tab：

#### Tab 1：🔒 基线锁定

1. 选择 **上一年度**（如 2024 年）
2. 表格列出所有企业：
   - 「2024 年度核证排放总量」列：若全年 12 个月均为 VERIFIED 则显示数值，否则显示「— 数据不完整」
   - 「基线状态」列：未生成 / 待锁定 / 🔒 已锁定
3. 对数据完整的企业点击 **「锁定基线」**
   - 后端 `carry-over.service.ts → lockBaseline()` 首先校验全年 12 个月报告 `verificationStatus = VERIFIED`
   - 校验失败则报错「尚有 X 个月排放报告未通过核证」
   - 校验通过则写入 `Baseline` 表并标记 `isLocked = true`，同时锁定配额表

#### Tab 2：🔄 跨年度结转

1. 选择 **源年度**（如 2024）和 **目标年度**（如 2025）
2. 下拉选择某企业
3. 设置 **结转率**（默认 100%，即全部余额结转至下一年度），或填写「自定义金额」
4. 页面实时显示 **结转预览**：
   - 2024 年度余额 / 结转率 / 预计结转金额
   - **基线状态**：✅ 已锁定（可结转）或 ❌ 未锁定（需先锁定基线）
5. 若基线未锁定，「执行结转」按钮被禁用，提示「上一年度基线未锁定，无法执行结转」
6. 基线已锁定时点击 **「🔄 执行 2024 → 2025 年度结转」**：
   - 写入 `CarryOverRecord` 表（复合唯一键 `enterpriseId + fromYear + toYear` 防重复结转）
   - 源年度配额执行 `CARRY_OVER` 扣减操作
   - 目标年度配额执行 `TRANSFER_IN` 转入操作
   - 所有操作写入不可覆盖审计日志

---

## 不可覆盖审计日志

管理员可在 **审计日志** (`/admin/audit`) 查看全系统所有关键操作：

- 支持按操作类型（创建/修改/删除/提交/核证/调整/锁定/结转）、实体类型、操作人、日期范围筛选
- 点击每条记录左侧的 `+` 可展开 **字段级变更详情**：变更前 / 变更后 JSON 对比
- 审计表设计为 **只增不删**，所有服务层操作通过 `AuditLogService.logChanges()` 自动生成差异

## 数据模型速览

16 张核心表：`User`、`Enterprise`、`EnergyConsumption`、`ProductionOutput`、`EmissionFactor`、`EmissionReport`、`VerificationTask`、`VerificationEvidence`、`VerificationAdjustment`、`Baseline`、`Quota`、`QuotaOperation`、`CarryOverRecord`、`AuditLog`

关键复合唯一键：
- `EmissionReport`: `(enterpriseId, year, month)` — 每月一份报告
- `Quota`: `(enterpriseId, year)` — 每年一份配额
- `CarryOverRecord`: `(enterpriseId, fromYear, toYear)` — 防重复结转
- `Baseline`: `(enterpriseId, year)` — 每年一条基线

## 常见问题

**Q: `npm install` 后找不到 `next`/`nest`/`prisma` 命令？**
A: 必须在 workspace 根目录执行 `npm install`，npm workspaces 会自动将依赖提升到根 `node_modules`。不要分别在 backend/ 和 frontend/ 下单独 install。

**Q: Prisma 迁移报错 `role "postgres" does not exist`？**
A: 修改 `backend/.env` 中 DATABASE_URL 的用户名/密码为你本地 PostgreSQL 的实际凭据。

**Q: 前端页面 `/api/*` 请求 404？**
A: 确认后端已启动在 3001 端口，前端 `next.config.js` 的 rewrite 已配置将 `/api/:path*` 代理到 `http://localhost:3001/api/:path*`。
