import { resolvePrivatePath } from "../../portable-paths.mjs";
import { normalizeModelSlot, upgradeLegacyProviders } from "../../model-slots.mjs";
import fs from "node:fs";
import path from "node:path";
import {
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
  scrypt as scryptCallback,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
const aad = Buffer.from("DSH incognito vault v1");
export function seal(key, bytes) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(aad);
  return {
    iv: iv.toString("base64"),
    tag: null,
    data: Buffer.concat([c.update(bytes), c.final()]).toString("base64"),
    ...{ tag: c.getAuthTag().toString("base64") },
  };
}
export function unseal(key, box) {
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(box.iv, "base64"));
  d.setAAD(aad);
  d.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(box.data, "base64")), d.final()]);
}
async function derive(password, salt) {
  if (typeof password !== "string" || password.length < 12 || password.length > 256)
    throw Error("密码须为 12–256 个字符。");
  return scrypt(password, Buffer.from(salt, "base64"), 32, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
}
const hash = (b) => createHash("sha256").update(b).digest("hex");
export class Vault {
  constructor(root = resolvePrivatePath("private/Incognito")) {
    this.root = root;
    this.file = path.join(root, "vault.dshenc");
    this.key = null;
    this.studioSecret = null;
    this.chats = new Map();
    this.savedRecords = new Map();
    this.fingerprint = null;
    this.salt = null;
  }
  deleteRuntimeFamily(ids) {
    this.check();
    if (!(ids instanceof Set)) throw Error("Trusted session family required");
    const beforeChats = this.chats,
      beforeRecords = this.savedRecords,
      removed = [];
    const trim = (record) => ({
      ...record,
      ...(record.runtimeChildren
        ? { runtimeChildren: record.runtimeChildren.filter((row) => !ids.has(row.header.id)) }
        : {}),
      ...(record.studioChildAssets
        ? {
            studioChildAssets: Object.fromEntries(
              Object.entries(record.studioChildAssets).filter(([id]) => !ids.has(id)),
            ),
          }
        : {}),
    });
    this.chats = new Map();
    this.savedRecords = new Map();
    for (const [id, chat] of beforeChats) {
      if (ids.has(chat.runtime?.header.id)) removed.push(chat);
      else this.chats.set(id, trim(chat));
    }
    for (const [id, record] of beforeRecords) if (this.chats.has(id)) this.savedRecords.set(id, trim(record));
    try {
      this.write();
    } catch (error) {
      this.chats = beforeChats;
      this.savedRecords = beforeRecords;
      throw error;
    }
    for (const chat of removed) {
      chat.key.fill(0);
      chat.messages = [];
    }
  }
  // Drops one saved image revision from every saved snapshot and live chat index. The caller
  // journals the storage removal first (deleteSavedRevision) and reclaims it after this commit.
  removeStudioRevision(revision) {
    this.check();
    if (typeof revision !== "string" || !revision) throw Error("Invalid image revision");
    const strip = (list) => (Array.isArray(list) ? list.filter((link) => link?.revision !== revision) : list);
    const trim = (record) => ({
      ...record,
      ...(record.studioAssets ? { studioAssets: strip(record.studioAssets) } : {}),
      ...(record.studioChildAssets
        ? {
            studioChildAssets: Object.fromEntries(
              Object.entries(record.studioChildAssets).map(([id, list]) => [id, strip(list)]),
            ),
          }
        : {}),
    });
    const before = this.savedRecords;
    this.savedRecords = new Map([...before].map(([id, record]) => [id, trim(record)]));
    try {
      this.write();
    } catch (error) {
      this.savedRecords = before;
      throw error;
    }
    for (const chat of this.chats.values()) {
      if (chat.studioAssets) chat.studioAssets = strip(chat.studioAssets);
      if (chat.studioChildAssets)
        chat.studioChildAssets = Object.fromEntries(
          Object.entries(chat.studioChildAssets).map(([id, list]) => [id, strip(list)]),
        );
    }
  }
  available() {
    return fs.existsSync(path.parse(path.resolve(this.root)).root);
  }
  configured() {
    return fs.existsSync(this.file);
  }
  check() {
    if (!this.key) throw Error("请先解锁无痕模式。");
    if (!this.available() || !fs.existsSync(this.file)) {
      this.lock();
      throw Error("本机加密目录或加密存储不可用，已锁定。");
    }
    if (hash(fs.readFileSync(this.file)) !== this.fingerprint) {
      this.lock();
      throw Error("加密文件被外部更改，已锁定。");
    }
  }
  lock() {
    this.studioSecret?.fill(0);
    this.studioSecret = null;
    this.key?.fill(0);
    this.key = null;
    for (const c of this.chats.values()) c.key.fill(0);
    this.chats.clear();
    this.savedRecords.clear();
    this.salt = null;
    this.fingerprint = null;
  }
  async initialize(password = randomBytes(24).toString("base64url"), allowed = () => true) {
    if (this.configured()) throw Error("已设置密码。");
    if (!this.available()) throw Error("请连接 本机加密目录。");
    const salt = randomBytes(16).toString("base64"),
      key = await derive(password, salt);
    if (!allowed()) {
      key.fill(0);
      throw Error("操作已取消。");
    }
    this.salt = salt;
    this.key = key;
    fs.mkdirSync(this.root, { recursive: true });
    try {
      this.write(true);
    } finally {
      this.lock();
    }
    return password;
  }
  async unlock(password) {
    if (this.key) throw Error("已经解锁。");
    if (!this.available() || !this.configured()) throw Error("加密存储不可用。");
    const raw = fs.readFileSync(this.file);
    if (raw.length > 512 * 1024 * 1024) throw Error("加密文件过大。");
    let key;
    try {
      const box = JSON.parse(raw);
      if (![1, 2].includes(box.version) || box.kdf !== "scrypt-131072-8-1") throw Error();
      key = await derive(password, box.salt);
      const data = JSON.parse(unseal(key, box.box));
      if (
        box.version === 2 &&
        (typeof data.studioSecret !== "string" || !/^[a-f0-9]{64}$/.test(data.studioSecret))
      )
        throw Error();
      this.studioSecret = box.version === 2 ? Buffer.from(data.studioSecret, "hex") : null;
      const chats = new Map();
      for (const row of data.chats) {
        const dk = Buffer.from(row.key, "base64");
        const record = JSON.parse(unseal(dk, row.box));
        const model = normalizeModelSlot(record.model);
        if (!/^[a-f0-9-]{36}$/.test(record.id) || !model || !Array.isArray(record.messages)) throw Error();
        // Preview 1-3 archives use the old slot and provider names; the next save stores the new ones.
        record.model = model;
        upgradeLegacyProviders(record.runtime);
        upgradeLegacyProviders(record.runtimeChildren);
        chats.set(record.id, { ...record, key: dk, saved: true, pending: false });
      }
      this.key = key;
      this.salt = box.salt;
      this.chats = chats;
      this.savedRecords = new Map(
        [...chats].map(([id, { key, pending, ...record }]) => [id, structuredClone(record)]),
      );
      this.fingerprint = hash(raw);
    } catch {
      key?.fill(0);
      this.lock();
      throw Error("密码不正确，或加密文件已损坏。");
    }
  }
  write(initial = false) {
    if (!initial) this.check();
    const rows = [];
    for (const chat of this.chats.values())
      if (chat.saved) {
        const { key } = chat;
        const record = this.savedRecords.get(chat.id);
        if (!record) throw Error("Missing explicit saved snapshot");
        rows.push({ key: key.toString("base64"), box: seal(key, Buffer.from(JSON.stringify(record))) });
      }
    const raw = Buffer.from(
      JSON.stringify({
        version: this.studioSecret ? 2 : 1,
        kdf: "scrypt-131072-8-1",
        salt: this.salt,
        box: seal(
          this.key,
          Buffer.from(
            JSON.stringify({
              chats: rows,
              ...(this.studioSecret ? { studioSecret: this.studioSecret.toString("hex") } : {}),
            }),
          ),
        ),
      }),
    );
    if (raw.length > 512 * 1024 * 1024) throw Error("加密存储已达到 512 MB 上限。");
    const temp = this.file + "." + randomUUID() + ".tmp";
    let fd;
    try {
      fd = fs.openSync(temp, "wx");
      fs.writeFileSync(fd, raw);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
      fs.renameSync(temp, this.file);
      this.fingerprint = hash(raw);
    } catch {
      if (fd !== null && fd !== undefined) fs.closeSync(fd);
      try {
        fs.unlinkSync(temp);
      } catch {}
      throw Error("保存失败；未改存到其他磁盘。");
    }
  }
  getStudioSecret({ create = false } = {}) {
    this.check();
    if (!this.studioSecret) {
      if (!create) throw Error("Image storage is not configured");
      const backup = this.file + ".pre-studio-v1";
      if (!fs.existsSync(backup)) fs.copyFileSync(this.file, backup, fs.constants.COPYFILE_EXCL);
      this.studioSecret = randomBytes(32);
      try {
        this.write();
      } catch (e) {
        this.studioSecret.fill(0);
        this.studioSecret = null;
        throw e;
      }
    }
    return Buffer.from(this.studioSecret);
  }
  create(model) {
    this.check();
    model = normalizeModelSlot(model);
    if (!model) throw Error("无痕模式仅支持模型 A / 模型 B。");
    const id = randomUUID();
    this.chats.set(id, {
      id,
      model,
      title: "新聊天",
      messages: [],
      saved: false,
      pending: false,
      key: randomBytes(32),
    });
    return id;
  }
  get(id) {
    this.check();
    const c = this.chats.get(id);
    if (!c) throw Error("聊天不存在或已删除。");
    return c;
  }
  save(id) {
    const c = this.get(id),
      previous = c.saved,
      oldRecord = this.savedRecords.get(id);
    const { key, pending, ...record } = c;
    const captured = structuredClone({ ...record, saved: true });
    c.saved = true;
    this.savedRecords.set(id, captured);
    try {
      this.write();
    } catch (e) {
      c.saved = previous;
      if (oldRecord) this.savedRecords.set(id, oldRecord);
      else this.savedRecords.delete(id);
      throw e;
    }
  }
  delete(id) {
    const c = this.get(id);
    this.chats.delete(id);
    try {
      if (c.saved) this.write();
    } catch (e) {
      this.chats.set(id, c);
      throw e;
    }
    this.savedRecords.delete(id);
    c.key.fill(0);
    c.messages = [];
  }
  removeSavedDescendants(ids) {
    this.check();
    const before = this.savedRecords;
    this.savedRecords = new Map(
      [...before].map(([id, record]) => [
        id,
        {
          ...record,
          ...(record.studioChildAssets
            ? {
                studioChildAssets: Object.fromEntries(
                  Object.entries(record.studioChildAssets).filter(([childId]) => !ids.has(childId)),
                ),
              }
            : {}),
          ...(record.runtimeChildren
            ? { runtimeChildren: record.runtimeChildren.filter((r) => !ids.has(r.header.id)) }
            : {}),
        },
      ]),
    );
    try {
      this.write();
    } catch (e) {
      this.savedRecords = before;
      throw e;
    }
    for (const c of this.chats.values()) {
      if (c.runtimeChildren) c.runtimeChildren = c.runtimeChildren.filter((r) => !ids.has(r.header.id));
      if (c.studioChildAssets)
        c.studioChildAssets = Object.fromEntries(
          Object.entries(c.studioChildAssets).filter(([childId]) => !ids.has(childId)),
        );
    }
  }
  async changePassword(oldPassword, newPassword) {
    this.check();
    const old = await derive(oldPassword, this.salt);
    try {
      unseal(old, JSON.parse(fs.readFileSync(this.file)).box);
    } catch {
      throw Error("当前密码不正确。");
    } finally {
      old.fill(0);
    }
    const salt = randomBytes(16).toString("base64"),
      key = await derive(newPassword, salt);
    this.check();
    const previous = this.key,
      previousSalt = this.salt;
    this.key = key;
    this.salt = salt;
    try {
      this.write();
      previous.fill(0);
    } catch (e) {
      key.fill(0);
      this.key = previous;
      this.salt = previousSalt;
      throw e;
    }
  }
  snapshot() {
    this.check();
    return [...this.chats.values()].map(({ key, ...c }) => structuredClone(c));
  }
}
