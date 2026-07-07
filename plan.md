# 轻量版 SillyTavern（代号 my_silly）— 详细规划书

## 一、背景与目标（Context）

SillyTavern 功能强大但极其臃肿：几十个页签、上百个设置项、庞大的后端。你希望做一个**重构简化版**，保留角色扮演对话的核心能力，去掉学习成本高、日常用不到的部分。

**核心目标：**
1. 管理三类核心资产：**预设（Preset）**、**世界书（World Info / Lorebook）**、**角色卡（Character Card）**。
2. 完整的**对话能力**：接入 OpenAI 兼容接口，实时生成回复。
3. **与 SillyTavern 文件双向兼容**——这是硬性要求。my_silly 导出的文件能被 SillyTavern 直接导入，SillyTavern 导出的文件也能在 my_silly 里直接用。
4. 界面比 SillyTavern 简洁得多，普通用户开箱即用。

**运行形态与首期决策（已确认）：**
- 纯浏览器 Web 应用；完整接入 LLM 实时对话；优先支持 OpenAI 兼容 Chat Completion 接口。
- **界面语言**：纯中文界面（不做 i18n 切换，直接中文文案）。
- **世界书扫描**：首期做简化版（关键词命中即注入 + 常驻），但**数据模型与架构按完整版设计**，预留全部字段与扩展点，并在本文档给出从简化到完整的详细升级路线（见 §6 模块 4 与 §8）。
- **首期功能范围**：核心（对话 + 角色卡/世界书/预设/设置）**＋ 正则脚本（Regex）＋ 快速回复（Quick Reply）＋ 分组聊天（Group Chat）**。
- **兼容性验证素材**：你手头有真实 SillyTavern 导出文件（角色卡 PNG、世界书、预设、对话），将用于双向兼容测试。开发时需你把样本放入 `my_silly/test-fixtures/`（该目录不参与构建）。

---

## 二、兼容性承诺（本项目的灵魂，必须逐条实现）

这是本项目最难、最有价值的部分。经过对 SillyTavern 源码与规范仓库的调研，确认以下事实并据此设计导入/导出层：

### 2.1 角色卡（Character Card）
- **PNG 内嵌**：卡数据以 base64(UTF-8(JSON)) 存在 PNG 的 `tEXt` 块里。V2 用关键字 `chara`，V3 用 `ccv3`。**读取时优先读 `ccv3`，回退到 `chara`**；导出 V3 卡时可同时回填一份 `chara` 块以兼容老客户端。
- **V2 规范**（`spec: "chara_card_v2"`, `spec_version: "2.0"`）：所有字段包在 `data` 对象里——`name, description, personality, scenario, first_mes, mes_example, creator_notes, system_prompt, post_history_instructions, alternate_greetings[], character_book, tags[], creator, character_version, extensions{}`。
- **V3 规范**（`spec: "chara_card_v3"`, `spec_version: "3.0"`）：V2 超集，新增 `assets[], nickname, creator_notes_multilingual{}, source[], group_only_greetings[], creation_date, modification_date`（时间戳为 Unix 秒）。
- 也支持**独立 `.json`**（卡对象直接写文件）导入导出。
- **`extensions` 及所有未知字段必须原样保留**，不得在导入导出时丢弃（规范强制要求）。

### 2.2 世界书（存在两种"方言"，必须互转）
- **独立世界书导出**（SillyTavern 原生）：`{ entries: { "0": {...}, "1": {...} } }`，`entries` 是**以字符串数字为键的对象**（不是数组）。字段用 `key[], keysecondary[], content, comment, constant, selective, selectiveLogic, order, position(整数), disable, excludeRecursion, preventRecursion, probability, useProbability, depth, uid, ...`。
- **角色卡内嵌 `character_book`**（可移植规范）：`{ entries: [ {...} ] }`，`entries` 是**数组**。字段用 `keys[], secondary_keys[], insertion_order, enabled, position("before_char"/"after_char"), ...`。
- **关键映射表**（导入/导出转换层核心）：

  | 可移植 `character_book` | 原生世界书导出 |
  |---|---|
  | `keys` | `key` |
  | `secondary_keys` | `keysecondary` |
  | `insertion_order` | `order` |
  | `enabled`（布尔） | `disable`（布尔，取反） |
  | `case_sensitive` | `caseSensitive` |
  | `id` | `uid` |
  | `position: "before_char"/"after_char"` | `position: 0/1`（整数枚举） |

