import { scope } from "./private-data.mjs";
import { LOCAL_PROVIDER } from "../../model-slots.mjs";
import { settings } from "../../portable-paths.mjs";
export const inject = ["tools", "llm", "systemPrompt"];
export function apply(ctx) {
  ctx.systemPrompt.section({
    name: "private-storage",
    order: 10,
    text: () =>
      [
        "This is a password-protected private session. Use the normal file and MCP tools. Diagnose MCP login with tool_status and sanitized error codes. Never read, print, quote, or copy authentication files or token values into chat or generated configs. A configured login is not proof that authentication is valid. Never infer token validity from its length. Private MCP downloads and job files live in the chat memory filesystem. After downloading, use the returned private_files paths and call read_image(file_path) to inspect images, or normal file tools to list/read files.",
        settings.shellAccess === true
          ? "Pwsh and .NET at the original virtual path can show an empty host directory; that does not mean the download failed. Never claim the MCP wrote to the host disk or redownload just because host listing is empty."
          : "",
        "Use job_status for job results. On disconnection, report the failed operation before retrying, since its outcome may be unknown. File writes and edits change a temporary per-chat copy, never the original host file. Tell the user that modified files remain temporary until they save the chat or explicitly export. Uploaded files, edits and MCP downloads are included when this chat is saved.",
        settings.shellAccess === true
          ? "Explicit program execution materializes input copies in the private execution directory and its files and changes can persist. When temporary files exist in the selected working directory, shell relative paths use the execution copy directory; use DSH_PRIVATE_FILES (JSON environment variable) to find mapped absolute paths, and DSH_PRIVATE_SOURCE_WORKDIR for the original directory. Untouched source files remain accessible by their original absolute paths. Execution results report the actual directory; read newly created program outputs by that absolute path. Do not assume executing a program removes its external or OS traces."
          : "Running programs (shell, PTC, workflows) is turned off in this private session; the user can allow it with shellAccess in settings.json.",
        settings.webAccess === true
          ? "Web search and page fetching send your queries and addresses to the internet; include only what the user wants sent."
          : "Web search and page fetching are turned off in this private session; the user can allow them with webAccess in settings.json.",
        "Plugins cannot be installed or enabled from a private chat; the user manages them on the Plugins page. Never claim an external service erases data when this app exits.",
      ]
        .filter(Boolean)
        .join(" "),
  });
  // Installed tools keep the normal registry and approval policy; persistence is owned by the private service adapters.
  ctx.on("tools/execute", (exec, next) => {
    if (globalThis.privateDeleting) throw Error("Private session deletion in progress");
    return scope.run(exec.agent?.session?.id, next);
  });
  ctx.on("llm/stream", (options, next) => {
    if (globalThis.privateDeleting) throw Error("Private session deletion in progress");
    if (globalThis.privateImageBusy) throw Error("请等待生图完成后再发送文字。");
    if (options.provider !== LOCAL_PROVIDER) throw Error("无痕模式只允许本地模型。");
    return (async function* () {
      await globalThis.privateEnsureModel(options.model);
      if (globalThis.privateDeleting) throw Error("Private session deletion in progress");
      globalThis.privateModelActivity?.(1);
      try {
        yield* next();
      } finally {
        globalThis.privateModelActivity?.(-1);
      }
    })();
  });
}
