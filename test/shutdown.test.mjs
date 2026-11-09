import test from 'node:test';
import assert from 'node:assert/strict';
import {shutdownPrivateRuntime} from '../app/addons/incognito/runtime-shutdown.mjs';

function fixture(fail) {
  const order=[];
  const op=name=>async()=>{order.push(name);if(fail===name)throw Error(`synthetic ${name}`);};
  const runtime={
    saveTail: Promise.resolve(), token:'synthetic-token',
    execution:{close:op('execution-stop'),cleanup:op('execution-cleanup')},
    mcp:{stop:async purge=>{assert.equal(purge,false);await op('mcp-stop')();},cleanup:op('mcp-cleanup')},
    worker:{terminate:op('worker-stop')},
  };
  return {runtime,order};
}
test('accepted explicit save completes before shutdown or file cleanup',async()=>{
  const {runtime,order}=fixture();let resolveSave;
  runtime.saveTail=new Promise(r=>{resolveSave=r;});
  const closing=shutdownPrivateRuntime(runtime);await new Promise(r=>setImmediate(r));
  assert.deepEqual(order,[]);order.push('saved');resolveSave();await closing;
  assert.deepEqual(order,['saved','execution-stop','mcp-stop','worker-stop','mcp-cleanup','execution-cleanup']);
  assert.equal(runtime.cleanupPending,false);assert.equal(runtime.token,'');
});
for(const failure of ['execution-stop','mcp-stop','worker-stop']){
  test(`${failure} failure prevents deletion and still attempts all stops`,async()=>{
    const {runtime,order}=fixture(failure);
    await assert.rejects(shutdownPrivateRuntime(runtime),AggregateError);
    assert.deepEqual(order,['execution-stop','mcp-stop','worker-stop']);
    assert.equal(runtime.cleanupPending,true);assert.equal(runtime.token,'');
  });
}
test('failed cache deletion is reported and independent cleanup still runs',async()=>{
  const {runtime,order}=fixture('mcp-cleanup');
  await assert.rejects(shutdownPrivateRuntime(runtime),AggregateError);
  assert.deepEqual(order,['execution-stop','mcp-stop','worker-stop','mcp-cleanup','execution-cleanup']);
  assert.equal(runtime.cleanupPending,true);
});
test('internal restart can preserve MCP payload without skipping execution cleanup',async()=>{
  const {runtime,order}=fixture();await shutdownPrivateRuntime(runtime,false);
  assert.deepEqual(order,['execution-stop','mcp-stop','worker-stop','execution-cleanup']);
  assert.equal(runtime.cleanupPending,false);
});
