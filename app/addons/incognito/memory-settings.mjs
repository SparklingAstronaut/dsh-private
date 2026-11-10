import { moduleOf } from "./imports.mjs";
const { SettingsForms } = await moduleOf("@deepseek-ai/dsh-settings");
export default class extends SettingsForms {
  // Private settings are seeded into the composition, never imported from disk.
  async importLegacyDocument() {}
}
