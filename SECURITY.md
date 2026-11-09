# Privacy and security boundaries

Saved chat archives use AES-256-GCM authenticated encryption with scrypt-derived keys. Existing archive format compatibility is retained. The password is not recoverable. Only explicit saves are intended to persist chat content; unsaved changes remain temporary and normal shutdown cleans the app's working data.

This is **not** an anonymity tool, an OS sandbox, or a guarantee of forensic erasure. An unlocked app, malicious software, an administrator, paging/hibernation, OS crash dumps, backups, and screen capture can expose data. Connection settings and operational logs are not encrypted. Do not put secrets in model names or endpoint paths.

The chat endpoint must be HTTP on the local loopback interface. This prevents accidentally configuring a remote chat endpoint; it does not authenticate the local model server. Other local processes may reach that server. Its logging and retention settings are outside this app's control. DSH Private never terminates a model server started by the user.

DSH telemetry and upstream version checks are disabled in this build. Explicitly enabled tools, plugins, web/search services, Python/MCP integrations, or image servers can access files or networks according to their configuration. They are not made safe by encrypting the chat archive. Enable only integrations you trust. Model plugins and external processes may retain their own logs.

The current Windows preview is unsigned and has not received an independent security audit. Report reproducible bugs without including passwords, tokens, private conversations, or real vaults. Use synthetic data for public issues.
