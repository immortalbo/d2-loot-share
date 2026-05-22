# 暗黑2群友装备共享 (d2-loot-share)

暗黑2重置版群友开荒用的装备共享小工具。粘贴截图、填昵称备注、按类型/品质/职业分类,谁要点一下,流程结束删条目。

## 技术栈

- **前端**: React + Vite + TypeScript
- **后端**: Cloudflare Workers + Hono
- **数据库**: Cloudflare D1 (SQLite)
- **图片存储**: Cloudflare R2
- **部署**: Cloudflare Workers + Assets(单 Worker 同时托管前端和 API)

## 功能

- 口令 + 昵称登录(数据存 localStorage)
- 粘贴 / 拖拽 / 选择 上传装备截图
- 装备列表卡片展示
- 「我要」按钮标记已认领
- 发布者或认领者可删除条目
- 每 10 秒自动刷新

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars   # 编辑里面的 SHARE_PASSWORD
npm run db:init:local            # 初始化本地 D1
npm run dev:worker               # 启动 Worker(:8787)
# 另开终端
npm run dev                      # 启动 Vite(:5173)
```

打开 http://localhost:5173

## 部署

详见 [DEPLOY.md](./DEPLOY.md)。
