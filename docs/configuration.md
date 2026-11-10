# Configuration

The password gate's Connection panel sets `baseUrl`, `modelA`, `modelB`, and `locale` (`en-US` or `zh-CN`). Model IDs must exactly match `/models` from the user's running local server. Model A and B may use the same ID. Internally the slots are `model-a` and `model-b`; archives written by Preview 1–3 used the names Heretic and QQZ and are read as Model A and Model B. The underlying model IDs are user-configured.

Advanced settings live in `%APPDATA%\DSH-Private\settings.json`. Close the app before manual editing. `vision: true` advertises image input only if your selected local model supports it. `contextWindow` (default 32768) and `maxTokens` (default 4096) should match what your local server allows. `disableGpu: true` turns off the app's own graphics acceleration, so its window uses no video memory that your local model or image jobs need. Do not store credentials here; the built-in chat connector requires no remote API keys.

Optional integrations are retained as source but not automatically configured in this preview:

- `mcp.python`, `mcp.sitePackages`, and `mcp.servers` enable private tool servers in a user-owned Python environment. The default server list is empty. See [Private tool adapters](#private-tool-adapters).
- Private Studio (image generation in private mode) needs an image plugin that provides the services listed under [Plugins](#plugins), your own ComfyUI installation, and an explicitly prepared `private-studio.json` inside the app's data directory. See [Private Studio](#private-studio). Encrypted images must stay with their matching vault.
- Shell/PTC execution requires the corresponding OS tools. External writes/tools are not a zero-trace environment.

Do not copy another user's `settings.json`, credentials, plugins, or vault into a public distribution. The application does not auto-import data from official DSH or earlier custom installations.

`DSH_PRIVATE_DATA_ROOT` selects a different data directory before launch. Set it before starting the app and keep it the same afterwards. To keep only the encrypted archives and private working folders elsewhere, for example on an external drive, set `"privateRoot"` in `settings.json` to an absolute folder. If that drive is not connected, private mode stays locked; normal mode still starts.

If a local model provider is already configured in DSH, for example by a local model plugin, set `"provider"` to its ID to reuse it for private chats. The core copies its settings (model names, context sizes, reasoning options) for Model A and Model B only. Its base URL must equal the loopback URL in Connection, and the built-in "Local model" entry is then not added to normal mode.

## Plugins

DSH Private is DSH with a private-mode core, so DSH plugins can be added to its profile as usual. The release ships none. While private mode is open, ordinary plugin tools are paused because they may write chat content to disk. A plugin takes part in private mode only through these optional services:

- `localImageGpu` with `runPrivate()`, `retryRecovery()` and `busy`: hands the GPU between the chat model and private image jobs.
- `privateStudioCompiler` with `describe()` and `prepare()`: supplies image workflows for private Studio. The core runs them in an encrypted workspace, encrypts the results and keeps them in the vault's private gallery.
- `privateEntryGuard` with `isBusy()`: keeps private mode closed while the plugin's own normal-mode job is still running.
- `localIncognitoEngine` with `snapshot()`, `selectPrivate(slot)`, `isPrivate()`, `activity()` and `stop()`: starts and stops local models for private mode. The built-in engine only checks that your server already serves the model. To let a plugin manage models instead, set `"modelEngine": "plugin"` in `settings.json`. Private chats still go only to the loopback server set in Connection.

## Private Studio

`private-studio.json` tells the core where to keep encrypted images and how to start your ComfyUI inside an encrypted, authenticated workspace. Every path must be absolute:

```json
{
  "version": 1,
  "enabled": true,
  "assetRoot": "D:/PrivateStudio/assets",
  "mountRoot": "D:/PrivateStudio/mounts",
  "mountDrive": "Y:",
  "securefsExe": "C:/Tools/securefs/securefs.exe",
  "securefsSha256": "<sha256 of securefs.exe>",
  "pythonExe": "C:/ComfyUI/python_embeded/python.exe",
  "pythonSha256": "<sha256 of python.exe>",
  "storagePolicy": "D:/PrivateStudio/storage-policy.json",
  "allowInitialCreate": true,
  "comfyDir": "C:/ComfyUI/ComfyUI",
  "pythonPaths": ["C:/ComfyUI/deps"],
  "extraModelPaths": ["C:/ComfyUI/extra_model_paths.yaml"]
}
```

- `comfyDir` is the folder that contains ComfyUI's `main.py`. `pythonExe` runs it; its hash is checked before every image job.
- `pythonPaths` (optional) are added in front of Python's search path, for example a folder of extra packages.
- `extraModelPaths` (optional) are passed to ComfyUI as `--extra-model-paths-config`.
- `assetRoot` holds encrypted images; `mountRoot` holds the encrypted temporary workspace that is mounted as `mountDrive` during a job. They must be separate folders and not on the mount drive.
- `allowInitialCreate: true` lets the app create the encrypted image store and its key the first time a vault uses Studio. Without it, Studio only opens a store that already exists.
- `storagePolicy` is a file you create after testing the storage: `status` `"verified"`, `writeReadbackPassed` and `deviceErrorsReviewed` `true`, a `verifiedAt` date, and the same `assetRoot` and `mountRoot`. New image jobs are blocked until it matches.

The image plugin decides which workflows exist and checks that their models are installed. Its `privateStudioCompiler.describe()` returns the catalog used by the private image window and the `generate_image` tool:

```json
{
  "workflows": [
    {
      "id": "draw",
      "label": "Draw",
      "fidelity": "fast",
      "fidelityLabel": "Fast",
      "selectable": true,
      "mask": false,
      "keepsInputSize": false,
      "defaults": { "steps": 25, "cfg": 4 },
      "parameters": [
        { "key": "strength", "label": "Strength", "type": "number", "default": 1, "step": 0.05 },
        {
          "key": "style",
          "label": "Style",
          "type": "select",
          "options": [{ "value": "", "label": "Off" }, { "value": "soft", "label": "Soft" }]
        }
      ]
    }
  ],
  "loras": [{ "assetId": "film", "name": "Film", "workflows": ["draw"], "defaultStrength": 0.8 }]
}
```

- Give one row per workflow and model profile (`fidelity`). A row with `selectable: false` is shown but cannot run.
- `mask: true` allows a mask image; `keepsInputSize: true` means the output follows the input size, so width and height are not sent.
- `defaults` fills the size and sampling fields when the workflow is chosen.
- `parameters` describes extra options of type `number`, `text`, `select` or `checkbox`. Their values arrive in `request.parameters`: at most 32 keys, each a number, a boolean or a string of up to 2,000 characters. The plugin checks what they mean.
- `prepare(request, inputCount, hasMask)` returns a plan with `verifyModels(signal)` and `transform(...)`, which produces the ComfyUI graph.

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