- **`position` 整数枚举**：`before=0, after=1, ANTop=2, ANBottom=3, atDepth=4, EMTop=5, EMBottom=6`。
- **`selectiveLogic` 枚举**：`AND_ANY=0, NOT_ALL=1, NOT_ANY=2, AND_ALL=3`。
- 导入时对缺失字段用默认模板回填，容忍老版本/残缺文件。

### 2.3 预设（Preset）
- **Chat Completion 预设**（本项目主用）：扁平设置块 + `prompts[]` + `prompt_order[]`。
  - `prompts[]`：每项 `{ identifier, name, role, content, system_prompt }`；结构性占位用 `marker: true`（无 content）。保留标识符：`main, nsfw, jailbreak, dialogueExamples, chatHistory, worldInfoBefore, worldInfoAfter, charDescription, charPersonality, scenario, personaDescription, enhanceDefinitions`。
  - `prompt_order[]`：按角色槽排序，`character_id: 100001` 为默认槽，内含 `order: [{identifier, enabled}]`。
  - 采样参数在顶层：`temperature, top_p, frequency_penalty, presence_penalty, top_k, min_p, ...` + `openai_max_context, openai_max_tokens, chat_completion_source` 等。

### 2.4 对话（Chat，JSONL 格式）
- **JSON Lines**，每行一个 JSON 对象。
- **第 1 行是元数据头**：`{ user_name, character_name, create_date, chat_metadata }`。
- **后续每行是消息**：`{ name, is_user, is_system, send_date, mes, extra{}, swipe_id, swipes[], swipe_info[] }`。
  - `mes` 是当前显示内容，等于 `swipes[swipe_id]`；`swipes[]` 存多个 reroll 版本。
  - `send_date` 用 ST 格式 `YYYY-MM-DD@HHhMMmSSs`。
  - 导入时容忍 `swipe_info` 缺失。

---

## 三、技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | **React 18 + TypeScript** | 复杂交互多，组件化必需 |
| 构建 | **Vite** | 快，产物为静态文件，可直接托管/双击 index.html（配 base 相对路径） |
| 样式 | **Tailwind CSS** | 快速搭一致的 UI，暗色主题友好 |
| 状态 | **Zustand** | 轻量，比 Redux 简单，适配全局 store（角色/预设/世界书/设置） |
| 本地存储 | **IndexedDB（用 `idb` 封装）** | 角色卡带图片、对话历史体积大，localStorage 5MB 不够 |
| PNG 解析 | **`png-chunks-extract` + `png-chunk-text` + `png-chunks-encode`** | 纯 JS 读写 tEXt 块，实现角色卡 PNG 读写 |
| Markdown | **`marked` + `DOMPurify`** | 渲染消息内含的 markdown，DOMPurify 防 XSS |
| 拖拽排序 | **`@dnd-kit/sortable`** | Prompt 顺序、快速回复、世界书条目拖拽 |
| ZIP 打包 | **`fzstd` / `fflate`** | 数据备份导出为 zip（fflate 纯 JS 轻量） |
| 图标 | **lucide-react** | 简洁图标库 |

> **正则安全**：正则脚本功能允许用户自定义正则替换消息内容，需用**带超时的执行**防止灾难性回溯（ReDoS）——在 Web Worker 里跑，或限制回溯步数，避免卡死主线程。

> 说明：虽然是"纯浏览器"，但用 Vite 构建（有构建步骤）远比手写无构建 vanilla 更可维护。产物仍是纯静态前端，可部署到任意静态托管或本地打开。

---

## 四、CORS 问题与解决方案（必须在文档和 UI 里讲清楚）

