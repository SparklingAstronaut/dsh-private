// Network boundary of the private chat process: it may connect to the local model server and
// nothing else. Every TCP client in Node (net, tls, http, https, http2, fetch and undici) connects
// through net.Socket, so the check sits there; DNS queries for other names and UDP are refused too.
// It applies to this worker thread only. Web search and page fetching, when turned on, are
// done by the app outside this process (private-web.mjs).
import net from "node:net";
import dns from "node:dns";
import dgram from "node:dgram";
import { syncBuiltinESMExports } from "node:module";

const loopback = (host) => {
  const h = String(host)
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "::1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
};

export function blockedError(target) {
  return Object.assign(Error("Private network destination blocked: " + target), { code: "EACCES" });
}

// net.Socket#connect(options | path | port, host?), or Node's internal [options, callback] form.
export function connectTarget(args) {
  const a = Array.isArray(args[0]) ? args[0] : args;
  const first = a[0];
  if (first !== null && typeof first === "object") {
    if (first.path !== undefined && first.path !== null) return { path: String(first.path) };
    return { host: String(first.host || "localhost"), port: Number(first.port) };
  }
  if (typeof first === "string" && !/^\d+$/.test(first)) return { path: first };
  return { host: typeof a[1] === "string" ? a[1] : "localhost", port: Number(first) };
}

// modelUrl: the local model server, the only destination allowed.
export function installNetworkGuard({ modelUrl, onBlocked = () => {} }) {
  const model = new URL(modelUrl);
  const port = Number(model.port || (model.protocol === "https:" ? 443 : 80));
  if (!loopback(model.hostname)) throw Error("The local model must be on this computer");
  const allowed = (t) => t.path === undefined && loopback(t.host) && t.port === port;
  const describe = (t) => (t.path !== undefined ? "pipe " + t.path : t.host + ":" + t.port);

  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const target = connectTarget(args);
    if (allowed(target)) return connect.apply(this, args);
    onBlocked(describe(target));
    // Fail the way an unreachable host does, so callers see an ordinary connection error.
    process.nextTick(() => this.destroy(blockedError(describe(target))));
    return this;
  };

  const refuse = (what) => {
    onBlocked(what);
    return blockedError(what);
  };
  const lookup = dns.lookup;
  dns.lookup = function (hostname, ...rest) {
    if (loopback(hostname)) return lookup.call(this, hostname, ...rest);
    const callback = rest.at(-1);
    const error = refuse("dns " + hostname);
    if (typeof callback !== "function") throw error;
    process.nextTick(callback, error);
  };
  const lookupAsync = dns.promises.lookup;
  dns.promises.lookup = function (hostname, ...rest) {
    if (loopback(hostname)) return lookupAsync.call(this, hostname, ...rest);
    return Promise.reject(refuse("dns " + hostname));
  };
  // Record queries go to DNS servers by name; nothing in a private chat needs them.
  const queries = Object.keys(dns).filter((k) => /^resolve|^reverse$|^lookupService$/.test(k));
  for (const name of queries) {
    dns[name] = (...args) => {
      const callback = args.at(-1);
      const error = refuse("dns " + name);
      if (typeof callback !== "function") throw error;
      process.nextTick(callback, error);
    };
    if (typeof dns.promises[name] === "function")
      dns.promises[name] = () => Promise.reject(refuse("dns " + name));
  }
  for (const Resolver of [dns.Resolver, dns.promises.Resolver])
    for (const name of Object.getOwnPropertyNames(Resolver.prototype))
      if (/^resolve|^reverse$/.test(name))
        Resolver.prototype[name] = function () {
          throw refuse("dns " + name);
        };

  dgram.createSocket = () => {
    throw refuse("udp");
  };
  for (const name of ["bind", "connect", "send"])
    dgram.Socket.prototype[name] = function () {
      throw refuse("udp");
    };
  syncBuiltinESMExports();
}
