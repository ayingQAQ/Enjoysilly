# Windows 启动脚本

双击运行 `windows-install-and-run.bat`，或在项目根目录运行 `start.bat`。两者都会调用根目录的 `setup-and-start.bat`。

该脚本会：

1. 确认项目目录、`package.json` 与 `package-lock.json` 完整。
2. 检查 Node.js 与 npm，并要求 Node.js 20 或更高版本。
3. 使用 `npm ci` 按锁文件安装项目依赖。
4. 仅在 `127.0.0.1:5173` 启动 Vite 本地服务；服务启动后约 3 秒打开本地地址。

## 安全边界

- 不会静默下载或安装 Node.js；缺少运行时会提示前往 [nodejs.org](https://nodejs.org/) 安装 LTS。
- 不修改系统 PATH、注册表、执行策略或全局 npm 配置，也不请求管理员权限。
- 依赖安装使用 `package-lock.json`，并启用 `--ignore-scripts`，避免执行依赖生命周期脚本。
- 不执行远程 PowerShell、下载脚本或来自网络的命令。
- 服务仅绑定回环地址，局域网设备无法直接访问。
- 若 `127.0.0.1:5173` 已被占用，脚本会停止并要求用户先关闭现有服务；不会强制结束任何进程。

可在命令行执行以下检查而不安装依赖或启动服务：

```bat
setup-and-start.bat --check
```
