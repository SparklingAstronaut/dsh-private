# DSH Private

用于临时本地 AI 聊天和密码加密存档的 Windows 应用。**社区预览版，不是 DeepSeek 或 DSH Desktop 官方发行版。**

## 开始使用

1. 从 [Releases](https://github.com/SparklingAstronaut/dsh-private/releases) 下载 Windows x64 ZIP，完整解压，再打开 `DSH Private.exe`。适用于 Windows 10/11 x64；当前预览版没有代码签名。
2. 先启动自己的本地 OpenAI 兼容模型服务。在密码页展开 **Connection / 本地模型设置**，填写本机 API 地址，读取或输入模型 ID，保存并重启。第二个模型可选；发布包不包含模型权重或模型服务器。
3. 生成初始密码并妥善保存，然后解锁。密码遗失后无法恢复。
4. 聊天默认临时保存。通过私密聊天菜单主动保存，才会写入加密存档。退出时会提示尚未保存的内容。

应用数据位于当前用户的 `%APPDATA%\DSH-Private`，加密聊天位于 `private\Incognito`。升级前请备份此目录，密码另行保存。本软件不会自动导入其他 DSH 的配置、聊天或存档。

包含隐私聊天、附件、加密保存、密码更改、删除和退出清理。保留图片/Studio、工具执行和 MCP 接入代码，但需要使用者自行准备相应运行环境；预览包不包含图片模型、Python 环境、第三方账户或私人配置。详见[配置说明](docs/configuration.md)。

本地模型服务器独立运行；关闭 DSH Private 不会停止它，也不会清除它自己的日志。请阅读[隐私边界](SECURITY.md)。这是经过开发测试的预览版，尚未经独立安全审计。

源码构建和测试方式见[英文说明](README.md)。
