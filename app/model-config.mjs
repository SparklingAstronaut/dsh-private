import path from "node:path";
import { modelAliases, modelBaseUrl, settings } from "./portable-paths.mjs";
import { LOCAL_API_KEY_ENV, LOCAL_PROVIDER } from "./model-slots.mjs";

const whole = (value, fallback, min, max) =>
  Number.isInteger(value) && value >= min && value <= max ? value : fallback;

// settings.json "provider" names a provider already configured in DSH (for example by a local
// model plugin). Private chats then use a copy of it under the private provider ID, limited to the
// Model A/B IDs. Its base URL must equal the loopback Connection URL; the key is the local
// placeholder, so the provider's own key variable need not be set.
export function reusedProviderSettings(describe, name = settings.provider) {
  const source = describe.find((entry) => entry.ns === "llm-pi-ai")?.user?.providers?.[name];
  if (!source || typeof source !== "object")
    throw Error(`Provider ${name} is not configured in DSH settings.`);
  const provider = structuredClone(source);
  if (typeof provider.baseURL !== "string" || provider.baseURL.replace(/\/$/, "") !== modelBaseUrl)
    throw Error(`Provider ${name} must use the Connection URL ${modelBaseUrl}.`);
  const ids = new Set(Object.values(modelAliases));
  provider.models = (Array.isArray(provider.models) ? provider.models : []).filter((m) => ids.has(m?.id));
  if (!provider.models.length) throw Error(`Provider ${name} does not list Model A or Model B.`);
  provider.apiKeyEnv = LOCAL_API_KEY_ENV;
  return { ...privateModelSettings(), "llm-pi-ai": { providers: { [LOCAL_PROVIDER]: provider } } };
}

// Core plugins the host always loads. With "modelEngine": "plugin" in settings.json, a plugin the
// user added provides localIncognitoEngine and starts or stops the local models itself; private
// chats still go only to the loopback server set in Connection.
export function hostPlugins(root, config = settings) {
  return [
    ...(config.modelEngine === "plugin"
      ? []
      : [{ id: "private-model-connection", name: path.join(root, "model-engine.mjs") }]),
    { id: "incognito-host", name: path.join(root, "addons/incognito/host.mjs") },
  ];
}
// Read the public app's connection settings directly. The host's settings form
// does not expose composition defaults through its "user" configuration field.
export function privateModelSettings() {
  const provider = {
    displayName: "Local model",
    api: "openai-completions",
    apiKeyEnv: LOCAL_API_KEY_ENV,
    baseURL: modelBaseUrl,
    timeoutMs: 600000,
    streamIdleTimeoutMs: 300000,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      maxTokensField: "max_tokens",
    },
    models: [...new Set(Object.values(modelAliases))].map((id) => ({
      id,
      name: id,
      contextWindow: whole(settings.contextWindow, 32768, 2048, 1048576),
      maxTokens: whole(settings.maxTokens, 4096, 256, 131072),
      input: settings.vision ? ["text", "image"] : ["text"],
    })),
  };
  return {
    "llm-pi-ai": { providers: { [LOCAL_PROVIDER]: provider } },
    locale: { preference: settings.locale === "zh-CN" ? "zh" : "en" },
  };
}
