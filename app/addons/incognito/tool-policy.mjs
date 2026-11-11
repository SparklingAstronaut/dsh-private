// Which tools a private chat's AI gets. The agent modes (standard, ptc, minimal, cordis) are DSH's
// own presets from the web app bundle. Before the private chat process boots, every tool that can
// send chat content off this computer is turned off unless settings.json allows it:
//   "webAccess": true    web search and page fetching (carried out by the app, see web-rpc.mjs)
//   "shellAccess": true  programs: PowerShell, terminals, PTC programs and workflows. DSH's sandbox
//                        limits what programs write, not where they connect.
// The AI never gets plugin installation in private chats; the Plugins page asks the user first.
const WEB_TOOLS = new Set(["@deepseek-ai/dsh-tool-web"]);
const PROGRAM_TOOLS = new Set([
  "@deepseek-ai/dsh-tool-bash",
  "@deepseek-ai/dsh-tool-pwsh",
  "@deepseek-ai/dsh-tool-jobs",
  "@deepseek-ai/dsh-tool-bash-persistent",
  "@deepseek-ai/dsh-tool-pwsh-persistent",
  "@deepseek-ai/dsh-terminal",
  "@deepseek-ai/dsh-terminal-bash",
  "@deepseek-ai/dsh-workflow-ptc",
  "@deepseek-ai/dsh-tool-workflow",
  "@deepseek-ai/dsh-tool-ralph",
  "@deepseek-ai/dsh-agent-tool-presentation",
]);
const NEVER = new Set(["@deepseek-ai/dsh-plugin-manager/tools"]);
// Modes built around running programs; they are hidden while programs are off.
const PROGRAM_MODES = new Set(["ptc", "minimal"]);
const PRESET = "@deepseek-ai/dsh-agent-preset";
const isGroup = (row) => Array.isArray(row?.config) && (row.group === true || row.name === "cordis:group");

export function toolPolicy(settings = {}) {
  // Strict mode (strict-mode.mjs) has neither, whatever the two settings say.
  const strict = settings?.strictMode === true;
  const web = !strict && settings?.webAccess === true,
    programs = !strict && settings?.shellAccess === true;
  return {
    web,
    programs,
    off: (name) => NEVER.has(name) || (!web && WEB_TOOLS.has(name)) || (!programs && PROGRAM_TOOLS.has(name)),
    hidden: (mode) => !programs && PROGRAM_MODES.has(mode),
  };
}

// Edits the loader patch list in place and appends patches that keep host-level rows off.
export function applyToolPolicy(patches, settings) {
  const policy = toolPolicy(settings);
  const offIds = new Set();
  const tools = (rows) => {
    for (const row of rows ?? []) {
      if (!row || typeof row !== "object") continue;
      if (policy.off(row.name)) row.disabled = true;
      if (isGroup(row)) tools(row.config);
    }
  };
  const entries = (rows) => {
    for (const row of rows ?? []) {
      if (!row || typeof row !== "object") continue;
      if (row.name === PRESET) {
        if (policy.hidden(row.config?.id) && row.id) offIds.add(row.id);
        tools(row.config?.plugins);
      } else if (policy.off(row.name) && row.id) offIds.add(row.id);
      if (isGroup(row)) entries(row.config);
    }
  };
  for (const patch of patches) {
    if (!patch || typeof patch !== "object") continue;
    if (Array.isArray(patch.insert)) entries(patch.insert);
    // A saved preset edit replaces a mode's config, including its tool list.
    if (Array.isArray(patch.config?.plugins)) tools(patch.config.plugins);
  }
  // Applied last, so a later patch cannot switch these rows back on.
  for (const id of offIds) patches.push({ id, disabled: true });
  return patches;
}

// The app also refuses to run a program for a private chat while programs are off, whichever tool
// or plugin row asks, so a tool that is not in the lists above cannot run one either.
export function assertProgramsAllowed(settings) {
  if (!toolPolicy(settings).programs)
    throw Error('Programs are off in private mode. Set "shellAccess": true in settings.json to allow them.');
}

// DSH's own PowerShell limits (dsh-pwsh-local): 2 minutes unless the AI asks for another limit, and
// at most 10 minutes. The pwsh tool waits this long before it moves a command to the background, so
// the private chat process fills it in the same way the app does.
export const SHELL_TIMEOUT_MS = 120000;
export const SHELL_MAX_TIMEOUT_MS = 600000;
export function shellTimeout(requested) {
  if (requested !== undefined && (!Number.isFinite(requested) || requested <= 0))
    throw Error("timeoutMs must be a positive number of milliseconds");
  return Math.min(requested ?? SHELL_TIMEOUT_MS, SHELL_MAX_TIMEOUT_MS);
}
