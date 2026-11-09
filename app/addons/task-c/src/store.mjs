// 资产库生命周期：ephemeral 分块 AEAD 资产、加密索引、显式保存快照（可恢复提交协议）、
// 清理/孤儿回收、失败阻塞。契约：work/task-c/design.md §2–§4。
// 审查修复（REVIEW-C）：B1 存活进程保护；M1 保存状态事务化；M2 阻塞定向解除；
// M3 COMMIT 内容校验；M4 路径段校验；M5 读取真流式。
import crypto from 'node:crypto';
import { realFs, ensureDir, err, confinedFs } from './fsport.mjs';
import {
  header, checkHeader, sealRecord, openRecord, parseRecord,
  finalPayload, parseFinalPayload, newAssetId, newAssetKey, MAX_CHUNK, sealJson,
} from './crypto.mjs';

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/; // 路径段白名单（M4）：无点/分隔符
export function processMayBeAlive(pid, probe = process.kill) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return true;
  try { probe(pid, 0); return true; }
  catch (error) { return error?.code !== 'ESRCH'; }
}
function checkId(v, what) {
  if (typeof v !== 'string' || !ID_RE.test(v) || v === '.' || v === '..') {
    throw err('bad-id', `${what} 含非法路径字符`);
  }
  return v;
}

// 流式读取 blob 记录（M5）：不整文件缓冲；逐记录验证解密
function* readBlobRecords(fsp, file, key, assetId) {
  const fd = fsp.openSync(file, 'r');
  try {
    const head = Buffer.alloc(16);
    if (fsp.readSync(fd, head, 0, 16, 0) !== 16) throw err('blob-bad-header', 'blob: header too short');
    checkHeader(head);
    let pos = 16, seq = 0, sawFinal = false;
    for (;;) {
      const rh = Buffer.alloc(8);
      const n = fsp.readSync(fd, rh, 0, 8, pos);
      if (n === 0) break;
      if (n !== 8) throw err('blob-bad-record', 'blob: truncated record header');
      const ctLen = rh.readUInt32BE(4);
      if (ctLen > MAX_CHUNK) throw err('blob-bad-record', 'blob: record exceeds chunk limit');
      const recLen = 8 + 12 + ctLen + 16;
      const rec = Buffer.alloc(recLen);
      if (fsp.readSync(fd, rec, 0, recLen, pos) !== recLen) throw err('blob-bad-record', 'blob: truncated record');
      pos += recLen;
      const isLast = fsp.readSync(fd, Buffer.alloc(1), 0, 1, pos) === 0; // 后面无记录即终止记录
      if (sawFinal) throw err('blob-bad-final', 'blob: records after final');
      const pt = openRecord(key, assetId, seq, isLast, rec);
      if (isLast) { sawFinal = true; yield { final: parseFinalPayload(pt) }; }
      else { yield { chunk: pt, seq }; seq += 1; }
    }
    if (!sawFinal) throw err('blob-truncated', 'missing final record');
  } finally { fsp.closeSync(fd); }
}

function verifyBlob(fsp, file, key, assetId, expect = null) {
  let totalLen = 0, seq = 0;
  const hash = crypto.createHash('sha256');
  let fin = null;
  for (const rec of readBlobRecords(fsp, file, key, assetId)) {
    if (rec.final) fin = rec.final;
    else { totalLen += rec.chunk.length; hash.update(rec.chunk); seq += 1; }
  }
  const sha256 = hash.digest('hex');
  if (!fin || fin.chunkCount !== seq || fin.totalLen !== totalLen || fin.sha256 !== sha256) {
    throw err('blob-corrupt', 'final record mismatch');
  }
  if (expect && (expect.sha256 !== fin.sha256 || expect.totalLen !== fin.totalLen || expect.chunkCount !== fin.chunkCount)) {
    throw err('blob-corrupt', 'registry mismatch');
  }
  return fin;
}

export class AssetStore {
  constructor({ root, fsPort = realFs, rng = crypto.randomBytes, now = () => Date.now(), isPidAlive = processMayBeAlive, snapshotOwner = null }) {
    this.snapshotOwner = snapshotOwner;
    this.root = root;
    this.fsp = confinedFs(root, fsPort);
    this.exportFs = fsPort;
    this.rng = rng;
    this.now = now;
    this.isPidAlive = isPidAlive;
    this.sessions = new Map();
    this.vault = null;
    this.blockReasons = []; // {kind, target, message}
    this._locks = new Set();
  }

