// v2 持久金库：密码→scrypt→主密钥；资产密钥经主密钥封装；索引 sealJson。
// 会话/主密钥仅内存；lock() 即清零。不写日志、不进命令行。
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { realFs, ensureDir, err, confinedFs } from './fsport.mjs';
import { wrapKey, unwrapKey, sealJson, unsealJson, FORMAT_VERSION } from './crypto.mjs';

const scrypt = promisify(crypto.scrypt);
const KDF = 'scrypt-131072-8-1';
const KEY_CHECK = 'DSH asset vault v2 key verification';

export class VaultV2 {
  constructor({ root, fsPort = realFs }) {
    this.root = root;
    this.fsp = confinedFs(root, fsPort);
    this.file = `${root}/vault2.meta`;
    this.masterKey = null;
    this.salt = null;
    this.generation = 0;
    this.pending = false;
  }

  configured() { return this.fsp.existsSync(this.file); }

  async create(password) {
    return this.#withDerivation(epoch => this.#createAtEpoch(password, epoch));
  }

  async #withDerivation(action) {
    if (this.pending) throw err('vault-busy', '金库正在处理解锁请求');
    if (this.unlocked) throw err('already-unlocked', 'already unlocked');
    this.pending = true;
    const epoch = this.generation;
    try { return await action(epoch); }
    finally { this.pending = false; }
  }

  async #createAtEpoch(password, epoch) {
    if (this.configured()) throw err('vault-exists', 'vault already configured');
    if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw err('bad-password', '密码须为 12–256 个字符');
    const salt = crypto.randomBytes(16);
    const key = await scrypt(password, salt, 32, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
    try {
      if (epoch !== this.generation) throw err('vault-cancelled', '金库操作已取消');
      ensureDir(this.fsp, this.root);
      this.fsp.writeFileSync(this.file, JSON.stringify({ version: FORMAT_VERSION, kdf: KDF,
        salt: salt.toString('base64'), keyCheck: sealJson(key, { purpose: KEY_CHECK }) }), { flag: 'wx' });
    } catch (e) {
      key.fill(0);
      if (e.code === 'EEXIST') throw err('vault-exists', 'vault already configured');
      throw e;
    }
    this.masterKey = key;
    this.salt = salt;
    return this;
  }

  async unlock(password) {
    return this.#withDerivation(epoch => this.#unlockAtEpoch(password, epoch));
  }

  async #unlockAtEpoch(password, epoch) {
    if (this.masterKey) throw err('already-unlocked', 'already unlocked');
    if (!this.configured()) throw err('vault-missing', 'vault not configured');
    let meta, original;
    try { original = this.fsp.readFileSync(this.file, 'utf8'); meta = JSON.parse(original); } catch { throw err('vault-corrupt', 'vault meta unreadable'); }
    if (meta.version !== FORMAT_VERSION || meta.kdf !== KDF) throw err('bad-version', 'unsupported vault version');
    if (!meta.keyCheck) throw err('vault-verification-required', 'Legacy prototype vault requires explicit verified migration');
    if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw err('vault-auth-failed', '密码错误或金库损坏');
    if (typeof meta.salt !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(meta.salt)) throw err('vault-corrupt', 'vault salt invalid');
    const salt = Buffer.from(meta.salt, 'base64');
    const key = await scrypt(password, salt, 32, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
    try {
      if (epoch !== this.generation) throw Error('cancelled');
      if (this.fsp.readFileSync(this.file, 'utf8') !== original) throw Error('vault changed');
      const check = unsealJson(key, meta.keyCheck);
      if (check?.purpose !== KEY_CHECK) throw Error('invalid key verification');
    } catch {
      key.fill(0);
      throw err('vault-auth-failed', '密码错误或金库损坏');
    }
    this.masterKey = key;
    this.salt = salt;
    return this;
  }

  lock() { this.generation += 1; this.masterKey?.fill(0); this.masterKey = null; this.salt = null; }
  get unlocked() { return this.masterKey !== null; }

  wrap(keyBytes) {
    if (!this.unlocked) throw err('vault-locked', 'vault locked');
    return wrapKey(this.masterKey, keyBytes);
  }
  unwrap(box) {
    if (!this.unlocked) throw err('vault-locked', 'vault locked');
    return unwrapKey(this.masterKey, box);
  }
  seal(obj) {
    if (!this.unlocked) throw err('vault-locked', 'vault locked');
    return sealJson(this.masterKey, obj);
  }
  unseal(s) {
    if (!this.unlocked) throw err('vault-locked', 'vault locked');
    return unsealJson(this.masterKey, s);
  }
}
