# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 当前状态：阶段 0 脚手架已建立

本仓库（`my_silly`）已经建立 Vite + React + TypeScript + Tailwind 基础脚手架。应用代码刚起步，兼容性 IO 层尚未实现。开工前**必须先通读 `information/` 目录**。

目录现状：
- `plan.md` — 完整规划书（权威，十节）。
- `src/` — React 应用源码（阶段 0 骨架）。
- `information/` — 跨 AI/开发者协作文档（先读，见下）。
- `test-fixtures/` — 真实 SillyTavern 导出样本，兼容性回归测试的黄金数据（不参与构建）。
- `.Codex/` — Codex 本地配置。

> 注意：上级目录 `E:\Desktop\demo\AGENTS.md` 描述的是无关的旧项目（心情记录 app），**与 my_silly 无关，勿参照**。本文件才是 my_silly 的指南。

## 项目目标

重构简化版 SillyTavern：**纯浏览器 Web 应用**，管理**角色卡 / 世界书 / 预设**并接入 **OpenAI 兼容接口**做实时对话。核心硬要求是**与真实 SillyTavern 文件双向兼容**。

## 协作文档（动手前按顺序读）

1. `information/00-README.md` — 索引与协作约定
2. `information/01-decisions.md` — 已确认的需求边界（**改动前需用户同意**）
3. `information/02-fixture-analysis.md` — 对真实样本的字段级实测（**兼容层实现以此为准**）
4. `information/03-format-reference.md` — ST 各文件格式权威参考
5. `information/04-progress.md` — 当前进度、下一步、待办、阻塞项

**每完成一个阶段或重要改动，必须更新 `information/04-progress.md`**（日期 / 改了什么 / 验证结果 / 下一步）。

## 技术栈与常用命令

Vite + React 18 + TypeScript + Tailwind + Zustand + IndexedDB(`idb`)。PNG 角色卡读写用 `png-chunks-extract`/`png-chunk-text`/`png-chunks-encode`。纯前端、无后端，数据全部本地 IndexedDB。界面纯中文。

常用命令：
- `npm install` — 安装依赖。
- `npm run dev` — 启动 Vite 开发服务器。
- `npm run build` — TypeScript 类型检查 + 生产构建。
- `npm test` — 运行 Vitest 一次性测试（当前覆盖真实样本解析）。
- `npm run test:watch` — 监听模式运行 Vitest。
- `npm run preview` — 本地预览生产构建。
- `npm run typecheck` — 仅运行 TypeScript 检查。

当前测试框架已建立；后续 IO 层应继续补充面向 `test-fixtures/` 的往返测试。

## 兼容性是项目的灵魂（最易踩坑，务必牢记）

以下事实来自对 `test-fixtures/` 真实文件的实测（细节见 `02-fixture-analysis.md`）：

- **角色卡**：数据存在 PNG 的 `tEXt` 块里，base64(UTF-8(JSON))。读取**优先 `ccv3` 关键字，回退 `chara`**。也支持独立 `.json`。
- **世界书有两种"方言"，必须互转**：独立导出是 `{entries:{"0":{...}}}`（对象、用 `key`/`order`/`disable`）；角色卡内嵌 `character_book` 是 `{entries:[...]}`（数组、用 `keys`/`insertion_order`/`enabled`）。`enabled`↔`disable` 取反，`position` 字符串↔整数。完整映射表见 `03-format-reference.md` §2。
- **预设**：只支持 **ST 原生 Chat Completion 预设**（`prompts[]` + `prompt_order[]` + 采样参数）。**不支持 TavernHelper/JS-Slash-Runner 脚本预设**（含可执行 JS）。**正则脚本存在预设的 `extensions.regex_scripts` 里**，从这里读取。
- **对话**：JSONL 格式，第 1 行是元数据头，其余每行一条消息（含 `swipes[]`/`swipe_id`）。
- **未知字段 / `extensions` 必须原样保留**（规范强制，真实文件常带规范外字段如 `avatar`、`display_index`）。类型定义用"已知字段强类型 + 未知字段兜底保留"。

## 验证方式

以 `test-fixtures/` 里的真实文件做**往返测试**：解析 → 重新导出 → 字段无丢失；导出物能被真实 SillyTavern 导入。开发时优先用 Node 直接解析样本核对字段（已用于样本分析）。

## 环境

Windows，**bash shell**（用 `/dev/null`、正斜杠路径，不要用 Windows 语法）。工作目录固定 `E:\Desktop\demo\my_silly`，其他文件夹无关。Node 可用于解析/验证样本。