  attachVault(vault) { this.vault = vault; }

  // Exclusive filesystem creation coordinates independent processes. A lock left
  // by a crash is deliberately not stolen: recovery must establish ownership.
  _withSnapshotLock(action) {
    if (this.snapshotOwner) return this.snapshotOwner.run(this.root, action);
    ensureDir(this.fsp, this.root);
    const file = `${this.root}/snapshot.lock`;
    let fd;
    try { fd = this.fsp.openSync(file, 'wx'); }
    catch (e) {
      if (e.code === 'EEXIST') throw err('store-busy', 'Snapshot storage is locked; retry after the owner finishes');
      throw e;
    }
    try { return action(); }
    finally {
      this.fsp.closeSync(fd);
      this.fsp.unlinkSync(file);
    }
  }

  _block(kind, target, message) {
    this.blockReasons.push({ kind, target, message });
  }

  // ---------- 会话 ----------
  createSession(sessionId) {
    checkId(sessionId, 'sessionId');
    if (this.sessions.has(sessionId)) throw err('session-exists', 'session already exists');
    if (this.blockReasons.length) throw err('cleanup-blocked', `清理失败阻塞新任务: ${this.blockReasons.map(r => r.message).join('; ')}`);
    const key = this.rng(32);
    const dir = `${this.root}/ephemeral/${sessionId}`;
    ensureDir(this.fsp, `${this.root}/ephemeral`);
    try { this.fsp.mkdirSync(dir); }
    catch (e) {
      key.fill(0);
      if (e.code === 'EEXIST') throw err('session-exists', 'session directory already exists');
      throw e;
    }
    // 先写 SESSION 标记（token+PID+时间）：孤儿判定依据（B1）
    const token = this.rng(16).toString('hex');
    try { this.fsp.writeFileSync(`${dir}/SESSION`, JSON.stringify({ token, pid: process.pid, startedAt: this.now() })); }
    catch (error) {
      key.fill(0);
      this._block('session-init', sessionId, 'Session ownership marker could not be written');
      throw error;
    }
    this.sessions.set(sessionId, { key, assets: new Map(), writers: new Set(), state: 'active', dir, token });
    return sessionId;
  }

