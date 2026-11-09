# Configuration

The password gate's Connection panel sets `baseUrl`, `modelA`, `modelB`, and `locale` (`en-US` or `zh-CN`). Model IDs must exactly match `/models` from the user's running local server. Model A and B may use the same ID. The legacy private menu calls these slots Heretic and QQZ; the underlying IDs are user-configured.

Advanced settings live in `%APPDATA%\DSH-Private\settings.json`. Close the app before manual editing. `vision: true` advertises image input only if your selected local model supports it. Do not store credentials here; the built-in chat connector requires no remote API keys.

Optional integrations are retained as source but not automatically configured in this preview:

- `imageRoot` may point to the user's compatible local image runtime, including its own `python_embeded/python.exe` and model setup. Image model/server downloads are not included.
- `mcp.python`, `mcp.sitePackages`, and `mcp.servers` enable a user-owned Python environment and selected adapters. The default server list is empty. These adapters require their respective third-party packages.
- Studio requires an explicitly prepared `private-studio.json` inside the app's data directory and a compatible image backend. Its schema is validated in `app/addons/incognito/studio-config.mjs`. Encrypted images must stay with their matching vault.
- Shell/PTC execution requires the corresponding OS tools. External writes/tools are not a zero-trace environment.

Do not copy another user's `settings.json`, credentials, plugins, or vault into a public distribution. The application does not auto-import data from official DSH or earlier custom installations.

For isolated development tests only, `DSH_PRIVATE_DATA_ROOT` selects a separate data directory before launch. Ordinary users should use the default location.
