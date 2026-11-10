# Development

[← Back to DSH Private](../README.md)

This repository contains the privacy app source and compiled Desktop overrides. The overrides target **DSH Desktop 2.0.14-beta.1**; changing the upstream version requires revalidation. See [NOTICE](../NOTICE.md) for attribution and licenses.

## Requirements

- Windows x64
- Python 3.11 or later
- Node.js 24 or later
- Windows `tar` (bsdtar), included with current Windows releases
- Internet access for the pinned Desktop and Node downloads

## Build a portable app

From a clean checkout at the desired release commit:

```powershell
python scripts/build.py
```

The output is `dist/DSH-Private`. The builder downloads the upstream archive listed in [`build-inputs.json`](../scripts/build-inputs.json), verifies its SHA-256, and extracts it without running its installer. It also checks the complete unpacked file tree against the pinned fingerprint before copying application files. Node 24.15.0 is separately hash-pinned. Existing app profiles are never imported, and existing output directories are never overwritten.

To reuse an already extracted copy, pass `--desktop-source "<unpacked-desktop-folder>"`. Its entire file tree must match the pinned archive; a matching version string alone is not accepted. Updating upstream means reviewing and updating both fingerprints and rerunning the integration checks.

## Formatting

Source files are formatted with Prettier (JavaScript, CSS, HTML) and Black (Python) so every change stays reviewable. `desktop-overrides/` is excluded because it must stay comparable with the upstream compiled modules.

```powershell
npm run format
python -m pip install black==24.10.0
python -m black app scripts test
```

To check without changing files, run `npm run format:check` and `python -m black --check app scripts test`.

## Run the checks

Run the focused privacy and portability regressions:

```powershell
npm test
python -m unittest discover -s test -p "*_test.py"
```

After building, test the actual private service with synthetic data:

```powershell
node scripts/smoke.mjs "dist/DSH-Private"
```

The tests cover encrypted temporary caches, killed-process recovery, active-owner preservation, link rejection, large-file save/reopen, wrong passwords, shutdown failures, and genuine versus false unsaved changes. Build tests reject changed upstream files, missing or modified output files, and dirty release sources.

The smoke check uses a mock local chat endpoint and a fresh synthetic vault. It exercises the packaged filesystem, MCP and execution-file adapters, the real private service, chat, encrypted readback, clean reopening, and shutdown. It removes its fixture and does not use your real model or vault.

Verify the complete build and package it:

```powershell
python scripts/verify_build.py "dist/DSH-Private" --require-clean-source
python scripts/package_release.py "dist/DSH-Private"
```

`BUILD.json` records the source commit and file-tree hash, dirty-source status, pinned upstream inputs, and every packaged file's SHA-256. Verification checks the manifest and compares the custom application files to the checkout. Release packaging requires a clean source tree and writes a ZIP plus `SHA256SUMS.txt` under `dist/release`. ZIP file order and timestamps are fixed; unsigned native runtimes are still inherited from the pinned upstream distribution.

## Public verification

The [Windows workflow](https://github.com/SparklingAstronaut/dsh-private/actions/workflows/verify.yml) runs on pushes to `main`, pull requests, and manual dispatch. It uses actions pinned to commit hashes, read-only repository permissions, and synthetic data. A successful run uploads the tested Windows ZIP, its checksum, and `build-verification.json` for 14 days. Release notes link to the exact successful run; release assets remain available independently of CI artifact retention.

These checks make the build inputs and tested output inspectable. They do not constitute a code signature, an independent security audit, or a claim that every optional external integration is covered.

Scan the source and portable distribution before publishing:

```powershell
python scripts/scan_release.py .
python scripts/scan_release.py "dist/DSH-Private"
```

For workstation-specific checks, add `--deny-file "<private-terms-file>"`, with one private term per line. Keep that file outside the repository. The scanner checks for forbidden data and obvious credential patterns; review the staged diff and release contents as well.

## Contribute

Use [Issues](https://github.com/SparklingAstronaut/dsh-private/issues) for reproducible bugs and feature proposals. For a pull request, describe the changed behavior and the checks you actually ran. Use synthetic fixtures, preserve existing encrypted archive compatibility, and avoid testing against a real user profile.

Never include passwords, credentials, private conversations, personal paths, or real vaults in an issue, pull request, screenshot, or release. See [privacy and security boundaries](../SECURITY.md).
