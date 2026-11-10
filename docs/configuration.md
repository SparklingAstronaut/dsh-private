# Configuration

The password gate's Connection panel sets `baseUrl`, `modelA`, `modelB`, and `locale` (`en-US` or `zh-CN`). Model IDs must exactly match `/models` from the user's running local server. Model A and B may use the same ID. Internally the slots are `model-a` and `model-b`; archives written by Preview 1–3 used the names Heretic and QQZ and are read as Model A and Model B. The underlying model IDs are user-configured.

Advanced settings live in `%APPDATA%\DSH-Private\settings.json`. Close the app before manual editing. `vision: true` advertises image input only if your selected local model supports it. Do not store credentials here; the built-in chat connector requires no remote API keys.

Optional integrations are retained as source but not automatically configured in this preview:

- `imageRoot` may point to the user's compatible local image runtime, including its own `python_embeded/python.exe` and model setup. Image model/server downloads are not included.
- `mcp.python`, `mcp.sitePackages`, and `mcp.servers` enable private tool servers in a user-owned Python environment. The default server list is empty. See [Private tool adapters](#private-tool-adapters).
- Studio requires an explicitly prepared `private-studio.json` inside the app's data directory and a compatible image backend. Its schema is validated in `app/addons/incognito/studio-config.mjs`. Encrypted images must stay with their matching vault.
- Shell/PTC execution requires the corresponding OS tools. External writes/tools are not a zero-trace environment.

Do not copy another user's `settings.json`, credentials, plugins, or vault into a public distribution. The application does not auto-import data from official DSH or earlier custom installations.

`DSH_PRIVATE_DATA_ROOT` selects a different data directory before launch, for example to keep archives on another drive. Set it before starting the app and keep it the same afterwards.

## Plugins

DSH Private is DSH with a private-mode core, so DSH plugins can be added to its profile as usual. The release ships none. While private mode is open, ordinary plugin tools are paused because they may write chat content to disk. A plugin takes part in private mode only through these optional services:

- `localImageGpu` with `runPrivate()`, `retryRecovery()` and `busy`: hands the GPU between the chat model and private image jobs.
- `privateStudioCompiler` with `describe()` and `prepare()`: supplies image workflows for private Studio. The core runs them in an encrypted workspace, encrypts the results and keeps them in the vault's private gallery.
- `privateEntryGuard` with `isBusy()`: keeps private mode closed while the plugin's own normal-mode job is still running.

## Private prompt skills

Put prompt skills in `prompt-skills` inside the data directory (`%APPDATA%\DSH-Private\prompt-skills` by default). Each file is `<name>.md`, where `<name>` uses lowercase letters, digits and hyphens, and starts with frontmatter:

```markdown
---
name: <name>
description: What the skill does
whenToUse: Optional hint for when the model should use it
---
Instructions for the model.
```

Skills are read once at startup and available as `/<name>` in private chats. Nothing is written or watched. At most 32 files of up to 256 KB each are loaded; invalid files are skipped and named in the log.

## Private tool adapters

Private tool servers run in a separate Python process with an in-memory filesystem. They cannot write to disk, start programs or open a file-backed database. Files they produce are returned to the chat and saved only when you save the chat.

- `documents` is built in and reads PDF, DOCX, XLSX and PPTX attachments. Its Python environment needs `mcp`, `pyfakefs`, `pypdf`, `python-docx` and `openpyxl`.
- Any other name in `mcp.servers` must be declared under `mcp.adapters`:

```json
{
  "mcp": {
    "python": "C:/Tools/python/python.exe",
    "sitePackages": "C:/Tools/python/Lib/site-packages",
    "servers": ["documents", "my-tool"],
    "adapters": {
      "my-tool": { "file": "C:/Tools/my-tool/adapter.py", "readOnly": ["C:/Tools/my-tool/data"] }
    }
  }
}
```

The adapter file defines `create_server(context)` and returns a FastMCP server. `context.root` is the in-memory folder for the current model slot, `context.owner` is `model-a` or `model-b`, and `context.private_path` resolves data paths. The adapter can read its own folder, the Python environment and the `readOnly` folders, nothing else. To let a tool read a host folder as input, define `IMPORT_DIRECTORIES = {"tool_name": "argument_name"}`; the app copies that folder into the in-memory filesystem before the call.
