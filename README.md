# Enjoy Silly

Enjoy Silly 是一个纯浏览器运行的 SillyTavern 兼容角色扮演对话工作台。它面向希望更轻量地管理角色卡、世界书、预设、正则脚本、快速回复和对话记录的用户，重点是中文界面、本地数据、OpenAI 兼容接口和真实 SillyTavern 文件格式兼容。

项目不需要后端服务。数据默认保存在当前浏览器的 IndexedDB 中，角色卡、世界书、预设、对话、设置和备份都在本地完成。

> Enjoy Silly 是独立项目，不是 SillyTavern 官方项目。本项目只做格式兼容、使用体验参考和技术致谢。

## 你可以用它做什么

- 导入 SillyTavern PNG / JSON 角色卡。
- 查看角色卡详情、头像、标签、描述、首条问候和内嵌世界书。
- 导入、查看和导出世界书，兼容 ST 原生 `entries` 对象结构和角色卡内嵌 `character_book.entries` 数组结构。
- 导入 ST 原生 Chat Completion 预设，查看 prompt 顺序、启用状态、采样参数和扩展字段。
- 从预设 `extensions.regex_scripts` 读取正则脚本目录。
- 配置 OpenAI 兼容 API，测试连接并自动读取模型列表。
- 使用导入的角色和预设进行流式 Chat Completion 对话。
- 自动载入角色卡 `first_mes` 作为首条消息。
- 自动保存本地对话记录，并支持 ST JSONL 导入导出。
- 使用快速回复按钮和分组聊天基础功能。
- 保存主题、字号、Persona、默认预设、默认世界书、默认快捷回复等设置。
- 导出和恢复本地备份。

## 项目截图与图标

项目图标位于：

- `public/enjoy-silly-icon.png`：运行时 favicon / 应用图标。
- `design/enjoy-silly-icon.png`：设计资产备份。

## 推荐运行方式

### Windows 一键启动

仓库里提供了 Windows 启动脚本：

```text
release/windows-install-and-run.bat
```

使用方法：

1. 下载或克隆本项目。
2. 确认电脑已安装 Node.js 20 或更新版本。
3. 双击 `release/windows-install-and-run.bat`。
4. 脚本会进入项目根目录，安装依赖，然后启动本地开发服务。
5. 浏览器会打开：

```text
http://127.0.0.1:5173/
```

如果窗口提示找不到 `node` 或 `npm`，请先安装 Node.js：

```text
https://nodejs.org/
```

推荐安装 Node.js LTS 版本。

### 手动启动

在项目根目录打开终端，运行：

```bash
npm install
npm run dev
```

启动后访问：

```text
http://127.0.0.1:5173/
```

## 第一次使用流程

### 1. 打开项目

启动后进入 Enjoy Silly 首页。左侧是主要功能：

- 对话
- 角色卡
- 世界书
- 预设
- 正则脚本
- 快速回复
- 分组聊天
- 设置

移动端或窄屏下，导航会变成顶部横向按钮。

### 2. 导入角色卡

进入“角色卡”页面，点击“导入角色卡”，选择 SillyTavern 导出的 PNG 或 JSON 角色卡。

支持：

- PNG 角色卡里的 `ccv3` 数据。
- PNG 角色卡里的 `chara` 数据。
- 独立 JSON 角色卡。
- Character Card V2 / V3 常见字段。
- `extensions` 与未知字段保留。

导入后会显示角色库头像网格。点击角色头像或详情按钮可以查看：

- 角色名
- spec / spec_version
- 标签
- 描述
- personality
- scenario
- first_mes
- alternate_greetings
- system_prompt
- post_history_instructions
- mes_example
- 内嵌 character_book
- extensions 字段
- 未知字段保留情况

如果角色卡包含内嵌世界书，导入时也会在世界书资产中登记一份，方便在世界书页面查看。

### 3. 导入预设

进入“预设”页面，导入 SillyTavern 原生 Chat Completion 预设 JSON。

当前支持的是 ST 原生 Chat Completion 预设：

- `prompts[]`
- `prompt_order[]`
- 采样参数
- `extensions`
- `extensions.regex_scripts`

当前不支持执行 TavernHelper / JS-Slash-Runner 脚本预设。

### 4. 配置 API

进入“设置”页面，在“API 连接”里填写：

