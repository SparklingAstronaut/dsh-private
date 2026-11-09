// 注入式文件系统端口：生产用 node:fs；测试注入故障（ENOSPC/EROFS/EIO/断连）。
import fs from 'node:fs';
import path from 'node:path';

export const realFs = {
  mkdirSync: (p, o) => fs.mkdirSync(p, o),
  writeFileSync: (p, b, o) => fs.writeFileSync(p, b, o),
  appendFileSync: (p, b) => fs.appendFileSync(p, b),
  readFileSync: (p, o) => fs.readFileSync(p, o),
  renameSync: (a, b) => fs.renameSync(a, b),
  unlinkSync: (p) => fs.unlinkSync(p),
  rmSync: (p, o) => fs.rmSync(p, o),
  readdirSync: (p, o) => fs.readdirSync(p, o),
  statSync: (p) => fs.statSync(p),
  lstatSync: (p) => fs.lstatSync(p),
  existsSync: (p) => fs.existsSync(p),
  openSync: (p, f) => fs.openSync(p, f),
  writeSync: (fd, b) => fs.writeSync(fd, b),
  readSync: (fd, buf, off, len, pos) => fs.readSync(fd, buf, off, len, pos),
  fsyncSync: (fd) => fs.fsyncSync(fd),
  closeSync: (fd) => fs.closeSync(fd),
  copyFileSync: (a, b) => fs.copyFileSync(a, b),
};

// 故障注入装饰器：failWhen(op, p) 返回 Error 则抛出；可设临时开关模拟满盘/断连
export class FlakyFs {
  constructor(base = realFs) {
    this.base = base;
    this.failWhen = () => null;
    this.log = [];
  }
  _wrap(op) {
    return (...args) => {
      this.log.push([op, args[0]]);
      const err = this.failWhen(op, args[0]);
      if (err) throw err;
      return this.base[op](...args);
    };
  }
}
for (const op of Object.keys(realFs)) {
  FlakyFs.prototype[op] = function (...args) { return this._wrap(op)(...args); };
}

export const err = (code, msg) => Object.assign(new Error(msg ?? code), { code });

export function ensureDir(fsp, p) {
  if (!fsp.existsSync(p)) fsp.mkdirSync(p, { recursive: true });
}

export function join(...parts) { return path.join(...parts); }

// Check each existing component rather than resolving away junctions. This
// guards accidental/malicious static links, not hostile concurrent OS mutation.
export function confinedFs(root, base = realFs) {
  const anchor = path.resolve(root);
  function check(value) {
    if (typeof value !== 'string') throw err('unsafe-path', 'Path must be a string');
    const target = path.resolve(value);
    const relative = path.relative(anchor, target);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw err('unsafe-path', 'Path is outside managed storage');
    }
    const volume = path.parse(target).root;
    let current = volume;
    for (const part of target.slice(volume.length).split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      try {
        if (base.lstatSync(current).isSymbolicLink()) throw err('unsafe-path', 'Storage links are not allowed');
      } catch (e) {
        if (e.code === 'ENOENT') break;
        throw e;
      }
    }
    return target;
  }
  const single = new Set(['mkdirSync', 'writeFileSync', 'appendFileSync', 'readFileSync', 'unlinkSync',
    'rmSync', 'readdirSync', 'statSync', 'lstatSync', 'existsSync', 'openSync']);
  const dual = new Set(['renameSync', 'copyFileSync']);
  return Object.fromEntries(Object.keys(realFs).map(op => [op, (...args) => {
    if (single.has(op)) check(args[0]);
    if (dual.has(op)) { check(args[0]); check(args[1]); }
    return base[op](...args);
  }]));
}
