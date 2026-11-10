import path from "node:path";
import { modelAliases, modelBaseUrl, settings } from "./portable-paths.mjs";
import { LOCAL_API_KEY_ENV, LOCAL_PROVIDER } from "./model-slots.mjs";

const whole = (value, fallback, min, max) =>
  Number.isInteger(value) && value >= min && value <= max ? value : fallback;

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
