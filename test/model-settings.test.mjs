import test from 'node:test';
import assert from 'node:assert/strict';
import {privateModelSettings} from '../app/model-config.mjs';
import {modelAliases,modelBaseUrl} from '../app/portable-paths.mjs';
test('a fresh installation provides a local catalog without a host user-settings record',()=>{
 const config=privateModelSettings(),provider=config['llm-pi-ai'].providers['qqz-kvmem'];
 assert.equal(provider.baseURL,modelBaseUrl);
 assert.deepEqual(provider.models.map(m=>m.id),[...new Set(Object.values(modelAliases))]);
 assert.equal(provider.apiKeyEnv,'QQZ_LOCAL_API_KEY');
 config['llm-pi-ai'].providers['qqz-kvmem'].models.length=0;
 assert(privateModelSettings()['llm-pi-ai'].providers['qqz-kvmem'].models.length>0);
});
