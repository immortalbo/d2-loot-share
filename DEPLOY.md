# 部署指南

整套东西**全部用 Cloudflare 免费额度**,不需要绑信用卡。

## 一、准备

### 1. 注册 Cloudflare 账号
- 打开 https://dash.cloudflare.com/sign-up
- 邮箱 + 密码,验证邮箱即可。**不需要绑卡。**

### 2. 注册 GitHub 账号(已有可跳过)
- https://github.com/signup

### 3. 装 Node.js(已有可跳过)
推荐用 `nvm`,或直接从 https://nodejs.org/ 下 LTS 版本(>= 18)。

---

## 二、本地跑起来

```bash
cd /Users/Bain/自己做得项目/d2-loot-share
npm install
```

第一次会跳出浏览器要你登录 Cloudflare:

```bash
npx wrangler login
```

### 创建 D1 数据库

```bash
npx wrangler d1 create wow-loot-share-db
```

会打印类似:
```
[[d1_databases]]
binding = "DB"
database_name = "wow-loot-share-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

把 `database_id` 复制到 `wrangler.toml` 里替换。

> 注:数据库/R2 桶名沿用旧的 `wow-loot-share-db` / `wow-loot-images`(改名要数据迁移,没必要)。Worker 名是 `d2-loot-share`。

### 初始化表结构

```bash
npm run db:init           # 远程数据库
npm run db:init:local     # 本地开发数据库
```

### 创建 R2 桶

```bash
npx wrangler r2 bucket create wow-loot-images
```

### 设置本地口令

```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars,把 SHARE_PASSWORD 改成你的口令
```

### 启动开发服务

两个终端:

```bash
# 终端 1
npm run dev:worker

# 终端 2
npm run dev
```

打开 http://localhost:5173。

---

## 三、手动部署到 Cloudflare

```bash
npx wrangler secret put SHARE_PASSWORD   # 输入生产口令
npm run deploy                            # 一键部署
```

部署完输出 `https://d2-loot-share.<你的 subdomain>.workers.dev`。

### (可选)绑自定义域名
Cloudflare Dash → Workers & Pages → 选 Worker → Settings → Domains & Routes → Add Custom Domain。

---

## 四、自动部署:接入 GitHub

有两种方式,**任选其一**。

### 方式 A:Cloudflare Dashboard 接 Git(推荐,零脚本)

适合不想写 CI 的人,推到 GitHub 就自动 build + deploy。

**前提:代码已经推到 GitHub。**

1. 打开 https://dash.cloudflare.com/
2. **Workers & Pages** → 选 `d2-loot-share` Worker
3. **Settings** → **Build** → **Connect**
4. 选 `immortalbo/d2-loot-share` 仓库,允许 Cloudflare 访问
5. 配置 Build:
   - **Branch**: `main`
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy`
   - **Root directory**: `/`
6. **Save**

之后每次 `git push origin main`,Cloudflare 会自动构建并部署。
PR 也会自动创建 preview 环境。

> 注意:secrets(`SHARE_PASSWORD`)不受 Git 部署影响,保持已有的。

### 方式 B:GitHub Actions(更灵活)

仓库里已经有 `.github/workflows/deploy.yml`,只需要给 GitHub 仓库加 2 个 secret:

1. 打开 https://github.com/immortalbo/d2-loot-share/settings/secrets/actions
2. **New repository secret** 加这两个:
   - `CLOUDFLARE_API_TOKEN`:跟 `~/.cloudflare-credentials` 里的同一个 token
   - `CLOUDFLARE_ACCOUNT_ID`:跟 `~/.cloudflare-credentials` 里的同一个 account id

之后每次 `git push origin main` 触发 GitHub Actions,自动:
- 装依赖
- build
- 用 wrangler deploy 推到 Cloudflare

去 GitHub 仓库 **Actions** 标签页能看到部署日志。

---

## 五、常见问题

**Q: 口令忘了怎么改?**
```bash
echo "新口令" | npx wrangler secret put SHARE_PASSWORD
```
立即生效,不用重新部署。

**Q: 想清空所有数据?**
```bash
npx wrangler d1 execute wow-loot-share-db --remote --command="DELETE FROM items"
# R2 图片要单独清:
npx wrangler r2 object delete wow-loot-images/items/xxx
```

**Q: 怎么看日志?**
```bash
npx wrangler tail
```

**Q: 旧的 wow-loot-share Worker 怎么删?**
Cloudflare Dash → Workers & Pages → wow-loot-share → Settings → Delete。

**Q: 免费额度够用吗?**
- Workers 请求:10 万/天
- D1 读 500 万/天,写 10 万/天
- R2 存储 10GB,出口流量 **完全免费**

只要不被 DDoS,永久免费。