纯浏览器直连 LLM 接口时，浏览器的同源策略会拦截**不返回 CORS 头**的接口（OpenAI 官方接口就是这样）。应对：
1. **推荐支持 CORS 的中转/兼容端点**：许多第三方 OpenAI 兼容中转站、以及本地推理端点（ollama、KoboldCpp、oobabooga 开 `--api` 时通常允许跨域）可直连。
2. **本地推理**：`http://localhost:...` 的兼容接口一般无 CORS 问题。
3. **可选极简代理（后续增强，非首期）**：附一个 ~30 行的 Node/Vite 代理脚本，转发请求并加 CORS 头。首期不做，仅在设置页文档里给出说明。
4. UI 在连接失败时给出明确的 CORS 排查提示，而不是笼统报错。

---

## 五、目录结构（在 `E:\Desktop\demo\my_silly` 内）

```
my_silly/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── src/
│   ├── main.tsx                    # 入口
│   ├── App.tsx                     # 布局 + 侧边栏导航
│   ├── types/
│   │   ├── character.ts            # V2/V3 卡类型
│   │   ├── worldinfo.ts            # 两种方言类型
│   │   ├── preset.ts               # 预设类型
│   │   └── chat.ts                 # 对话/消息类型
│   ├── lib/
│   │   ├── db.ts                   # IndexedDB (idb) 封装
│   │   ├── png.ts                  # PNG tEXt 块读写（chara/ccv3）
│   │   ├── cardIO.ts               # 角色卡导入导出（PNG + JSON, V2↔V3）
│   │   ├── worldInfoIO.ts          # 世界书两方言互转 + 导入导出
│   │   ├── worldInfoScan.ts        # ★ 世界书扫描引擎（简化→完整可扩展）
│   │   ├── presetIO.ts             # 预设导入导出
│   │   ├── chatIO.ts               # 对话 JSONL 读写
│   │   ├── macros.ts               # {{char}} {{user}} {{original}} 等宏替换
│   │   ├── regexEngine.ts          # 正则脚本执行（Worker + 超时，防 ReDoS）
│   │   ├── quickReplyIO.ts         # 快速回复导入导出（ST QR 格式）
│   │   ├── promptBuilder.ts        # ★ 提示词组装引擎（核心）
│   │   └── api.ts                  # OpenAI 兼容接口调用（含流式）
│   ├── store/
│   │   ├── useCharacters.ts
│   │   ├── usePresets.ts
│   │   ├── useWorldInfo.ts
│   │   ├── useChats.ts
│   │   ├── useRegex.ts             # 正则脚本
│   │   ├── useQuickReply.ts        # 快速回复
│   │   ├── useGroups.ts            # 分组聊天
│   │   └── useSettings.ts
│   ├── components/                 # 复用组件（卡片、弹窗、编辑器字段等）
│   └── screens/
│       ├── ChatScreen.tsx          # 对话主界面（含快速回复条、群聊成员栏）
│       ├── CharactersScreen.tsx    # 角色卡管理
│       ├── PresetsScreen.tsx       # 预设管理/编辑
│       ├── WorldInfoScreen.tsx     # 世界书管理/编辑
│       ├── RegexScreen.tsx         # 正则脚本管理
│       ├── QuickReplyScreen.tsx    # 快速回复管理
│       ├── GroupsScreen.tsx        # 分组聊天管理
│       └── SettingsScreen.tsx      # API 连接 + 全局设置 + persona
├── test-fixtures/                  # 真实 ST 导出样本（不参与构建，仅测试用）
└── public/                         # 静态资源
```

---

## 六、功能模块详解

### 模块 1：角色卡管理（CharactersScreen）
- 网格展示所有角色（头像 + 名字 + 标签）。
- **导入**：拖拽/选择 `.png`（读 ccv3→chara 块）或 `.json`；自动识别 V2/V3；未知字段保留在 `extensions`。
- **导出**：导出为 PNG（内嵌卡数据，可选同时回填 chara 块）或纯 JSON；V2↔V3 转换。
- **编辑器**：编辑 name/description/personality/scenario/first_mes/mes_example/creator_notes/system_prompt/post_history_instructions/alternate_greetings/tags/creator 等；V3 额外字段（nickname、group_only_greetings 等）。
- 每个角色可**绑定内嵌世界书**（character_book）。
- 删除、复制、搜索、按标签筛选。

