# AI 分身聊天机器人 —— 部署说明（零服务器，全免费）

本项目的右下角悬浮聊天框，背后使用 **智谱 AI GLM-4-Flash**（国内目前唯一长期免费、不限量的商用级大模型 API）驱动，为了不把你的 API Key 直接暴露在网页源码里（否则任何人都能看到并盗用），我们用 **Cloudflare Workers** 免费搭一个"中转小接口"来代为转发请求。

整个过程不需要买服务器、不需要写复杂代码，跟着下面步骤操作即可，大约 10 分钟搞定。

---

## 第一步：获取智谱 AI API Key（已完成 ✅）

已在 https://open.bigmodel.cn/ 注册并创建好 API Key：

```
6bb70c8381784fddafcf881bf32a20a9.ZaeVDGjdHZTqEnck
```

> ⚠️ 安全提醒：这个 Key 不会写在代码里、不会提交到 GitHub 仓库，只会作为 Cloudflare Worker 的「机密环境变量」保存（见第三步），前端和仓库源码都看不到它，足够安全。

## 第二步：注册 Cloudflare 账号并创建 Worker

1. 打开 https://dash.cloudflare.com/ 注册一个免费账号（用邮箱即可，不需要绑定域名）
2. 左侧菜单找到 **Workers 和 Pages** → 点击「创建」→「创建 Worker」
3. 给 Worker 起个名字，比如 `linfei-ai-chat`，点击「部署」（先用默认代码占位）
4. 部署完成后，点击「编辑代码」，进入在线代码编辑器
5. 把本目录下 `worker.js` 的**全部内容**复制粘贴进去，覆盖默认代码（已经预填好王琳霏的人设和智谱接口，无需改动）
6. 点击右上角「部署」保存

## 第三步：配置环境变量（安全存放 API Key）

1. 回到该 Worker 的详情页，找到「设置」→「变量和机密」（Variables and Secrets）
2. 添加一个 **Secret（机密变量）**：
   - 变量名：`ZHIPU_API_KEY`
   - 值：`6bb70c8381784fddafcf881bf32a20a9.ZaeVDGjdHZTqEnck`
3. 保存后，Worker 会自动重新部署生效

## 第四步：拿到 Worker 的访问地址

部署成功后，Cloudflare 会给你一个形如下面的地址：

```
https://linfei-ai-chat.<你的用户名>.workers.dev
```

把这个地址复制下来，填入博客源码 `source/js/ai-chat-widget.js` 文件顶部的 `API_ENDPOINT` 常量中，然后 `git push` 重新部署即可生效。

## 费用说明

- Cloudflare Workers 免费额度：每天 10 万次请求，个人博客完全够用，长期免费
- 智谱 AI GLM-4-Flash：**永久免费、不限量**，无需担心余额问题

## 常见问题

- **聊天框没反应/报错**：先检查浏览器控制台报错信息，通常是 `API_ENDPOINT` 没改对，或者 Worker 的 `ALLOWED_ORIGINS` 里没加你的博客域名
- **想更换人设**：直接改 Worker 代码里的 `SYSTEM_PROMPT`，保存部署即可，无需改动博客代码
- **想换成 DeepSeek 或其他大模型**：把 `worker.js` 里请求的 `fetch` 地址、`env.XXX_API_KEY`、`model` 字段换成对应模型的接口协议即可，两者都是 OpenAI 兼容格式，改动量很小
