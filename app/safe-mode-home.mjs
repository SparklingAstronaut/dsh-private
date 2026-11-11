// Strict mode runs normal DSH in DSH Desktop's own Safe Mode: a fresh home under
// <userData>/safe-mode that has no user plugins and that DSH Desktop deletes when it exits. DSH
// Desktop adopts an environment that is already prepared, so this prepares one with DSH Private's
// host overlay (the private-mode bridge and the local model connection) in its home.
// Layout and marker follow DSH Desktop 2.0.14-beta.1 (src/safe-mode.ts).
import fs from "node:fs";
import path from "node:path";

export const SAFE_MODE_ARGUMENT = "--dsh-desktop-safe-mode";

// Deletes a folder tree, removing links (junctions, symlinks) without visiting their targets.
export function removeTree(root) {
  let stat;
  try {
    stat = fs.lstatSync(root);
  } catch {
    return;
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fs.rmSync(root, { force: true });
    return;
  }
  for (const name of fs.readdirSync(root)) {
    const p = path.join(root, name);
    const s = fs.lstatSync(p);
    if (s.isSymbolicLink()) {
      try {
        fs.rmdirSync(p);
      } catch {
        fs.unlinkSync(p);
      }
    } else if (s.isDirectory()) removeTree(p);
    else fs.rmSync(p, { force: true });
  }
  fs.rmdirSync(root);
}

// The internal-testing notice version acknowledged in the normal profile (see welcome-notice.mjs).
export function normalWelcomeVersion(profilePatch) {
  let text;
  try {
    text = fs.readFileSync(profilePatch, "utf8");
  } catch {
    return null;
  }
  const block = /^- id: ui-settings-general\r?\n((?:[ \t]+.*\r?\n?)*)/m.exec(text)?.[1] ?? "";
  const version = /^[ \t]+welcomeNoticeVersion:[ \t]*["']?([0-9A-Za-z][0-9A-Za-z.-]{0,63})["']?[ \t]*$/m.exec(
    block,
  )?.[1];
  return version ?? null;
}

export function prepareSafeModeHome(userDataDir, overlay, now = new Date()) {
  const rootDir = path.join(path.resolve(userDataDir), "safe-mode");
  const homeDir = path.join(rootDir, "dsh-home");
  removeTree(rootDir);
  fs.mkdirSync(homeDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(rootDir, "desktop-state"), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(homeDir, "cordis.patch.yml"), JSON.stringify(overlay, null, 2));
  // Written last: DSH Desktop treats the environment as ready only with a valid marker.
  fs.writeFileSync(
    path.join(rootDir, "environment.json"),
    JSON.stringify({ version: 1, createdAt: now.toISOString() }, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  return { rootDir, homeDir };
}