### 模块 2：世界书管理（WorldInfoScreen）
- 世界书列表 + 条目编辑器。
- 条目字段：`key/keys`、`keysecondary`、`content`、`comment`（标题）、`constant`（常驻）、`selective` + `selectiveLogic`、`order`（插入顺序）、`position`（含 at-depth + depth）、`disable/enabled`、`probability` + `useProbability`、递归控制（`excludeRecursion`/`preventRecursion`）。
- **导入/导出**：原生 `{entries:{}}` 格式；与角色卡内嵌 `character_book` 数组格式**自动互转**（走 worldInfoIO 映射表）。
- 世界书可**全局激活**或**绑定到角色/对话**。

### 模块 3：预设管理（PresetsScreen）
- 预设列表 + 编辑器。
- **采样参数**面板：temperature、top_p、frequency_penalty、presence_penalty、max_tokens、max_context 等。
- **Prompt 管理器**：可视化 `prompts[]` + `prompt_order[]`——拖拽排序、启用/禁用、编辑每个 prompt 的 role/content，支持 marker 占位（chatHistory、worldInfoBefore 等）。
- 导入/导出 SillyTavern Chat Completion 预设 JSON。

### 模块 4：★ 提示词组装引擎（promptBuilder.ts）——项目核心
把"预设 + 角色卡 + 世界书 + 对话历史 + persona"组装成最终发给 API 的 messages 数组，尽量复刻 SillyTavern 逻辑：
1. 按 `prompt_order` 遍历启用的 prompt。
2. 遇到 marker 占位符时注入对应动态内容：
   - `charDescription/charPersonality/scenario` ← 角色卡字段。
   - `worldInfoBefore/worldInfoAfter` ← 世界书扫描结果（见下）。
   - `dialogueExamples` ← mes_example。
   - `chatHistory` ← 对话消息。
   - `jailbreak` ← post_history_instructions。
3. **世界书扫描**（见下方专节，简化版起步）：按 position/order 注入到相应位置（before/after/at-depth）。
4. **宏替换**：`{{char}}`、`{{user}}`、`{{original}}`、`{{nickname}}` 等（macros.ts）。
5. **正则脚本**：在装配前后按 placement 对内容做正则替换（regexEngine.ts）。
6. 输出符合 OpenAI Chat Completion 的 `messages[]`。

#### 世界书扫描引擎（worldInfoScan.ts）——简化起步，完整版留好接口

**设计原则**：数据模型一次到位（所有 ST 字段都存、都在编辑器里可编辑），扫描引擎分阶段实现。引擎入口统一为：

```
scanWorldInfo(entries, chatMessages, options) → { before[], after[], atDepth[] }
```

- **首期（简化版）实现**：
  - 常驻条目（`constant: true`）——永远注入。
  - 关键词命中——把最近 `scan_depth` 条消息拼成文本，对每个条目的 `key[]` 做（大小写按 `caseSensitive`）包含匹配，命中即注入。
  - 按 `order` 排序、按 `position`（before/after/at-depth + `depth`）分组输出。
  - `disable/enabled` 过滤。
- **完整版升级点（本期预留字段+接口，后续填充逻辑）**：
  1. **selective + selectiveLogic**：次要关键词 `keysecondary[]` 的 AND_ANY/NOT_ALL/NOT_ANY/AND_ALL 判定。
  2. **probability + useProbability**：命中后按概率决定是否真正注入。
  3. **递归扫描**：已注入条目的 content 作为新文本再扫一轮，配合 `excludeRecursion`/`preventRecursion`/`delayUntilRecursion`。
  4. **token_budget**：注入总量超预算时按 order 截断。
  5. **timed effects**：`sticky`/`cooldown`/`delay`（需在对话状态里记录每条目的触发轮次）。
  6. **分组/评分**：`group`/`groupWeight`/`useGroupScoring`。
  - 升级方式：`options` 里加 `mode: 'simple' | 'full'` 与各特性开关，逻辑增量叠加，不改数据模型与调用方。

