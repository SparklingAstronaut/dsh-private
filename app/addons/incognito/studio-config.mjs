import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { connectPrivateStudioHost } from "./studio-registration.mjs";

const canonical = (value) => path.resolve(value).toLowerCase();
function absolute(value) {
  if (typeof value !== "string" || !path.isAbsolute(value))
    throw Error("Absolute private Studio configuration path required");
  return value;
}
export function readPrivateStudioConfig(file) {
  const config = JSON.parse(fs.readFileSync(absolute(file), "utf8"));
  if (config.enabled === false) return null;
  if (config.version !== 1 || config.enabled !== true) throw Error("Invalid private Studio configuration");
  for (const key of ["assetRoot", "mountRoot", "securefsExe", "pythonExe", "storagePolicy", "comfyDir"])
    absolute(config[key]);
  for (const key of ["pythonPaths", "extraModelPaths"])
    if (config[key] !== undefined && (!Array.isArray(config[key]) || !config[key].every(absolute)))
      throw Error("Absolute private Studio configuration path required");
  if (
    !/^[D-Z]:$/.test(config.mountDrive) ||
    !/^[a-f0-9]{64}$/.test(config.securefsSha256) ||
    !/^[a-f0-9]{64}$/.test(config.pythonSha256)
  )
    throw Error("Private Studio executable pins or mount drive missing");
  const a = canonical(config.assetRoot),
    m = canonical(config.mountRoot);
  if (a === m || a.startsWith(m + path.sep) || m.startsWith(a + path.sep))
    throw Error("Saved assets and temporary mounts require separate directories");
  if (
    [config.assetRoot, config.mountRoot].some(
      (root) => path.parse(root).root.toUpperCase() === config.mountDrive.toUpperCase() + path.sep,
    )
  )
    throw Error("Mount drive cannot contain backing storage");
  return config;
}
function noLinks(root) {
  const resolved = path.resolve(root);
  let current = path.parse(resolved).root;
  if (!fs.existsSync(current)) throw Error("Private storage volume unavailable");
  for (const segment of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw Error("Private storage path cannot redirect to another location");
  }
}
export function privateStorageGate(config) {
  return async () => {
    const policy = JSON.parse(fs.readFileSync(config.storagePolicy, "utf8"));
    if (
      policy.status !== "verified" ||
      policy.writeReadbackPassed !== true ||
      policy.deviceErrorsReviewed !== true ||
      !Number.isFinite(Date.parse(policy.verifiedAt))
    )
      throw Error("私密存储尚未通过验收，已阻止新图片任务。");
    if (
      typeof policy.assetRoot !== "string" ||
      typeof policy.mountRoot !== "string" ||
      canonical(policy.assetRoot) !== canonical(config.assetRoot) ||
      canonical(policy.mountRoot) !== canonical(config.mountRoot)
    )
      throw Error("Private storage verification does not match configured directories");
    noLinks(config.assetRoot);
    noLinks(config.mountRoot);
    if (!fs.statSync(config.mountRoot).isDirectory()) throw Error("Private mount storage unavailable");
    for (const [file, expected] of [
      [config.securefsExe, config.securefsSha256],
      [config.pythonExe, config.pythonSha256],
    ]) {
      const hash = createHash("sha256");
      for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
      if (hash.digest("hex") !== expected) throw Error("Private Studio executable integrity mismatch");
    }
  };
}
export function configurePrivateStudio(ctx, file) {
  const config = readPrivateStudioConfig(file);
  if (!config) return;
  const register = (owner) =>
    connectPrivateStudioHost(owner, {
      assetRoot: config.assetRoot,
      mountOptions: {
        parent: config.mountRoot,
        drive: config.mountDrive,
        exe: config.securefsExe,
        supervisorPython: config.pythonExe,
      },
      // The pinned pythonExe also runs ComfyUI, so the integrity check covers the image process.
      imageRuntime: {
        comfyDir: config.comfyDir,
        python: config.pythonExe,
        pythonPaths: config.pythonPaths ?? [],
        extraModelPaths: config.extraModelPaths ?? [],
      },
      create: config.allowInitialCreate === true,
      assertStorageAvailable: privateStorageGate(config),
    });
  ctx.inject(["localImageGpu", "privateStudioCompiler"], register);
}

// Only the trusted installation path is optional. Explicit overrides must exist.
export function configurePrivateStudioAtStartup(ctx, explicitFile, installationFile) {
  if (explicitFile !== undefined) {
    configurePrivateStudio(ctx, explicitFile);
    return;
  }
  const file = absolute(installationFile);
  if (fs.existsSync(file)) configurePrivateStudio(ctx, file);
}