- API Base URL
- API Key
- 模型名

常见 Base URL 示例：

```text
https://api.openai.com/v1
https://api.deepseek.com/v1
http://127.0.0.1:8000/v1
```

点击“测试连接”后，程序会访问：

```text
GET /models
```

如果你填写的是：

```text
https://api.deepseek.com
```

程序会先尝试：

```text
https://api.deepseek.com/models
```

如果返回 404，会自动再尝试：

```text
https://api.deepseek.com/v1/models
```

测试成功后会自动读取模型列表，并把模型名改成下拉选择。

注意：浏览器直接访问第三方 API 时，端点必须允许 CORS。若接口不允许浏览器跨域调用，需要使用支持 Web 调用的兼容端点、本地代理或本地模型服务。

### 5. 开始对话

进入“对话”页面。

如果已经导入角色卡，页面会自动选择本地角色，并自动载入角色卡里的 `first_mes` 作为首条消息。

如果角色卡带有内嵌世界书，侧栏会显示：

```text
已启用角色卡内嵌世界书：N 条。
```

发送消息后，程序会调用 OpenAI 兼容 Chat Completion 接口并流式显示回复。

对话会自动保存到本地 `chats` store。你也可以手动：

- 保存
- 导出 JSONL
- 导入 JSONL
- 继续最后一条回复
- 重新生成 assistant 消息
- 编辑消息
- 删除消息
- 切换 swipe

### 6. 设置 Persona 和界面偏好

在“设置”页面可以配置：

- 用户名
- 用户描述 / Persona
- 默认预设
- 默认世界书
- 默认快捷回复
- 主题
- 字号

主题和字号会即时预览，保存后下次打开项目仍会使用。

## 一键脚本说明

`release/windows-install-and-run.bat` 做了这些事：

1. 切换到项目根目录。
2. 检查 `node` 是否可用。
3. 检查 `npm` 是否可用。
4. 执行 `npm install` 安装依赖。
5. 启动 Vite 开发服务器。
6. 自动打开本地访问地址。

脚本不会上传你的数据，也不会修改远程仓库。

如果依赖已经安装，再次运行脚本会继续执行 `npm install`，npm 会根据 `package-lock.json` 复用缓存和已有依赖。

## 常用命令

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

指定本机地址和端口启动：

