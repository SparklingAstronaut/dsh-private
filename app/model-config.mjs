import {modelAliases,modelBaseUrl,settings} from './portable-paths.mjs';
// Read the public app's connection settings directly. The host's settings form
// does not expose composition defaults through its "user" configuration field.
export function privateModelSettings(){
 const provider={displayName:'Local model',api:'openai-completions',apiKeyEnv:'QQZ_LOCAL_API_KEY',baseURL:modelBaseUrl,timeoutMs:600000,streamIdleTimeoutMs:300000,
  compat:{supportsStore:false,supportsDeveloperRole:false,supportsReasoningEffort:false,maxTokensField:'max_tokens'},
  models:[...new Set(Object.values(modelAliases))].map(id=>({id,name:id,contextWindow:32768,maxTokens:4096,input:settings.vision?['text','image']:['text']}))};
 return {'llm-pi-ai':{providers:{'qqz-kvmem':provider}},'locale':{preference:settings.locale==='zh-CN'?'zh':'en'}};
}
