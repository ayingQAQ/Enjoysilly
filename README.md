# Enjoy Silly

Enjoy Silly 是一个纯浏览器运行的 SillyTavern 兼容角色扮演对话工作台。它面向希望更轻量地管理角色卡、世界书、预设、正则脚本、快速回复和对话记录的用户，重点是中文界面、本地数据、OpenAI 兼容接口和真实 SillyTavern 文件格式兼容。

项目不需要后端服务。数据默认保存在当前浏览器的 IndexedDB 中，角色卡、世界书、预设、对话、设置和备份都在本地完成。

> Enjoy Silly 是独立项目，不是 SillyTavern 官方项目。本项目只做格式兼容、使用体验参考和技术致谢。

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
