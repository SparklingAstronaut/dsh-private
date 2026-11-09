# DSH Private

A Windows desktop app for temporary local AI conversations and explicitly saved, password-encrypted archives. **Independent community preview; not an official DeepSeek or DSH Desktop release.**

[简体中文](README.zh-CN.md)

## Download and start

1. Download `DSH-Private-0.1.0-preview.2-windows-x64.zip` from [Releases](https://github.com/SparklingAstronaut/dsh-private/releases).
2. Extract the **entire** archive to a writable local folder. Run `DSH Private.exe`. Windows 10/11 x64 is required. This preview is not code-signed.
3. Start your own local OpenAI-compatible model server. In **Connection**, enter its loopback API URL (for example `http://127.0.0.1:1234/v1`), detect or enter its model ID, and save/restart. Model B is optional. No model weights or model server are included.
4. Generate a vault password, keep it somewhere safe, then unlock. There is no password recovery.
5. Conversations are temporary by default. Use the private chat menu to save an encrypted snapshot. Closing the app discards unsaved changes after confirmation.

Some advanced privacy and Studio dialogs currently use Chinese labels; core chat and setup support English.

Preview 2 fixes a false unsaved-content warning when reopening text-only archives. Existing encrypted archives remain compatible.

## What is included

- Password gate, temporary conversations, local model selection, encrypted saves, password changes, and deletion.
- Private session and attachment handling, shutdown/cleanup checks, and isolated app data.
- Existing image/Studio, tool execution, and MCP integration code. These integrations require the user's own runtimes and configuration; the portable preview does **not** bundle image models, Python environments, third-party accounts, or external tools. See [configuration](docs/configuration.md).
- The selected application icon and bundled Electron/DSH/Node runtime dependencies.

App data belongs to the current Windows user at `%APPDATA%\DSH-Private`. Saved archives are under `private\Incognito`; connection settings are in `settings.json`. This app does not import another DSH installation or its archives. Back up this directory before upgrading. Keep the vault password separately.

The model server is a separate application: DSH Private does not stop it or erase its logs. Read [privacy boundaries](SECURITY.md) before using sensitive data. This is a developer-tested preview, not an independently audited security product.

## Build and test

Source changes and compiled Desktop overrides are included here. No original workstation state or Git history is included.

- Windows, Python 3.11+, Node 24+, and an unpacked DSH Desktop **2.0.14-beta.1** are needed.
- `python scripts/build.py --desktop-source <unpacked-desktop-folder>` creates `dist/DSH-Private`. It copies only application binaries/libraries, applies this repository's overrides, and downloads checksum-verified Node 24.15.0. It never copies an existing app profile.
- `npm test` runs the focused privacy/portability regressions.
- `node scripts/smoke.mjs <portable-folder>` boots the actual private service with synthetic data, tests a mock local chat endpoint and encrypted readback, then removes its fixture. It does not use your real model or vault.
- `python scripts/scan_release.py <folder>` checks a source or distribution tree for forbidden data and obvious credential patterns. Add private terms with `--deny-file` for your own workstation before publishing.

The Desktop overrides are tied to the exact upstream version; a new upstream version requires revalidation. See [NOTICE](NOTICE.md) for upstream projects and licenses.
