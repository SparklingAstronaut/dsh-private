import { settings } from "../../portable-paths.mjs";
export const name = "private-web";
export const inject = ["web"];
// Web search and page fetching for private chats, only with "webAccess": true in settings.json.
// The app carries them out (web-rpc.mjs); this process never connects to the internet itself.
export function apply(ctx) {
  if (settings.webAccess !== true) return;
  ctx.web.registerSearchProvider({
    id: "private-search",
    available: () => true,
    search: (request, signal) => globalThis.privateSearch(request, signal),
  });
  ctx.web.registerFetchProvider({
    id: "private-fetch",
    available: () => true,
    fetch: (request, signal) => globalThis.privateWebFetch(request, signal),
  });
}
