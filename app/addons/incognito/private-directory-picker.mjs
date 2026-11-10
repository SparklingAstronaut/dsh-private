import { moduleOf } from "./imports.mjs";
const { DirectoryPicker } = await moduleOf("@deepseek-ai/dsh-host-directory-picker");
export default class extends DirectoryPicker {
  capability() {
    return { kind: "native", pick: (signal) => globalThis.privatePickDirectory(signal) };
  }
}
