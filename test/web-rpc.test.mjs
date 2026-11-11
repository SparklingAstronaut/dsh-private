import test from "node:test";
import assert from "node:assert/strict";
import { MessageChannel } from "node:worker_threads";
import { assertWebAllowed, bindWebHost, bindWebWorker } from "../app/addons/incognito/web-rpc.mjs";

test("the app searches and fetches for a private chat only with webAccess on", () => {
  assert.throws(() => assertWebAllowed({}, true), /Web access is off/);
  assert.throws(() => assertWebAllowed({ webAccess: "true" }, true), /Web access is off/);
  assert.throws(() => assertWebAllowed({ webAccess: true }, false), /not active/);
  assert.doesNotThrow(() => assertWebAllowed({ webAccess: true }, true));
});

test("web requests from the private chat process are carried out by the app", async () => {
  const { port1: host, port2: worker } = new MessageChannel();
  const seen = [];
  const stop = bindWebHost(host, {
    search: async (request) => (
      seen.push(["search", request]), { sources: [{ url: "https://example.test/" }] }
    ),
    fetch: async (request) => {
      seen.push(["fetch", request]);
      if (request.url.includes("refused"))
        throw Object.assign(Error("refused by the app"), { code: "WEB_REDIRECT_BLOCKED" });
      return {
        url: request.url,
        statusCode: 200,
        body: { kind: "text", content: "synthetic" },
        truncated: false,
      };
    },
  });
  bindWebWorker(worker);
  try {
    assert.deepEqual(await globalThis.privateSearch({ queries: ["synthetic"] }), {
      sources: [{ url: "https://example.test/" }],
    });
    const page = await globalThis.privateWebFetch({ url: "https://example.test/page" });
    assert.equal(page.body.content, "synthetic");
    await assert.rejects(globalThis.privateWebFetch({ url: "https://example.test/refused" }), (e) => {
      assert.equal(e.code, "WEB_REDIRECT_BLOCKED");
      return /refused by the app/.test(e.message);
    });
    assert.deepEqual(
      seen.map(([kind]) => kind),
      ["search", "fetch", "fetch"],
    );
  } finally {
    stop();
    host.close();
    worker.close();
    delete globalThis.privateSearch;
    delete globalThis.privateWebFetch;
  }
});
