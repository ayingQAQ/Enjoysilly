# Enjoysilly / my_silly

一个面向 SillyTavern 用户的轻量化中文 Web 工作台。项目目标是在保留角色扮演对话核心能力的前提下，降低 SillyTavern 的日常使用复杂度，并尽量保持与 SillyTavern 导入、导出文件的双向兼容。

> 当前项目仍处于早期开发阶段。README 会随阶段进展持续更新，用来记录可用能力、验证方式、兼容性边界和下一步计划。

## 项目定位

Enjoysilly 不是 SillyTavern 的完整复刻，而是一个更轻、更聚焦的浏览器端工作台：

- 管理角色卡、世界书、Chat Completion 预设和正则脚本目录。
- 读取真实 SillyTavern 导出文件，尽量保留原始 payload、`extensions` 和未知字段。
- 以中文界面和更少的配置层级提供常用创作流程。
- 后续接入 OpenAI 兼容 Chat Completion 接口，支持角色扮演对话、上下文组装和本地数据管理。

## 当前进度

已完成或已有基础实现：

- Vite + React + TypeScript 项目骨架。
- 暗色中文工作台布局、侧边栏导航和右侧信息面板。
- IndexedDB 本地存储封装。
- 角色卡 PNG / JSON 导入导出基础能力。
- 世界书 JSON 导入导出与 SillyTavern 两种世界书结构的转换基础。
- Chat Completion 预设导入导出和详情查看。
- 资产目录统计与展示。
- 从预设 `extensions.regex_scripts` 聚合只读正则脚本目录。
- 世界书详情查看能力正在本地开发中。

尚未完成的核心能力：

- 真实聊天界面和 LLM 流式回复。
- Prompt Builder 上下文组装引擎。
- 世界书完整扫描逻辑。
- 正则脚本执行引擎。
- 快速回复、分组聊天、设置页和备份恢复。

## 核心功能规划

### 角色卡

- 支持 SillyTavern / Character Card V2、V3。
- 支持 PNG 内嵌 `chara` / `ccv3` 数据读取。
- 支持独立 JSON 导入导出。
- 保留 `extensions` 与未知字段，避免破坏外部工具私有数据。

### 世界书

- 支持 SillyTavern 原生世界书结构：`{ entries: { "0": {...} } }`。
- 支持角色卡内嵌 `character_book` 数组结构。
- 提供两种结构之间的字段映射与基础转换。
- 后续实现关键词命中、常驻条目、深度注入、选择逻辑、概率、递归和 token 预算。

### 预设

- 面向 SillyTavern Chat Completion 预设。
- 支持 `prompts[]`、`prompt_order[]` 和采样参数读取。
- 保留原始 payload 与扩展字段。
- 后续用于 Prompt Builder 组装最终 Chat Completion messages。

### 正则脚本

- 当前阶段只实现只读目录。
- 从已导入预设的 `extensions.regex_scripts` 聚合脚本元数据。
- 展示来源预设、脚本名称、禁用状态、placement、promptOnly、markdownOnly、runOnEdit、minDepth、maxDepth、findRegex 和 replaceString 预览。
- 当前不执行正则、不编辑正则、不导入独立正则集合。

### 对话

计划支持：

- OpenAI 兼容 Chat Completion 接口。
- 角色卡、世界书、预设、聊天历史和 Persona 的上下文组装。
- 流式回复、Swipe、消息编辑、多对话存档。
- SillyTavern JSONL 对话导入导出。

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- IndexedDB / `idb`
- Vitest
- `png-chunks-extract`、`png-chunk-text`、`png-chunks-encode`
- `marked` + `DOMPurify`
- `lucide-react`

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

运行测试：

```bash
npm test
```

类型检查：

```bash
npm run typecheck
```

生产构建：

```bash
npm run build
```

预览构建产物：

```bash
npm run preview
```

## 目录结构

