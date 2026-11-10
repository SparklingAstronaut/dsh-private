// Private-mode prompt skills. The filesystem skill provider stays disabled in private mode, so the
// only skills here are Markdown files the user placed in <data folder>/prompt-skills. They are read
// once at startup and registered as runtime skills. Nothing is bundled, watched or written.
import fs from "node:fs";
import path from "node:path";
import { resolvePrivatePath } from "../../portable-paths.mjs";

export const name = "private-prompt-skills";
export const inject = ["skills"];

const MAX_SKILLS = 32;
const MAX_BYTES = 256 * 1024;
const SKILL_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const skillsRoot = () => resolvePrivatePath("data/prompt-skills");

export function parseSkill(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error("prompt skill is missing frontmatter");
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at > 0) fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  if (!fields.name || !fields.description) throw new Error("prompt skill requires name and description");
  return {
    name: fields.name,
    description: fields.description,
    ...(fields.whenToUse ? { whenToUse: fields.whenToUse } : {}),
    invocation: { modelInvocable: true, userInvocable: true },
    source: "bundled",
    content: match[2].trim(),
  };
}

// Each file is <id>.md and its frontmatter name must equal <id>. Invalid files are skipped and
// reported by file name only, so one bad file cannot block private mode.
export function loadSkills(root = skillsRoot(), warn = (message) => console.warn(message)) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const skills = [];
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const id = entry.name.slice(0, -3);
    try {
      if (skills.length >= MAX_SKILLS) throw new Error(`only the first ${MAX_SKILLS} skills are loaded`);
      if (!SKILL_ID.test(id)) throw new Error("use lowercase letters, digits and hyphens in the file name");
      const file = path.join(root, entry.name);
      if (fs.statSync(file).size > MAX_BYTES) throw new Error("file exceeds 256 KB");
      const skill = parseSkill(fs.readFileSync(file, "utf8"));
      if (skill.name !== id) throw new Error(`frontmatter name must be ${id}`);
      skills.push(skill);
    } catch (error) {
      warn(`Private prompt skill ${entry.name} skipped: ${error.message}`);
    }
  }
  return skills;
}

export function apply(ctx) {
  for (const skill of loadSkills()) ctx.skills.register(skill);
}
