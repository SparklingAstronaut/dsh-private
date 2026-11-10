import path from "node:path";
import { resolvePrivatePath } from "../../portable-paths.mjs";

// Private MCP servers. "documents" is built in; any other name must be an adapter the user
// configured in settings.json under mcp.adapters. Adapters run inside the same in-memory sandbox
// (memory-mcp.py) as the built-in server and only see the read-only folders listed for them.
const SERVER_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;
const absolute = (value) => typeof value === "string" && path.isAbsolute(value);

export function validAdapter(adapter) {
  return (
    !!adapter &&
    typeof adapter === "object" &&
    absolute(adapter.file) &&
    adapter.file.toLowerCase().endsWith(".py") &&
    (adapter.readOnly === undefined || (Array.isArray(adapter.readOnly) && adapter.readOnly.every(absolute)))
  );
}

export function privateServers(names, adapters) {
  const configured = adapters && typeof adapters === "object" ? adapters : {};
  return [
    ...new Set(
      (Array.isArray(names) ? names : []).filter(
        (name) =>
          name === "documents" ||
          (typeof name === "string" &&
            SERVER_NAME.test(name) &&
            Object.hasOwn(configured, name) &&
            validAdapter(configured[name])),
      ),
    ),
  ];
}

/**
 * Host path of a model slot's folder inside the private tool sandbox. Files below it are copied
 * into the server's in-memory filesystem before a call.
 * @param {string} owner - model-a or model-b.
 * @returns {string} absolute folder path.
 */
export const ownerRoot = (owner) => path.join(resolvePrivatePath("private"), owner);
