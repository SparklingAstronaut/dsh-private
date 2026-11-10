// Private-mode prompt skills (/anima-prompt, /qwen-prompt).
// The filesystem skill provider stays disabled in private mode; these two read-only skills ship
// with the add-on and are registered as runtime skills. Nothing is watched, written or discovered.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const name = "private-prompt-skills";
export const inject = ["skills"];

const ROOT = fileURLToPath(new URL("./prompt-skills/", import.meta.url));
const SKILLS = ["anima-prompt", "qwen-prompt", "story"];

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

export function apply(ctx) {
  for (const id of SKILLS) {
    const skill = parseSkill(readFileSync(ROOT + id + ".md", "utf8"));
    if (skill.name !== id) throw new Error(`prompt skill ${id} has mismatched name ${skill.name}`);
    ctx.skills.register(skill);
  }
}
