---
title: 建站系列②｜Hexo + Butterfly 主题从零搭建全过程
date: 2026-07-13 10:00:00
categories:
  - 博客搭建
series: 从零搭建个人博客
tags:
  - Hexo
  - Butterfly
  - 建站教程
---

这一篇记录具体的搭建步骤，从环境安装到主题定制，尽量把每个关键操作都写清楚，方便同样想搭博客的同学参考。

<!-- more -->

## 一、基础环境准备

需要提前装好 Node.js、npm 和 Git（Hexo 本质是一个 Node.js 命令行工具）。安装完成后验证：

```bash
node -v   # 建议 18+ 版本
npm -v
git --version
```

## 二、安装 Hexo 脚手架并初始化项目

```bash
npm install -g hexo-cli
hexo init my-blog
cd my-blog
npm install
```

初始化后会生成基础目录结构：`_config.yml`（站点配置）、`source/`（文章和页面源文件）、`themes/`（主题目录）、`scaffolds/`（新建文章的模板）。

本地启动预览：

```bash
npx hexo server
```

浏览器打开 `http://localhost:4000`，能看到默认的 Landscape 主题效果。

## 三、安装 Butterfly 主题

```bash
git clone -b master https://github.com/jerryc127/hexo-theme-butterfly.git themes/butterfly
npm install hexo-renderer-pug hexo-renderer-stylus --save
```

Butterfly 主题用 Pug 和 Stylus 编写模板和样式，必须装这两个渲染器依赖，否则页面样式和布局都无法正确渲染。

## 四、启用主题 + 分离配置文件（重要的最佳实践）

在根目录 `_config.yml` 里把 `theme` 字段改成 `butterfly`。

**关键经验**：不要直接修改 `themes/butterfly/_config.yml` 这个主题自带的配置文件！而是在**项目根目录**新建一个 `_config.butterfly.yml`，把所有个性化配置写在这里。Hexo 会自动识别并合并这个文件（优先级高于主题默认配置）。

这样做的好处：以后主题版本升级、重新 `git pull` 主题仓库时，你的个性化配置完全不受影响，不用每次升级后重新配置一遍。

## 五、核心配置项

`_config.butterfly.yml` 里最值得关注的几块配置：

```yaml
# 导航栏
menu:
  首页: / || fas fa-home
  文章: /archives/ || fas fa-archive
  个人简历: /resume/ || fas fa-id-card
  分类: /categories/ || fas fa-folder-open
  标签: /tags/ || fas fa-tags

# 侧边个人卡片
aside:
  card_author:
    enable: true
    description: 你的个人简介
    button:
      text: 我的简历
      link: /resume/

# 首页副标题打字机效果
subtitle:
  enable: true
  effect: true
  sub:
    - 第一行文字
    - 第二行文字
```

## 六、创建独立页面（简历、关于我、分类、标签）

Hexo 的"页面"和"文章"是分开的概念，页面通过命令创建：

```bash
hexo new page "resume"
hexo new page "about"
hexo new page "categories"
hexo new page "tags"
```

生成的文件在 `source/xxx/index.md`，写好 front-matter 后加上对应的 `type` 字段（分类页需要 `type: "categories"`，标签页需要 `type: "tags"`），Butterfly 主题会自动识别并用对应的布局渲染。

## 七、本地搜索功能

Butterfly 支持本地全文搜索，不需要额外的服务器，只需要装一个插件：

```bash
npm install hexo-generator-searchdb --save
```

再在根 `_config.yml` 补充：

```yaml
search:
  path: search.xml
  field: post
  content: true
```

`_config.butterfly.yml` 里把 `search.use` 设为 `local_search` 即可。

## 八、本地预览验证

```bash
npx hexo clean && npx hexo generate
npx hexo server
```

如果一切顺利，本地打开就能看到 Butterfly 主题的完整效果——卡片式布局、侧边栏个人信息、分类标签统计等。

下一篇会讲怎么把这套本地博客发布到 GitHub Pages，实现免费永久托管和一条命令自动部署。