```bash
npm run dev -- --host 127.0.0.1 --port 5173
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

预览生产构建：

```bash
npm run preview
```

## 数据保存在哪里

Enjoy Silly 当前使用浏览器 IndexedDB 保存数据。

同一个浏览器、同一个访问地址下的数据会保留。例如：

```text
http://127.0.0.1:5173/
```

如果你换成另一个地址，浏览器会把它视为不同站点，例如：

```text
http://localhost:5173/
```

这两个地址的数据不会自动共享。

如果清理浏览器站点数据、IndexedDB 或浏览器缓存，本地数据可能会被删除。重要数据请定期在设置页导出备份。

## 备份与恢复

在“设置”页面可以导出备份 zip。备份包含本地数据，包括：

- 角色卡
- 世界书
- 预设
- 正则脚本
- 快捷回复
- 分组
- 对话
- 设置

如果你保存了 API Key，备份文件也可能包含本地 API 设置。请妥善保管备份文件，不要公开上传。

恢复备份时，资产数据会导入到当前浏览器本地数据库中。

## 兼容性边界

### 角色卡

支持：

- PNG `ccv3`
- PNG `chara`
- 独立 JSON
- Character Card V2 / V3 常见字段
- 未知字段保留
- `extensions` 保留
- 内嵌 `character_book`

读取优先级：

1. `ccv3`
2. `chara`

### 世界书

支持两种常见结构：

ST 原生世界书：

```json
{
  "entries": {
    "0": {
      "key": ["keyword"],
      "content": "text"
    }
  }
}
```

角色卡内嵌世界书：

```json
{
  "entries": [
    {
      "keys": ["keyword"],
      "content": "text"
    }
  ]
}
```

导入导出会尽量保留未知字段，不主动清洗第三方插件字段。

### 预设

当前支持 ST 原生 Chat Completion 预设。

不执行：

- TavernHelper 脚本
- JS-Slash-Runner 脚本
- 未经确认的可执行 JS

### 正则脚本

当前从预设 `extensions.regex_scripts` 中读取并展示。

默认只读管理，不导入独立正则集合，不执行 TavernHelper / JS-Slash-Runner。

### 对话

支持 SillyTavern JSONL 对话记录：

- 第 1 行为 metadata。
- 后续每一行为消息。
- 支持 `swipes[]` 与 `swipe_id`。

## 常见问题

### 双击脚本后提示找不到 node

说明电脑没有安装 Node.js，或者安装后没有加入 PATH。

解决方法：

1. 安装 Node.js LTS。
2. 关闭脚本窗口。
3. 重新打开脚本。

### 页面打开了，但 API 请求失败

可能原因：

- API Base URL 不正确。
- API Key 错误。
- 模型名不存在。
- 服务端不允许浏览器跨域请求。
- 本地模型服务没有启动。
- Base URL 缺少 `/v1`。

先在设置页点击“测试连接”。如果测试成功，模型会自动填入下拉框。

### 导入角色卡后没有头像

如果角色卡是 PNG，Enjoy Silly 会优先使用原 PNG 作为头像。如果是 JSON，只有当角色卡 data 里包含可直接使用的图片地址或 data URL 时才会显示头像，否则显示文字占位。

### 导入角色卡后世界书在哪里

如果角色卡包含 `character_book`：

- 角色详情里会显示内嵌世界书摘要。
- 世界书页面会出现对应的内嵌世界书资产。
- 对话页面会优先启用角色卡内嵌世界书。

### 为什么设置了 API Key 还不能请求

浏览器直接请求第三方 API 需要对方服务器允许 CORS。很多官方 API 不允许网页直接跨域调用。可以使用：

- 支持 CORS 的 OpenAI 兼容端点。
- 本地代理服务。
- 本地模型服务。

### 自动保存会保存到哪里

自动保存写入浏览器 IndexedDB 的 `chats` store。不会自动上传到任何服务器。

## 项目结构

```text
my_silly/
├── public/                 # Vite 静态资源
│   └── enjoy-silly-icon.png
├── design/                 # 设计资产
│   └── enjoy-silly-icon.png
├── release/                # 面向使用者的启动脚本
│   └── windows-install-and-run.bat
├── src/
│   ├── components/         # 通用布局与组件
│   ├── data/               # 工作台导航配置
│   ├── lib/                # 底层 IO、IndexedDB、PNG、JSONL、扫描等工具
│   ├── screens/            # 页面入口
│   ├── services/           # 导入导出、详情聚合、设置、备份等服务
│   ├── store/              # Zustand 状态
│   └── types/              # SillyTavern 兼容类型
├── test-fixtures/          # 本地兼容性测试样本，不参与构建
├── index.html
├── package.json
├── package-lock.json
├── README.md
├── LICENSE
└── NOTICE.md
```

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- IndexedDB / `idb`
- Vitest
- `png-chunks-extract`
- `png-chunk-text`
- `png-chunks-encode`
- `marked`
- `DOMPurify`
- `lucide-react`
- `fflate`

## 开发与验证

开发时建议至少运行：

```bash
npm test
npm run typecheck
npm run build
```

当前项目没有 `lint` 脚本。

## 隐私说明

Enjoy Silly 默认在浏览器本地保存数据。

项目本身不提供后端，也不会主动上传你的角色卡、世界书、预设、对话或设置。

当你在对话页发送消息时，浏览器会向你配置的 OpenAI 兼容 API 地址发送请求。发送内容取决于你选择的角色、预设、Persona、世界书和聊天历史。请确认你信任所配置的 API 服务。

## 许可证

本项目采用 GNU Affero General Public License v3.0 only。

SPDX 标识：

```text
AGPL-3.0-only
```

完整条款见：

- [LICENSE](./LICENSE)
- [NOTICE.md](./NOTICE.md)

## 与 SillyTavern 的关系

Enjoy Silly 是独立项目，参考 SillyTavern 的文件格式、产品形态和兼容边界，目标是提供更轻量的中文 Web 工作台。

SillyTavern 项目及其贡献者保留其原项目、文档、名称和相关实现的权利。

参考链接：

- SillyTavern repository: https://github.com/SillyTavern/SillyTavern
- SillyTavern license and credits: https://docs.sillytavern.app/licensecredits/
