import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { connectTarget } from "../app/addons/incognito/network-guard.mjs";

const guard = new URL("../app/addons/incognito/network-guard.mjs", import.meta.url).href;

test("connection targets are read from every net.Socket#connect form", () => {
  assert.deepEqual(connectTarget([{ host: "127.0.0.1", port: 1234 }]), { host: "127.0.0.1", port: 1234 });
  assert.deepEqual(connectTarget([[{ port: "80" }, () => {}]]), { host: "localhost", port: 80 });
  assert.deepEqual(connectTarget([443, "example.com"]), { host: "example.com", port: 443 });
  assert.deepEqual(connectTarget(["\\\\.\\pipe\\synthetic"]), { path: "\\\\.\\pipe\\synthetic" });
  assert.deepEqual(connectTarget([{ path: "/tmp/synthetic.sock", host: "127.0.0.1" }]), {
    path: "/tmp/synthetic.sock",
  });
});

// Runs in a separate process: the guard changes Node's network modules for the whole process.
const probe = `
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import dgram from "node:dgram";
import { installNetworkGuard } from ${JSON.stringify(guard)};
const received = [];
const listen = (handler) => new Promise((resolve) => {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1", () => resolve(server));
});
const other = await listen((req, res) => { received.push(req.url); res.end("other"); });
const otherUrl = "http://127.0.0.1:" + other.address().port;
const model = await listen((req, res) => {
  if (req.url === "/redirect") { res.writeHead(307, { Location: otherUrl + "/SYNTHETIC_CHAT_REDIRECT" }); res.end(); return; }
  res.end("model");
});
const modelUrl = "http://127.0.0.1:" + model.address().port + "/v1";
const blocked = [];
installNetworkGuard({ modelUrl, onBlocked: (what) => blocked.push(what) });
const outcome = async (fn) => { try { return "ok " + (await fn()); } catch (e) { return "error " + (e.code ?? e.cause?.code ?? e.message); } };
const socket = (connect) => new Promise((resolve, reject) => { const s = connect(); s.once("connect", () => { s.destroy(); resolve("connected"); }); s.once("error", reject); });
const result = {
  model: await outcome(async () => (await fetch(modelUrl + "/models")).text()),
  modelLocalhost: await outcome(async () => (await fetch(modelUrl.replace("127.0.0.1", "localhost") + "/models")).status),
  otherFetch: await outcome(async () => (await fetch(otherUrl + "/SYNTHETIC_CHAT_FETCH")).status),
  redirect: await outcome(async () => (await fetch(modelUrl.replace("/v1", "/redirect"))).status),
  otherHttp: await outcome(() => new Promise((resolve, reject) => http.get(otherUrl + "/SYNTHETIC_CHAT_HTTP", (r) => resolve(r.statusCode)).on("error", reject))),
  external: await outcome(() => new Promise((resolve, reject) => https.get("https://example.com/?SYNTHETIC_CHAT_HTTPS", (r) => resolve(r.statusCode)).on("error", reject))),
  netConnect: await outcome(() => socket(() => net.connect(other.address().port, "127.0.0.1"))),
  tlsConnect: await outcome(() => socket(() => tls.connect({ host: "127.0.0.1", port: other.address().port }))),
  pipe: await outcome(() => socket(() => net.connect(process.platform === "win32" ? "\\\\\\\\.\\\\pipe\\\\dsh-synthetic" : "/tmp/dsh-synthetic.sock"))),
  dnsLookup: await outcome(() => new Promise((resolve, reject) => dns.lookup("synthetic-chat.example.com", (e, a) => (e ? reject(e) : resolve(a))))),
  dnsPromise: await outcome(() => dns.promises.lookup("synthetic-chat.example.com")),
  dnsResolve: await outcome(() => dns.promises.resolveTxt("synthetic-chat.example.com")),
  dnsLocalhost: await outcome(() => dns.promises.lookup("localhost").then((a) => typeof a.address)),
  udp: await outcome(() => dgram.createSocket("udp4")),
};
other.close();
model.close();
console.log(JSON.stringify({ result, received, blocked: blocked.length }));
`;

test("the private chat process connects to the local model and nowhere else", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
    encoding: "utf8",
    timeout: 60000,
  });
  const { result, received, blocked } = JSON.parse(output.trim().split("\n").at(-1));
  assert.equal(result.model, "ok model");
  assert.equal(result.modelLocalhost, "ok 200");
  for (const key of ["otherFetch", "redirect", "otherHttp", "external", "netConnect", "tlsConnect", "pipe"])
    assert.equal(result[key], "error EACCES", key);
  for (const key of ["dnsLookup", "dnsPromise", "dnsResolve", "udp"])
    assert.equal(result[key], "error EACCES", key);
  assert.equal(result.dnsLocalhost, "ok string");
  // Nothing reached the other server, including the request the model server redirected.
  assert.deepEqual(received, []);
  assert(blocked >= 11);
});
