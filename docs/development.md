# Development

[← Back to DSH Private](../README.md)

This repository contains the privacy app source and compiled Desktop overrides. The overrides target **DSH Desktop 2.0.14-beta.1**; changing the upstream version requires revalidation. See [NOTICE](../NOTICE.md) for attribution and licenses.

## Requirements

- Windows x64
- Python 3.11 or later
- Node.js 24 or later
- An unpacked DSH Desktop **2.0.14-beta.1** application folder

## Build a portable app

From the repository root, replace the placeholder with your unpacked Desktop folder:

```powershell
python scripts/build.py --desktop-source "<unpacked-desktop-folder>"
```

The output is `dist/DSH-Private`. The builder copies only application binaries and libraries, applies the overrides, and downloads checksum-verified Node 24.15.0. It does not copy an existing app profile. It refuses to overwrite an existing output directory.

## Run the checks

Run the focused privacy and portability regressions:

```powershell
npm test
```

After building, test the actual private service with synthetic data:

```powershell
node scripts/smoke.mjs "dist/DSH-Private"
```

The smoke check uses a mock local chat endpoint, checks encrypted readback, and removes its fixture. It does not use your real model or vault.

Scan the source and portable distribution before publishing:

```powershell
python scripts/scan_release.py .
python scripts/scan_release.py "dist/DSH-Private"
```

For workstation-specific checks, add `--deny-file "<private-terms-file>"`, with one private term per line. Keep that file outside the repository. The scanner checks for forbidden data and obvious credential patterns; review the staged diff and release contents as well.

## Contribute

Use [Issues](https://github.com/SparklingAstronaut/dsh-private/issues) for reproducible bugs and feature proposals. For a pull request, describe the changed behavior and the checks you actually ran. Use synthetic fixtures, preserve existing encrypted archive compatibility, and avoid testing against a real user profile.

Never include passwords, credentials, private conversations, personal paths, or real vaults in an issue, pull request, screenshot, or release. See [privacy and security boundaries](../SECURITY.md).