### 模块 5：对话（ChatScreen）
- 选择角色 → 开始/继续对话。
- 消息气泡（用户/角色/系统），markdown 渲染 + XSS 净化。
- **流式生成**（SSE / fetch stream），实时打字机效果。
- **Swipe**：左右切换/重新生成（reroll），写入 `swipes[]` / `swipe_id`。
- 编辑消息、删除消息、重新生成、继续（continue）。
- 首条消息用 first_mes，可切换 alternate_greetings。
- **多对话管理**：每个角色多个对话存档，新建/切换/重命名/删除。
- **导入/导出 JSONL**（ST 兼容格式）。

### 模块 6：正则脚本（RegexScreen + regexEngine.ts）
- 管理正则脚本列表；每条：`scriptName, findRegex, replaceString, trimStrings[], placement[], disabled, markdownOnly, promptOnly, runOnEdit, substituteRegex, minDepth, maxDepth`（ST Regex 扩展字段）。
- `placement` 决定作用对象：用户输入 / AI 输出 / 斜杠命令 / 世界书。
- **导入/导出**：ST 正则脚本 JSON（单条）及全局/角色绑定两种作用域。
- **安全**：正则在 Web Worker 中执行并设超时，防 ReDoS（catastrophic backtracking）导致页面卡死。
- 支持 `{{match}}`、捕获组 `$1` 等替换语法。

### 模块 7：快速回复（QuickReplyScreen + quickReplyIO.ts）
- 快速回复集（QR Set）：一组按钮，点击后向输入框/对话插入预设文本或执行斜杠命令。
- 每条：`label, message, 是否自动执行, 触发时机`。
- 对话界面底部显示当前启用的 QR 按钮条。
- **导入/导出**：ST Quick Reply v2 的 JSON 格式（`{ version, name, qrList[] }`）。
- 首期斜杠命令（STscript）只支持最常用的插入文本；复杂脚本命令标注为后续增强。

### 模块 8：分组聊天（GroupsScreen + useGroups.ts）
- 创建分组：选多个角色卡组成一个群。
- 群配置：成员列表、发言顺序策略（自然顺序 / 列表顺序 / 手动指定下一个发言者）、是否允许自动回复。
- 群聊对话：每轮由某个成员生成回复；promptBuilder 针对"当前发言角色"装配（其余成员作为上下文），支持 `group_only_greetings`（V3 字段）。
- 群聊存档同样走 JSONL；成员切换在消息 `extra` 或群元数据中记录。
- **兼容性**：ST 群聊有独立的 group 元数据文件，首期实现 my_silly 内部群聊；与 ST 群聊文件的互导标注为后续增强（角色卡本身完全兼容）。

### 模块 9：设置（SettingsScreen）
- **API 连接**：接口地址（base URL）、API Key、模型名、连接测试；CORS 排查提示。
- **User Persona（用户角色）**：用户名、用户描述（{{user}} 展开），可多套切换。
- 全局默认预设、全局世界书、主题（暗/亮）、字号。
- **数据备份/恢复**：一键导出全部数据为 zip / 从 zip 恢复。

---

## 七、我主动补充的功能（你可能没提到但很重要）

1. **User Persona 系统**——SillyTavern 核心概念，`{{user}}` 的来源，必须有。
2. **宏（Macro）系统**——`{{char}}/{{user}}/{{original}}/{{time}}/{{random}}` 等，角色卡和预设大量依赖。
3. **Swipe / reroll 与消息编辑**——对话体验刚需。
4. **多对话存档管理**——同一角色多条对话线。
5. **世界书递归扫描与概率触发**——决定世界书是否"真的像 ST 一样工作"。
6. **数据备份/一键导出恢复**——纯本地存储，必须能备份防丢。
7. **未知字段保全**——导入导出不破坏 `extensions` 等（规范强制）。
8. **暗色主题**——角色扮演场景默认暗色。
9. **Token 估算显示**（可选增强）——提示当前上下文占用。

