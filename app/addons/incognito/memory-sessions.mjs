import { shareChildFiles } from "./session-family.mjs";
import { moduleOf } from "./imports.mjs";
const {
  SessionPersistence,
  SessionPersistenceNotFoundError,
  SessionAlreadyOwnedError,
  materializeCreateHeader,
  materializeAppendBatch,
  assertContiguous,
} = await moduleOf("@deepseek-ai/dsh-session-persistence");
export default class extends SessionPersistence {
  rows = new Map();
  writers = new Map();
  constructor(ctx) {
    super(ctx);
    globalThis.privateSessions = this;
    for (const row of globalThis.privateSeed.sessions || [])
      this.rows.set(row.header.id, structuredClone(row));
    shareChildFiles(this.rows);
    ctx.on("session/event", (s, e) => {
      this.writers.get(s.id)?.append([e]);
    });
    ctx.on("session/flush", () => {});
    ctx.on("session/disposed", (s) => this.writers.get(s.id)?.close());
    ctx.effect(() => () => {
      this.rows.clear();
      this.writers.clear();
    });
  }
  async create(header, options) {
    if (globalThis.privateDeleting) throw Error("Private session deletion in progress");
    header = materializeCreateHeader(header);
    if (this.rows.has(header.id)) throw Error("Session already exists");
    this.rows.set(header.id, { header, events: [], inheritedEventCount: options?.inheritedEventCount || 0 });
    shareChildFiles(this.rows);
    return this.open(header.id, "write");
  }
  async open(id, access) {
    const row = this.rows.get(id);
    if (!row) throw new SessionPersistenceNotFoundError(id);
    if (access === "write" && this.writers.has(id)) throw new SessionAlreadyOwnedError(id);
    let closed = false;
    const check = () => {
      if (closed || !this.rows.has(id)) throw Error("Session closed");
    };
    const h = {
      id,
      header: row.header,
      access,
      inheritedEventCount: row.inheritedEventCount || 0,
      read: async (offset = 0, length = Number.MAX_SAFE_INTEGER) => {
        check();
        return { eventState: "detached", events: structuredClone(row.events.slice(offset, offset + length)) };
      },
      append: async (events) => {
        check();
        if (globalThis.privateDeleting) throw Error("Private session deletion in progress");
        if (access !== "write") throw Error("Read only");
        const batch = materializeAppendBatch(events);
        assertContiguous(id, batch, row.events.length);
        row.events.push(...batch);
        globalThis.privateChanged?.();
      },
      flush: async () => check(),
      close: async () => {
        closed = true;
        if (this.writers.get(id) === h) this.writers.delete(id);
      },
    };
    h[Symbol.asyncDispose] = h.close;
    if (access === "write") this.writers.set(id, h);
    return h;
  }
  async stat(id) {
    const row = this.rows.get(id);
    return row ? { header: structuredClone(row.header), revision: "memory:" + row.events.length } : undefined;
  }
  async list() {
    return Promise.all([...this.rows.keys()].map((id) => this.stat(id)));
  }
  async flush() {}
}
