// v1 → v2 迁移：读 v1（只读）→ 大文件流式化为资产（消除全量 base64）→ 保存快照（COMMIT）
// → v1 加密备份 → 迁移报告。失败不改 v1、不覆盖旧快照；重跑幂等。
import crypto from 'node:crypto';
import { realFs, err } from './fsport.mjs';
import { VaultV1Reader } from './vault-v1.mjs';
import { VaultV2 } from './vault-v2.mjs';
import { AssetStore, readCommit } from './store.mjs';

const SPILL_MIN = 1024 * 1024; // >1MiB 文件外置为资产（对齐 private-cache spill 阈值）

export async function migrateV1toV2({ srcPath, dstRoot, password, fsPort = realFs, rng = crypto.randomBytes, now = () => Date.now() }) {
  const reader = new VaultV1Reader({ fsPort });
  const v1 = await reader.read(srcPath, password); // 版本/密码/损坏错误在此抛出
  const backupPath = `${srcPath}.mig-backup`;

  // 1) 备份 v1（已是密文，整体复制；先备份后迁移）
  if (!fsPort.existsSync(backupPath)) fsPort.copyFileSync(srcPath, backupPath);

  // 2) v2 金库 + 资产库
  const vault = new VaultV2({ root: `${dstRoot}/vault`, fsPort });
  if (!vault.configured()) await vault.create(password);
  else await vault.unlock(password);
  const store = new AssetStore({ root: dstRoot, fsPort, rng, now });
  store.attachVault(vault);

  const report = { chats: 0, files: 0, bytes: 0, keptInline: 0, skipped: [], warnings: [], backupPath, revisions: [] };

  try {
  for (const chat of v1.chats) {
    const revision = `chat-${chat.id}`;
    if (readCommit(fsPort, `${dstRoot}/saved/${revision}/COMMIT`, revision)) {
      report.skipped.push({ chatId: chat.id, reason: 'already-migrated' }); // 幂等重跑（COMMIT 内容校验）
      continue;
    }
    const sessionId = `mig-${chat.id}`;
    store.createSession(sessionId);
    const refs = [];
    const record = { ...chat, messages: [] };
    for (const msg of chat.messages) {
      const m = { ...msg };
      if (m.files && typeof m.files === 'object') {
        const files = {};
        for (const [k, f] of Object.entries(m.files)) {
          if (f && typeof f.data === 'string' && !f.deleted) {
            const bytes = Buffer.from(f.data, 'base64');
            if (bytes.length > SPILL_MIN) {
              // 大文件 → 分块 AEAD 资产（引用化，消除整库 base64）
              const w = store.createEphemeral(sessionId, { kind: 'migrated-file', path: f.path ?? k, mime: f.mime ?? null });
              for (let i = 0; i < bytes.length; i += 4 * 1024 * 1024) w.writeChunk(bytes.subarray(i, Math.min(bytes.length, i + 4 * 1024 * 1024)));
              const ref = w.commit();
              files[k] = { assetId: ref.assetId, path: f.path ?? k, mime: f.mime ?? null, size: bytes.length, sha256: ref.sha256, migrated: true };
              refs.push({ assetId: ref.assetId });
              report.files += 1;
              report.bytes += bytes.length;
            } else {
              files[k] = f;
              report.keptInline += 1;
            }
          } else {
            files[k] = f;
            if (f?.deleted) report.warnings.push(`chat ${chat.id}: file ${k} marked deleted kept as tombstone`);
            if (f?.externalPath) report.warnings.push(`chat ${chat.id}: file ${k} references plaintext spill cache (externalPath) — 未迁移，需单独受控处理`);
          }
        }
        m.files = files;
      }
      record.messages.push(m);
    }
    // 聊天记录本体也作为资产（加密索引只留引用）
    const rw = store.createEphemeral(sessionId, { kind: 'migrated-chat-record', chatId: chat.id });
    const recBytes = Buffer.from(JSON.stringify(record), 'utf8');
    for (let i = 0; i < recBytes.length; i += 4 * 1024 * 1024) rw.writeChunk(recBytes.subarray(i, Math.min(recBytes.length, i + 4 * 1024 * 1024)));
    const recRef = rw.commit();
    refs.push({ assetId: recRef.assetId });

    const out = store.saveSnapshot(sessionId, revision, refs);
    report.revisions.push({ chatId: chat.id, revision, manifestHash: out.manifestHash });
    store.discardSession(sessionId); // 会话密钥销毁；已保存内容经 vault 密钥体系保留
    report.chats += 1;
  }
  return report;
  } finally {
    // Failure must not leave the derived persistent key resident in this object.
    vault.lock();
  }
}
