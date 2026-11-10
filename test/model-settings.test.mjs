import test from "node:test";
import assert from "node:assert/strict";
import { privateModelSettings } from "../app/model-config.mjs";
import { modelAliases, modelBaseUrl } from "../app/portable-paths.mjs";
import { LOCAL_API_KEY_ENV, LOCAL_PROVIDER } from "../app/model-slots.mjs";
test("a fresh installation provides a local catalog without a host user-settings record", () => {
  const config = privateModelSettings(),
    provider = config["llm-pi-ai"].providers[LOCAL_PROVIDER];
  assert.equal(provider.baseURL, modelBaseUrl);
  assert.deepEqual(
    provider.models.map((m) => m.id),
    [...new Set(Object.values(modelAliases))],
  );
  assert.equal(provider.apiKeyEnv, LOCAL_API_KEY_ENV);
  config["llm-pi-ai"].providers[LOCAL_PROVIDER].models.length = 0;
  assert(privateModelSettings()["llm-pi-ai"].providers[LOCAL_PROVIDER].models.length > 0);
});