  _session(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) throw err('no-session', 'session not found');
    return s;
  }

  // ---------- 写入 ----------
  createEphemeral(sessionId, metadata = {}) {
    const s = this._session(sessionId);
    if (s.state !== 'active') throw err('bad-state', `session ${s.state}`);
    const assetId = newAssetId(this.rng);
    const key = newAssetKey(this.rng);
    const file = `${s.dir}/${assetId}.blob`;
    let fd;
    try { fd = this.fsp.openSync(file, 'wx'); }
    catch (e) { key.fill(0); throw e; }
    const w = {
      assetId, sessionId, key, file, fd,
      seq: 0, totalLen: 0, hash: crypto.createHash('sha256'), state: 'writing', metadata,
      writeChunk: (bytes) => this._writeChunk(w, bytes),
      commit: () => this._commit(w),
      abort: () => this._abort(w),
    };
    s.writers.add(w);
    try { this.fsp.writeSync(fd, header()); }
    catch (e) { this._abort(w); throw e; }
    return w;
  }

  _writeChunk(w, bytes) {
    if (w.state !== 'writing') throw err('bad-state', 'writer not writing');
    if (this._session(w.sessionId).state !== 'active') throw err('bad-state', 'session not active');
    if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
    if (bytes.length === 0) return { ok: true, buffered: 0 };
    if (bytes.length > MAX_CHUNK) throw err('chunk-too-large', `chunk > ${MAX_CHUNK}`);
    this.fsp.writeSync(w.fd, sealRecord(w.key, w.assetId, w.seq, false, bytes, this.rng));
    w.seq += 1;
    w.totalLen += bytes.length;
    w.hash.update(bytes);
    return { ok: true, buffered: 0 }; // 同步落盘即背压
  }

  _commit(w) {
    if (w.state !== 'writing') throw err('bad-state', `writer ${w.state}`);
    if (this._session(w.sessionId).state !== 'active') throw err('bad-state', 'session not active');
    const sha256 = w.hash.digest('hex');
    this.fsp.writeSync(w.fd, sealRecord(w.key, w.assetId, w.seq, true,
      finalPayload(w.seq, w.totalLen, sha256, w.metadata), this.rng));
    this.fsp.fsyncSync(w.fd);
    this.fsp.closeSync(w.fd);
    w.fd = null;
    w.state = 'committed';
    const s = this._session(w.sessionId);
    s.writers.delete(w);
    s.assets.set(w.assetId, {
      assetId: w.assetId, key: w.key, file: w.file, state: 'committed',
      chunkCount: w.seq, totalLen: w.totalLen, sha256, metadata: w.metadata,
    });
    this._writeIndex(w.sessionId);
    return { assetId: w.assetId, sessionId: w.sessionId, totalLen: w.totalLen, sha256 };
  }

  _abort(w) {
    if (w.state === 'aborted') return; // 幂等
    if (w.state === 'committed') throw err('bad-state', 'committed assets require session disposal');
    w.state = 'abort-pending';
    w.key.fill(0);
    try {
      if (w.fd !== null) { this.fsp.closeSync(w.fd); w.fd = null; }
      try { this.fsp.unlinkSync(w.file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      w.state = 'aborted';
      this.sessions.get(w.sessionId)?.writers.delete(w);
      this.blockReasons = this.blockReasons.filter(r => !(r.kind === 'writer' && r.target === w.file));
    } catch (e) {
      this._block('writer', w.file, `writer cleanup failed: ${e.code ?? 'unknown'}`);
      throw err('cleanup-failed', 'Writer cleanup failed; private tasks blocked');
    }
  }

  _writeIndex(sessionId) {
    const s = this._session(sessionId);
    const index = {
      version: 1, sessionId,
      assets: [...s.assets.values()].map(a => ({
        assetId: a.assetId, state: a.state, chunkCount: a.chunkCount,
        totalLen: a.totalLen, sha256: a.sha256, metadata: a.metadata,
      })),
    };
    this.fsp.writeFileSync(`${s.dir}/index.enc`, sealJson(s.key, index));
  }

  // ---------- 读取（流式，M5） ----------
  *openRead(assetRef, caller) {
    const { sessionId, assetId } = assetRef ?? {};
    if (caller?.sessionId !== sessionId) throw err('forbidden', 'cross-session read denied');
    checkId(sessionId, 'sessionId'); checkId(assetId, 'assetId');
    const s = this._session(sessionId);
    const a = s.assets.get(assetId);
    if (!a || a.state === 'discarded') throw err('no-asset', 'asset not found');
    let totalLen = 0, seq = 0;
    const hash = crypto.createHash('sha256');
    let fin = null;
    for (const rec of readBlobRecords(this.fsp, a.file, a.key, assetId)) {
      if (rec.final) fin = rec.final;
      else {
        yield rec.chunk;
        totalLen += rec.chunk.length;
        hash.update(rec.chunk);
        seq += 1;
      }
    }
    if (!fin || fin.chunkCount !== seq || fin.totalLen !== totalLen || fin.sha256 !== hash.digest('hex')) {
      throw err('blob-corrupt', 'final record mismatch');
    }
    if (a.sha256 !== fin.sha256 || a.totalLen !== fin.totalLen) throw err('blob-corrupt', 'registry mismatch');
  }

  readAll(assetRef, caller) {
    return Buffer.concat([...this.openRead(assetRef, caller)]);
  }

  preview(assetRef, caller, maxBytes) {
    const out = [];
    let n = 0;
    for (const chunk of this.openRead(assetRef, caller)) {
      out.push(n + chunk.length <= maxBytes ? chunk : chunk.subarray(0, Math.max(0, maxBytes - n)));
      n += chunk.length;
      if (n >= maxBytes) break;
    }
    return Buffer.concat(out);
  }

  // ---------- 保存快照（显式；新内容不自动持久化） ----------
  saveSnapshot(sessionId, revision, refs) {
    return this._withSnapshotLock(() => this._saveSnapshot(sessionId, revision, refs));
  }

  // Roll back only the exact newly-created snapshot receipt. An idempotent save
  // has no manifestHash receipt and cannot authorize deleting an older snapshot.
  rollbackSnapshot(receipt) {
    return this._withSnapshotLock(() => {
      const revision=checkId(receipt?.revision,'revision');
      if(!/^[a-f0-9]{64}$/.test(receipt?.manifestHash??'')||receipt.idempotent)throw err('invalid-rollback-receipt');
      if(!this.vault?.unlocked)throw err('vault-locked');
      const dir=`${this.root}/saved/${revision}`;
      if(!this.fsp.existsSync(dir))return {ok:true,idempotent:true};
      const commit=readCommit(this.fsp,`${dir}/COMMIT`,revision);
      if(!commit||commit.manifestHash!==receipt.manifestHash)throw err('rollback-snapshot-changed');
      const manifest=this.vault.unseal(this.fsp.readFileSync(`${dir}/manifest.enc`,'utf8'));
      verifyManifest(commit,manifest,revision);
      this.fsp.rmSync(dir,{recursive:true,force:false});
      return {ok:true};
    });
  }

  snapshotReceipt(revision){
    checkId(revision,'revision');
    if(!this.vault?.unlocked)throw err('vault-locked');
    const dir=`${this.root}/saved/${revision}`;
    if(!this.fsp.existsSync(dir))return null;
    const commit=readCommit(this.fsp,`${dir}/COMMIT`,revision);
    if(!commit)throw err('snapshot-commit-invalid');
    const manifest=this.vault.unseal(this.fsp.readFileSync(`${dir}/manifest.enc`,'utf8'));
    verifyManifest(commit,manifest,revision);
    return {revision,manifestHash:commit.manifestHash,assetIds:manifest.assets.map(item=>item.assetId)};
  }

  _saveSnapshot(sessionId, revision, refs) {
    checkId(revision, 'revision');
    const s = this._session(sessionId);
    if (s.state === 'discarded') throw err('bad-state', 'session discarded');
    if (!this.vault?.unlocked) throw err('vault-locked', '保存需要已解锁的持久金库');
    const lockKey = `save:${sessionId}`;
    if (this._locks.has(lockKey)) throw err('busy', 'save already in progress');
    this._locks.add(lockKey);
    const finalDir = `${this.root}/saved/${revision}`;
    const tmpDir = `${finalDir}.tmp`;
    const touched = [];
    try {
      const existing = readCommit(this.fsp, `${finalDir}/COMMIT`, revision);
      if (existing) {
        // 重复保存幂等；但 refs 必须一致（minor：不同 refs 不得静默丢弃）
        const manifest = this.vault.unseal(this.fsp.readFileSync(`${finalDir}/manifest.enc`, 'utf8'));
        verifyManifest(existing, manifest, revision);
        const have = new Set(manifest.assets.map(a => a.assetId));
        const same = refs.length === manifest.assets.length && refs.every(r => have.has(r.assetId));
        if (!same) throw err('revision-conflict', `revision ${revision} 已存在但 refs 不同`);
        return { revision, idempotent: true };
      }
      if (this.fsp.existsSync(tmpDir)) this.fsp.rmSync(tmpDir, { recursive: true, force: true });
      ensureDir(this.fsp, tmpDir);
      const manifest = { version: 1, revision, createdAt: this.now(), assets: [] };
      for (const ref of refs) {
        const a = s.assets.get(ref.assetId);
        if (!a || (a.state !== 'committed' && a.state !== 'saved')) throw err('no-asset', `asset not committed: ${ref.assetId}`);
        this.fsp.copyFileSync(a.file, `${tmpDir}/${a.assetId}.blob`);
        manifest.assets.push({
          assetId: a.assetId,
          wrappedKey: this.vault.wrap(a.key),
          chunkCount: a.chunkCount, totalLen: a.totalLen, sha256: a.sha256,
          metadata: a.metadata,
        });
        touched.push(a);
      }
      this.fsp.writeFileSync(`${tmpDir}/manifest.enc`, this.vault.seal(manifest));
      // 完整性校验：逐对象流式重读（发现半写/篡改）
      for (const rec of manifest.assets) {
        const key = this.vault.unwrap(rec.wrappedKey);
        try {
          const fin = verifyBlob(this.fsp, `${tmpDir}/${rec.assetId}.blob`, key, rec.assetId, rec);
          if (fin.chunkCount !== rec.chunkCount) throw err('verify-failed', `chunkCount mismatch: ${rec.assetId}`);
        } finally { key.fill(0); }
      }
      // COMMIT 带内容（M3）：revision + manifest 摘要；读侧校验而非只看存在
      const manifestHash = crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
      this.fsp.writeFileSync(`${tmpDir}/COMMIT`, JSON.stringify({ revision, createdAt: this.now(), manifestHash }));
      this.fsp.renameSync(tmpDir, finalDir); // 原子提交
      // 事务化状态（M1）：COMMIT 成功后才置 saved（失败保持 committed 可重试）
      for (const a of touched) a.state = 'saved';
      this.blockReasons = this.blockReasons.filter(r => !(r.kind === 'save' && r.target === revision)); // 重试成功解除阻塞
      return { revision, manifestHash };
    } catch (e) {
      this._block('save', revision, `save:${revision}:${e.code ?? e.message}`); // 失败显式阻塞
      for (const a of touched) if (a.state === 'saved') a.state = 'committed'; // 回滚（M1）
      throw e;
    } finally {
      this._locks.delete(lockKey);
    }
  }

  // ---------- 丢弃/清理 ----------
  discardSession(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return { ok: true, idempotent: true };
    try {
      s.state = 'discard-pending';
      s.key.fill(0);
      for (const a of s.assets.values()) { a.key.fill(0); a.state = 'discarded'; }
      const failures = [];
      for (const w of [...s.writers]) {
        try { this._abort(w); } catch (e) { failures.push(e); }
      }
      if (failures.length) throw err('writer-cleanup-failed', 'Unfinished writers could not be closed');
      this.fsp.rmSync(s.dir, { recursive: true, force: true });
      s.state = 'discarded';
      this.sessions.delete(sessionId);
      this.blockReasons = this.blockReasons.filter(r => !(r.kind === 'discard' && r.target === sessionId)); // 重试成功解除
      return { ok: true };
    } catch (e) {
      this._block('discard', sessionId, `discard:${sessionId}:${e.code ?? e.message}`);
      s.state = 'discard-pending';
      throw err('cleanup-failed', `清理失败，已阻塞后续无痕任务: ${e.code ?? e.message}`);
    }
  }

  // 孤儿回收：绝不删除有存活进程标记的会话（B1）；只清无主/死亡会话、.tmp、无效 COMMIT
  recoverOrphans(liveSessions = []) {
    return this._withSnapshotLock(() => this._recoverOrphans(liveSessions));
  }

  _recoverOrphans(liveSessions = []) {
    const removed = [], kept = [];
    const live = new Set(liveSessions);
    const epi = `${this.root}/ephemeral`;
    if (this.fsp.existsSync(epi)) {
      for (const name of this.fsp.readdirSync(epi)) {
        const p = `${epi}/${name}`;
        const marker = this._readMarker(p);
        const owned = this.sessions.has(name) || live.has(name);
        const alive = marker && this.isPidAlive(marker.pid) !== false;
        if (owned || alive) { kept.push(`ephemeral/${name}`); continue; }
        // 无标记目录仅当超过陈旧阈值才清（防删刚创建未写标记的目录）
        if (!marker && (this.now() - dirMtimeSafe(this.fsp, p)) < 60 * 60 * 1000) { kept.push(`ephemeral/${name}`); continue; }
        this.fsp.rmSync(p, { recursive: true, force: true });
        removed.push(`ephemeral/${name}`);
      }
    }
    const saved = `${this.root}/saved`;
    if (this.fsp.existsSync(saved)) {
      for (const name of this.fsp.readdirSync(saved)) {
        const p = `${saved}/${name}`;
        if (name.endsWith('.tmp')) { this.fsp.rmSync(p, { recursive: true, force: true }); removed.push(`saved/${name}`); continue; }
        const revision = name.replace(/\.bak$/, '');
        const commit = readCommit(this.fsp, `${p}/COMMIT`, revision);
        // A broken commit can be a damaged saved snapshot, not disposable work.
        // Preserve it for explicit recovery instead of destroying user data.
        kept.push(`saved/${name}`);
        if (!commit) this._block('snapshot', name, 'Saved snapshot requires integrity review');
      }
    }
    // M2：阻塞只在对应目标确实清理成功后解除
    this.blockReasons = this.blockReasons.filter(r => {
      const targetGone =
        r.kind === 'discard' ? !this.fsp.existsSync(`${this.root}/ephemeral/${r.target}`)
        : r.kind === 'save' ? !this.fsp.existsSync(`${this.root}/saved/${r.target}.tmp`) || readCommit(this.fsp, `${this.root}/saved/${r.target}/COMMIT`, r.target)
        : false;
      return !targetGone;
    });
    return { removed, kept };
  }

  _readMarker(dir) {
    try {
      const m = JSON.parse(this.fsp.readFileSync(`${dir}/SESSION`, 'utf8'));
      if (!Number.isSafeInteger(m.pid) || m.pid <= 0) return null;
      return m;
    } catch { return null; }
  }

  cleanupState() {
    return { blockNewPrivateTasks: this.blockReasons.length > 0, reasons: this.blockReasons.map(r => r.message) };
  }

  exportExplicit(assetRef, caller, destination) {
    const bytes = this.readAll(assetRef, caller); // 唯一明文出口（显式导出；退出不删）
    this.exportFs.writeFileSync(destination, bytes);
    return { destination, bytes: bytes.length };
  }
}

function dirMtimeSafe(fsp, p) {
  try { return fsp.statSync(p).mtimeMs ?? 0; } catch { return 0; }
}

// COMMIT 内容校验（M3）：格式 {revision, createdAt, manifestHash}；revision 必须与目录名一致
export function readCommit(fsp, commitPath, revision) {
  try {
    const c = JSON.parse(fsp.readFileSync(commitPath, 'utf8'));
    if (c.revision === revision && typeof c.manifestHash === 'string' && /^[a-f0-9]{64}$/.test(c.manifestHash)) return c;
    return null;
  } catch { return null; }
}

function verifyManifest(commit, manifest, revision) {
  const digest = crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  if (manifest.revision !== revision || digest !== commit.manifestHash) {
    throw err('snapshot-corrupt', 'Snapshot manifest does not match its commit');
  }
}

// 已保存快照的独立恢复：解锁金库 → 校验 COMMIT → manifest → 流式逐块验证解密（M5）
export function* openSavedAsset(root, vault, revision, assetId, fsPort = realFs) {
  fsPort = confinedFs(root, fsPort);
  checkId(revision, 'revision'); checkId(assetId, 'assetId');
  if (!vault.unlocked) throw err('vault-locked', '恢复需要已解锁金库');
  const dir = `${root}/saved/${revision}`;
  const commit = readCommit(fsPort, `${dir}/COMMIT`, revision);
  if (!commit) throw err('not-committed', '快照无有效 COMMIT 标记');
  const manifest = vault.unseal(fsPort.readFileSync(`${dir}/manifest.enc`, 'utf8'));
  verifyManifest(commit, manifest, revision);
  const rec = manifest.assets.find(a => a.assetId === assetId);
  if (!rec) throw err('no-asset', 'asset not in snapshot');
  const key = vault.unwrap(rec.wrappedKey);
  try {
    let totalLen = 0, seq = 0;
    const hash = crypto.createHash('sha256');
    let fin = null;
    for (const r of readBlobRecords(fsPort, `${dir}/${assetId}.blob`, key, assetId)) {
      if (!vault.unlocked) throw err('vault-locked', 'Vault locked during streaming');
      if (r.final) fin = r.final;
      else { totalLen += r.chunk.length; hash.update(r.chunk); seq += 1; yield r.chunk; }
    }
    const sha256 = hash.digest('hex');
    if (!fin || fin.chunkCount !== seq || fin.totalLen !== totalLen || fin.sha256 !== sha256 || fin.sha256 !== rec.sha256 || rec.totalLen !== totalLen || rec.chunkCount !== seq) {
      throw err('blob-corrupt', 'saved asset verification failed');
    }
    return { meta: fin.meta, sha256, totalLen };
  } finally { key.fill(0); }
}

// Compatibility convenience for small callers. Large assets must consume
// openSavedAsset to completion and publish only after final verification.
export function readSavedAsset(...args) {
  const stream = openSavedAsset(...args);
  const parts = [];
  try {
    for (;;) {
      const item = stream.next();
      if (item.done) return { bytes: Buffer.concat(parts), ...item.value };
      parts.push(item.value);
    }
  } finally { stream.return(); }
}
