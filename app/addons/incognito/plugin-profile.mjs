import { resolvePrivatePath } from "../../portable-paths.mjs";
import fs from "node:fs";
import path from "node:path";
import { appRoot } from "./imports.mjs";

export function ensurePluginProfile(root = resolvePrivatePath("private/Plugins")) {
  const home = path.resolve(root),
    dir = path.join(home, "profiles", "incognito");
  fs.mkdirSync(dir, { recursive: true });
  const writeMissing = (name, data) => {
    const target = path.join(dir, name);
    if (!fs.existsSync(target)) fs.writeFileSync(target, data, { flag: "wx" });
  };
  writeMissing(
    "package.json",
    JSON.stringify(
      {
        name: "dsh-profile-incognito",
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"] } },
      },
      null,
      2,
    ),
  );
  writeMissing("cordis.yml", "[]\n");
  writeMissing(
    "pnpm-workspace.yaml",
    `nodeLinker: hoisted\npackageImportMethod: copy\nsymlink: false\nstoreDir: ${JSON.stringify(dir.replaceAll("\\", "/") + "/.package-store")}\ncacheDir: ${JSON.stringify(home.replaceAll("\\", "/") + "/package-cache")}\nstateDir: ${JSON.stringify(home.replaceAll("\\", "/") + "/package-state")}\n`,
  );
  return {
    name: "incognito",
    home,
    dir,
    patchPath: path.join(dir, "cordis.patch.yml"),
    installAnchor: path.join(appRoot, "package.json"),
    overlays: [],
    telemetryDisabledEnv: "1",
    cwd: dir,
    packageManager: {
      command: resolvePrivatePath("node"),
      args: [path.join(appRoot, "node_modules/pnpm/bin/pnpm.cjs")],
    },
  };
}

// Strict mode's profile holds only DSH's own bundles. Should a package have been added to it anyway
// (it cannot be from the app in strict mode), the profile is recreated instead of loading it.
export function ensureStrictPluginProfile(root) {
  const home = path.resolve(root);
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(home, "profiles", "incognito", "package.json"), "utf8"),
    );
    if (Object.keys(manifest.dependencies ?? {}).length) fs.rmSync(home, { recursive: true, force: true });
  } catch (e) {
    if (e.code !== "ENOENT") fs.rmSync(home, { recursive: true, force: true });
  }
  return ensurePluginProfile(home);
}