```text
my_silly/
├── src/
│   ├── components/       # 通用布局与面板组件
│   ├── data/             # 工作台导航与演示数据
│   ├── lib/              # 底层 IO、IndexedDB、PNG、JSONL 等工具
│   ├── screens/          # 各页面入口
│   ├── services/         # 资产导入、导出、详情聚合与目录逻辑
│   ├── store/            # Zustand 状态
│   └── types/            # SillyTavern 兼容类型与 UI 类型
├── test-fixtures/        # 真实兼容性测试样本
├── plan.md              # 长期规划
├── AGENTS.md            # 开发代理协作规范
└── README.md
```

仓库还包含：

- `LICENSE`：GNU Affero General Public License v3.0 全文。
- `NOTICE.md`：项目版权、SillyTavern 致谢和兼容性边界说明。

## 兼容性原则

本项目的兼容性优先级高于界面便利性：

- 导入时尽量容忍旧版本、缺失字段和额外字段。
- 导出时避免丢失 SillyTavern 或第三方插件写入的未知数据。
- `extensions` 字段必须保留。
- 预设 payload、角色卡 data、世界书条目里的未知字段不能被无意清洗。
- 对具有执行风险的能力，例如正则脚本和未来脚本运行器，先做只读管理或显式安全边界，再考虑执行。

## 与 SillyTavern 的关系

Enjoysilly 是一个独立项目，参考了 SillyTavern 的产品形态、文件格式和兼容性边界，目标是提供更轻量的中文 Web 工作台体验。

本项目重点兼容 SillyTavern 常见资产格式，包括角色卡、世界书 / Lorebook、Chat Completion 预设、对话记录和正则脚本元数据。对 SillyTavern 的引用仅用于兼容性说明、用户识别和技术致谢。

Enjoysilly 不是 SillyTavern 官方项目，也不由 SillyTavern 团队维护或背书。SillyTavern 项目及其贡献者保留其原项目、文档、名称和相关实现的权利。

参考链接：

- SillyTavern repository: https://github.com/SillyTavern/SillyTavern
- SillyTavern license and credits: https://docs.sillytavern.app/licensecredits/

## 隐私与本地数据

- 项目优先作为纯前端本地应用运行。
- 用户导入的角色卡、世界书、预设和对话默认存储在浏览器 IndexedDB。
- 不应提交 `.env`、密钥、缓存目录、构建产物或本地开发资料。
- `information/` 是本地过程文档目录，不推送到 GitHub。

## GitHub 仓库信息

- 仓库：`ayingQAQ/Enjoysilly`
- 可见性：Private
- 推荐描述：轻量化中文 SillyTavern 兼容 Web 工作台，聚焦角色卡、世界书、预设、正则脚本与后续对话能力。
- 推荐 topics：`sillytavern`, `character-card`, `world-info`, `lorebook`, `chat-completion`, `react`, `typescript`, `vite`, `indexeddb`

## 开发约定

- 每次只推进一个明确小阶段。
- 开工前先确认 Git 状态和当前分支。
- 不在 `main` 上直接做大功能开发。
- 不擅自删除、覆盖或丢弃用户已有修改。
- 不提交 `.env`、`node_modules/`、`dist/`、`build/`、缓存文件或密钥。
- 每个阶段完成后运行对应验证命令，并记录修改范围、兼容性影响和下一步。

## 许可证

本项目采用 GNU Affero General Public License v3.0 only，SPDX 标识为 `AGPL-3.0-only`。完整条款见 [LICENSE](./LICENSE)。

选择 AGPL-3.0 是为了与 SillyTavern 的许可证方向保持一致，也方便后续在参考其公开资料、兼容其格式或必要时适配相关实现时保持清晰的开源边界。

简要提醒：

- 如果你修改并通过网络提供本项目服务，需要按 AGPL-3.0 的要求向用户提供相应源代码。
- 本项目按许可证原文以无担保方式提供。
- 与 SillyTavern 相关的致谢和边界说明见 [NOTICE.md](./NOTICE.md)。
