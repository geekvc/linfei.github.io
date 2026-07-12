---
title: 建站系列③｜GitHub Pages + Actions：真正的"零服务器"自动化部署
date: 2026-07-13 11:00:00
categories:
  - 博客搭建
series: 从零搭建个人博客
tags:
  - GitHub Pages
  - GitHub Actions
  - 建站教程
---

本地博客搭好之后，怎么发布上线、怎么绑定自己的域名、怎么做到"改完文章一条命令就能更新线上内容"？这一篇讲清楚整套部署方案。

<!-- more -->

## 一、为什么选 GitHub Pages

GitHub Pages 是 GitHub 提供的免费静态网站托管服务，特点很直接：

- 完全免费，没有隐藏收费
- 天然支持自定义域名和免费 HTTPS 证书
- 配合 GitHub Actions，可以做到"push 即部署"的全自动化流程

## 二、创建仓库

在 GitHub 上新建一个仓库，命名为 `你的用户名.github.io`（比如我的是 `linfei.github.io`），这样创建的仓库会被 GitHub 识别为个人主页仓库。

本地关联远程仓库并推送：

```bash
git init
git remote add origin git@github.com:你的用户名/你的用户名.github.io.git
git add -A
git commit -m "init: 博客首次提交"
git push -u origin main
```

## 三、用 GitHub Actions 实现自动构建部署

传统方式是用 `hexo-deployer-git` 插件手动执行 `hexo deploy`，但这样每次发文章都要在本地跑一次构建命令，还得留意构建产物有没有正确提交。

更现代的方式是用 **GitHub Actions**：写一个工作流配置文件，让 GitHub 的云端服务器自动帮你完成"清理-生成-部署"整套流程，本地只需要 `git push` 源码。

在项目根目录创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy Hexo Blog to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx hexo clean && npx hexo generate
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

推送这个文件后，去仓库的 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**（不要选传统的"从某个分支部署"），保存即可。

## 四、验证部署效果

推送代码后，打开仓库的 **Actions** 标签页，能看到工作流的实时运行状态，变绿即代表部署成功。访问 `https://你的用户名.github.io` 就能看到博客上线效果。

## 五、绑定自定义域名

我在腾讯云买了 `linfei.wang` 这个域名，绑定步骤：

1. **DNS 解析**：登录腾讯云 DNSPod 控制台，给根域名添加 4 条 A 记录，指向 GitHub Pages 官方给出的 4 个固定 IP（185.199.108.153 ~ 111.153），再给 `www` 子域名添加一条 CNAME 记录指向 `你的用户名.github.io`
2. **GitHub 端配置**：仓库 **Settings → Pages → Custom domain**，填入 `linfei.wang`，等待 DNS 校验通过后勾选 **Enforce HTTPS**
3. **项目里放一个 CNAME 文件**：在 `source/` 目录下新建一个叫 `CNAME` 的文件（无后缀），内容就是你的域名 `linfei.wang`，这样每次构建部署都会自动带上这个文件，域名绑定就不会因为重新部署而丢失

## 六、日常更新只需一条命令流程

配置完成后，以后写完新文章，只需要：

```bash
git add -A
git commit -m "post: 新文章标题"
git push
```

推送后 1-2 分钟，GitHub Actions 自动完成构建部署，线上博客即刻更新，全程不需要登录任何服务器、不需要手动上传文件。

下一篇会讲这个博客最有意思的部分——右下角的 AI 数字分身聊天机器人是怎么实现的。
