// 分块 AEAD 编解码（AES-256-GCM，node:crypto 成熟实现，不自造算法）。
// 块记录: seq u32 | nonce 12B | ctLen u32 | ciphertext | tag 16B
// AAD = DSH-asset-v1|assetId|seq|F/N|ptLen → 防重排/块替换；终止记录防截断。
import crypto from "node:crypto";

export const FILE_MAGIC = Buffer.from("DSHABLOB", "ascii");
export const FORMAT_VERSION = 1;
export const HEADER_SIZE = 16;
export const MAX_CHUNK = 4 * 1024 * 1024;
export const RECORD_OVERHEAD = 4 + 12 + 4 + 16;

export function newAssetId(rng = crypto.randomBytes) {
  return rng(16).toString("hex"); // 随机 ID，不含内容/原文件名信息
}

export function newAssetKey(rng = crypto.randomBytes) {
  return rng(32);
}

function aad(assetId, seq, isFinal, ptLen) {
  return Buffer.from(`DSH-asset-v1|${assetId}|${seq}|${isFinal ? "F" : "N"}|${ptLen}`, "utf8");
}

export function header() {
  const h = Buffer.alloc(HEADER_SIZE);
  FILE_MAGIC.copy(h, 0);
  h.writeUInt8(FORMAT_VERSION, 8);
  return h;
}

export function checkHeader(buf) {
  if (!buf || buf.length < HEADER_SIZE)
    throw Object.assign(new Error("blob: header too short"), { code: "blob-bad-header" });
  if (!buf.subarray(0, 8).equals(FILE_MAGIC))
    throw Object.assign(new Error("blob: bad magic"), { code: "blob-bad-header" });
  if (buf.readUInt8(8) !== FORMAT_VERSION)
    throw Object.assign(new Error("blob: unsupported version"), { code: "blob-bad-version" });
}

export function sealRecord(key, assetId, seq, isFinal, pt, rng = crypto.randomBytes) {
  const nonce = rng(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, nonce);
  c.setAAD(aad(assetId, seq, isFinal, pt.length));
  const ct = Buffer.concat([c.update(pt), c.final()]);
  const tag = c.getAuthTag();
  const head = Buffer.alloc(8);
  head.writeUInt32BE(seq, 0);
  head.writeUInt32BE(ct.length, 4);
  return Buffer.concat([head, nonce, ct, tag]);
}

export function openRecord(key, assetId, seq, isFinal, record) {
  if (record.length < 8 + 12 + 16)
    throw Object.assign(new Error("blob: record too short"), { code: "blob-bad-record" });
  const gotSeq = record.readUInt32BE(0);
  const ctLen = record.readUInt32BE(4);
  if (gotSeq !== seq) throw Object.assign(new Error("blob: sequence mismatch"), { code: "blob-reordered" });
  if (record.length !== 8 + 12 + ctLen + 16)
    throw Object.assign(new Error("blob: record length mismatch"), { code: "blob-bad-record" });
  const nonce = record.subarray(8, 20);
  const ct = record.subarray(20, 20 + ctLen);
  const tag = record.subarray(20 + ctLen);
  const d = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  d.setAAD(aad(assetId, seq, isFinal, ctLen)); // GCM 密文长度==明文长度，ctLen 即 ptLen
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]); // 任一篡改/错密钥在此抛错
}

// 解析一条记录（不验证）：返回 {seq, ctLen, nonce, ct, tag, totalLen}
export function parseRecord(record) {
  if (record.length < 8 + 12 + 16)
    throw Object.assign(new Error("blob: record too short"), { code: "blob-bad-record" });
  const seq = record.readUInt32BE(0);
  const ctLen = record.readUInt32BE(4);
  const total = 8 + 12 + ctLen + 16;
  return { seq, ctLen, total };
}

// 终止记录负载
export function finalPayload(chunkCount, totalLen, sha256, meta = null) {
  return Buffer.from(JSON.stringify({ chunkCount, totalLen, sha256, meta }), "utf8");
}

export function parseFinalPayload(buf) {
  const o = JSON.parse(buf.toString("utf8"));
  if (!Number.isInteger(o.chunkCount) || !Number.isInteger(o.totalLen) || typeof o.sha256 !== "string") {
    throw Object.assign(new Error("blob: bad final payload"), { code: "blob-bad-final" });
  }
  return o;
}

// 密钥封装（保存快照时把资产密钥包进持久密钥体系）
export function wrapKey(wrappingKey, key, rng = crypto.randomBytes) {
  const iv = rng(12);
  const c = crypto.createCipheriv("aes-256-gcm", wrappingKey, iv);
  const ct = Buffer.concat([c.update(key), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: ct.toString("base64") };
}

export function unwrapKey(wrappingKey, box) {
  const d = crypto.createDecipheriv("aes-256-gcm", wrappingKey, Buffer.from(box.iv, "base64"));
  d.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(box.data, "base64")), d.final()]);
}

// 小 JSON 封装（索引/manifest）
export function sealJson(key, obj, rng = crypto.randomBytes) {
  const iv = rng(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(obj), "utf8")), c.final()]);
  return JSON.stringify({
    v: FORMAT_VERSION,
    iv: iv.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
    data: ct.toString("base64"),
  });
}

export function unsealJson(key, s) {
  const box = JSON.parse(s);
  if (box.v !== FORMAT_VERSION)
    throw Object.assign(new Error("sealed json: version"), { code: "bad-version" });
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(box.iv, "base64"));
  d.setAuthTag(Buffer.from(box.tag, "base64"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, "base64")), d.final()]).toString("utf8"));
}
