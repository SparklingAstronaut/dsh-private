import { moduleOf } from "./imports.mjs";
import { LOCAL_API_KEY_ENV } from "../../model-slots.mjs";
const { CredentialProvider } = await moduleOf("@deepseek-ai/dsh-credentials");
export default class extends CredentialProvider {
  records = new Map();
  values = new Map([[LOCAL_API_KEY_ENV, "local-only"]]);
  async resolve(ref) {
    const value = this.values.get(ref);
    return value === undefined ? undefined : { value, source: "env" };
  }
  describe(ref) {
    return { configured: this.values.has(ref), source: "env", writable: false };
  }
  readRecord(key) {
    return structuredClone(this.records.get(key));
  }
  async modifyRecord(key, mutate) {
    const value = await mutate(this.readRecord(key));
    if (value !== undefined) this.records.set(key, structuredClone(value));
    return this.readRecord(key);
  }
  async deleteRecord(key) {
    this.records.delete(key);
  }
  async set() {
    throw Error("Private credentials are read only");
  }
  async unset() {
    throw Error("Private credentials are read only");
  }
}
