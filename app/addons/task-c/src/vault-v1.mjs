// v1 vault 只读兼容（格式复刻 addons/incognito/vault.mjs 语义）：
// JSON {version:1, kdf:'scrypt-131072-8-1', salt, box}; box=seal(key, {chats:[{key,box}]}),
// 聊天记录 seal(chatKey, record)；AAD='DSH incognito vault v1'；512MiB 整库上限（v1 固有缺陷）。
// 仅用于合成/用户明确解锁的数据；绝不修改源文件。
import crypto from "node:crypto";
import { promisify } from "node:util";
import { realFs, err } from "./fsport.mjs";
import { normalizeModelSlot } from "../../../model-slots.mjs";

const scrypt = promisify(crypto.scrypt);
const AAD_V1 = Buffer.from("DSH incognito vault v1", "utf8");
export const V1_KDF = "scrypt-131072-8-1";
export const V1_MAX_BYTES = 512 * 1024 * 1024;

export function sealV1(key, bytes, rng = crypto.randomBytes) {
  const iv = rng(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(AAD_V1);
  const ct = Buffer.concat([c.update(bytes), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: ct.toString("base64") };
}

export function unsealV1(key, box) {
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(box.iv, "base64"));
  d.setAAD(AAD_V1);
  d.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(box.data, "base64")), d.final()]);
}

async function deriveV1(password, saltB64) {
  if (typeof password !== "string" || password.length < 12 || password.length > 256)
    throw err("bad-password", "密码须为 12–256 个字符。");
  return scrypt(password, Buffer.from(saltB64, "base64"), 32, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
}

export class VaultV1Reader {
  constructor({ fsPort = realFs } = {}) {
    this.fsp = fsPort;
  }

  // 只读打开：不修改源文件；错误信息区分版本/密码/损坏
  async read(path, password) {
    const raw = this.fsp.readFileSync(path);
    if (raw.length > V1_MAX_BYTES) throw err("v1-too-large", "v1 整库超过 512MiB 上限（需先迁移）");
    let box;
    try {
      box = JSON.parse(raw);
    } catch {
      throw err("v1-corrupt", "v1 文件不是有效 JSON");
    }
    if (box.version === 1 && box.kdf === V1_KDF) {
      const key = await deriveV1(password, box.salt);
      let data;
      try {
        data = JSON.parse(unsealV1(key, box.box).toString("utf8"));
      } catch {
        key.fill(0);
        throw err("bad-password-or-corrupt", "密码不正确，或加密文件已损坏。");
      } finally {
        key.fill(0);
      }
      const chats = [];
      for (const row of data.chats ?? []) {
        const dk = Buffer.from(row.key, "base64");
        let record;
        try {
          record = JSON.parse(unsealV1(dk, row.box).toString("utf8"));
        } catch {
          dk.fill(0);
          throw err("bad-password-or-corrupt", "聊天记录解密失败。");
        } finally {
          dk.fill(0);
        }
        if (
          !/^[a-f0-9-]{36}$/.test(record.id) ||
          !normalizeModelSlot(record.model) ||
          !Array.isArray(record.messages)
        ) {
          throw err("v1-corrupt", "聊天记录结构不符合 v1 规范");
        }
        chats.push(record);
      }
      return { version: 1, chats };
    }
    // 版本拒绝：未知格式不静默解释
    throw err("bad-version", `不支持的 vault 版本: ${box.version ?? "unknown"}`);
  }
}

// 合成 v1 fixture 生成器（仅测试/回退演练用；不用于真实数据）
export class VaultV1TestWriter {
  static async build(password, chats, rng = crypto.randomBytes) {
    const salt = rng(16);
    const key = await scrypt(password, salt, 32, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
    const rows = chats.map((record) => {
      const dk = rng(32);
      return {
        key: dk.toString("base64"),
        box: sealV1(dk, Buffer.from(JSON.stringify(record), "utf8"), rng),
      };
    });
    const box = sealV1(key, Buffer.from(JSON.stringify({ chats: rows }), "utf8"), rng);
    key.fill(0);
    return JSON.stringify({ version: 1, kdf: V1_KDF, salt: salt.toString("base64"), box });
  }
}
