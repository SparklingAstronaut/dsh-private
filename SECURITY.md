# Privacy and security boundaries

Saved chat archives use AES-256-GCM authenticated encryption with scrypt-derived keys. Existing archive format compatibility is retained. The password is not recoverable. Only explicit saves are intended to persist chat content; unsaved changes remain temporary and normal shutdown cleans the app's working data.

Starting with Preview 3, large chat-file spill caches also use AES-256-GCM. Their random key exists only in the running process and its private worker; it is not written to disk or stored with the vault. Cache names use a keyed digest. Killing the process can leave encrypted cache files, but the next process does not have their key. Startup removes dead-owner cache directories and recognized Preview 1/2 plaintext cache directories before opening the password gate. It preserves live owners, rejects directory links, and stops startup if recovery fails. Saved vaults are outside these cleanup locations.

Explicit shell/PTC jobs still require plaintext working files. These are separate from the encrypted chat-file cache: normal shutdown removes their managed directories, and the next startup recovers marked directories belonging to dead processes before the password gate. A power failure, a reused process ID, another process holding a file open, or an external tool's own output can delay or prevent deletion. Optional tools are not an encrypted filesystem, and deletion is not secure erasure.

This is **not** an anonymity tool, an OS sandbox, or a guarantee of forensic erasure. An unlocked app, malicious software, an administrator, paging/hibernation, OS crash dumps, backups, and screen capture can expose data. Connection settings, operational logs, and your acknowledgement of DSH's internal-testing notice (kept in the normal DSH profile so the notice appears once) are not encrypted. Do not put secrets in model names or endpoint paths.

The chat endpoint must be HTTP on the local loopback interface. This prevents accidentally configuring a remote chat endpoint; it does not authenticate the local model server. Other local processes may reach that server. Its logging and retention settings are outside this app's control. DSH Private never terminates a model server started by the user.

DSH telemetry and upstream version checks are disabled in this build. Explicitly enabled tools, plugins, web/search services, Python/MCP integrations, or image servers can access files or networks according to their configuration. They are not made safe by encrypting the chat archive. Enable only integrations you trust. Model plugins and external processes may retain their own logs.

The current Windows preview is unsigned and has not received an independent security audit. Report reproducible bugs without including passwords, tokens, private conversations, or real vaults. Use synthetic data for public issues.

Public [Windows verification runs](https://github.com/SparklingAstronaut/dsh-private/actions/workflows/verify.yml) test source, download hash-pinned upstream inputs, build a portable app, exercise its real runtime with synthetic data, and verify the packaged files against source and a complete file manifest. Build provenance is recorded in `BUILD.json`; it is verifiable build evidence, not a code signature or an independent security audit.
