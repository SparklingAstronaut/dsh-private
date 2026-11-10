import { modelAliases, modelBaseUrl, settings } from "./portable-paths.mjs";
import { LOCAL_API_KEY_ENV, LOCAL_PROVIDER } from "./model-slots.mjs";
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
      contextWindow: 32768,
      maxTokens: 4096,
      input: settings.vision ? ["text", "image"] : ["text"],
    })),
  };
  return {
    "llm-pi-ai": { providers: { [LOCAL_PROVIDER]: provider } },
    locale: { preference: settings.locale === "zh-CN" ? "zh" : "en" },
  };
}
