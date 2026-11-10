// Model slot identifiers. They are stored in encrypted archives, name the
// owner-specific private folders and are passed to private MCP servers.
export const MODEL_A = "model-a";
export const MODEL_B = "model-b";
export const MODEL_SLOTS = Object.freeze([MODEL_A, MODEL_B]);

// The only LLM provider private mode accepts: the user's local server.
export const LOCAL_PROVIDER = "private-local";
// Environment variable that carries the placeholder key for that provider.
export const LOCAL_API_KEY_ENV = "DSH_PRIVATE_LOCAL_API_KEY";

// Preview 1-3 used internal names that came from a personal setup. Archives,
// MCP owners and session events written by those builds still contain them.
const LEGACY_SLOTS = Object.freeze({ Heretic: MODEL_A, QQZ: MODEL_B });
const LEGACY_PROVIDERS = Object.freeze(["qqz-kvmem"]);
export const LEGACY_SLOT_FOLDERS = Object.freeze(Object.entries(LEGACY_SLOTS));

/**
 * Map a current or Preview 1-3 slot name to the current identifier.
 * @param {unknown} value - slot name read from an archive, the UI or an MCP owner.
 * @returns {string | undefined} MODEL_A, MODEL_B, or undefined when unknown.
 */
export function normalizeModelSlot(value) {
  if (MODEL_SLOTS.includes(value)) return value;
  return typeof value === "string" && Object.hasOwn(LEGACY_SLOTS, value) ? LEGACY_SLOTS[value] : undefined;
}

/**
 * Rewrite Preview 1-3 provider ids inside saved session rows, in place.
 * Only object properties named "provider" with a legacy value are changed;
 * message text and every other field stay untouched.
 * @param {unknown} value - parsed archive data (session rows, events).
 * @returns {number} how many provider fields were rewritten.
 */
export function upgradeLegacyProviders(value) {
  let changed = 0;
  const stack = [value];
  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item)) {
      for (const child of item) stack.push(child);
      continue;
    }
    for (const [key, child] of Object.entries(item)) {
      if (key === "provider" && LEGACY_PROVIDERS.includes(child)) {
        item[key] = LOCAL_PROVIDER;
        changed++;
      } else if (child && typeof child === "object") stack.push(child);
    }
  }
  return changed;
}