**已纳入首期**：正则脚本（Regex）、快速回复（Quick Reply）、分组聊天（Group Chat）——见模块 6/7/8。

**首期可暂缓（后续增强）**：世界书完整扫描（selective/概率/递归/预算/timed，见模块 4 升级路线）、TTS/语音、图片生成、CHARX zip 与内嵌 PNG 资源块、完整 STscript 斜杠命令引擎、与 ST 群聊元数据文件的互导、向量数据库检索、多 API 提供方（Claude/Gemini/text-completion）。

---

## 八、开发阶段（里程碑）

- **阶段 0：脚手架** — Vite + React + TS + Tailwind + IndexedDB，基础布局与侧边栏导航（中文）。
- **阶段 1：数据层与 IO（兼容性根基）** — 全部 types（按完整版字段一次到位）+ db.ts + png.ts + cardIO/worldInfoIO/presetIO/chatIO。用 `test-fixtures/` 里的真实 ST 文件做**双向兼容**往返测试。
- **阶段 2：三大资产管理界面** — 角色卡 / 世界书 / 预设 的增删改查 + 导入导出 UI。
- **阶段 3：提示词引擎 + API** — promptBuilder + macros + worldInfoScan（简化版）+ api（流式）。
- **阶段 4：对话界面** — 消息流、流式生成、swipe、编辑、多存档、JSONL 导入导出。
- **阶段 5：正则脚本** — regexEngine（Worker + 超时）+ RegexScreen + ST 正则 JSON 导入导出。
- **阶段 6：快速回复** — quickReplyIO + QuickReplyScreen + 对话底部按钮条。
- **阶段 7：分组聊天** — useGroups + GroupsScreen + promptBuilder 群聊装配 + 发言顺序策略。
- **阶段 8：设置与打磨** — persona、备份恢复(zip)、主题、CORS 提示、边界处理。
- **阶段 9（后续增强）** — 世界书完整扫描（按模块 4 升级路线逐项开启：selective→概率→递归→预算→timed）。

---

## 九、验证方式（端到端）

1. **格式兼容性（最关键）**：
   - 拿真实的 SillyTavern 导出文件（角色卡 PNG、世界书 JSON、预设 JSON、对话 JSONL）导入 my_silly，确认解析正确、字段无丢失。
   - 从 my_silly 导出上述文件，导入回真实 SillyTavern，确认可正常使用。
2. **PNG 往返**：导入一张角色卡 PNG → 编辑 → 导出 PNG → 再次导入，确认数据一致且图片完好。
3. **世界书方言互转**：把独立世界书绑进角色卡再导出，检查 `character_book` 数组格式字段映射正确；反向亦然。
4. **对话链路**：连一个支持 CORS 的兼容端点（或本地 ollama），完整走通"选角色→发消息→流式回复→swipe→保存→重开加载"。
5. **正则脚本**：导入 ST 正则脚本，验证对 AI 输出的替换生效；用一个已知会灾难性回溯的正则测试超时保护不卡死页面。
6. **快速回复**：导入 ST QR 集，点击按钮向对话插入文本；导出后字段结构与 ST 一致。
7. **分组聊天**：建群、多角色轮流发言、群聊存档保存与重载。
8. **构建**：`npm run build` 通过，产物可正常打开运行。
9. **数据持久化**：刷新页面/重开浏览器后数据仍在（IndexedDB）；备份导出 zip 后清库再恢复，数据完整。

---

## 十、已确认的关键决策（汇总）

- **平台**：纯浏览器 Web 应用（Vite + React + TS）。
- **对话**：完整接入 LLM，优先 OpenAI 兼容 Chat Completion。
- **界面语言**：纯中文。
- **首期范围**：对话 + 角色卡/世界书/预设/设置 ＋ 正则脚本 ＋ 快速回复 ＋ 分组聊天。
- **世界书扫描**：首期简化版（常驻 + 关键词命中），数据模型按完整版一次到位，升级路线见模块 4 与阶段 9。
- **兼容性验证**：使用你提供的真实 ST 文件（放入 `test-fixtures/`）做双向往返测试。
