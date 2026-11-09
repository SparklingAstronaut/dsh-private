import test from 'node:test';
import assert from 'node:assert/strict';
import {hasUnsavedChanges} from '../app/addons/incognito/snapshot-policy.mjs';
import {refifyRow,spillMin} from '../app/addons/incognito/private-cache.mjs';

const savedText=()=>({header:{id:'synthetic-session'},events:[{seq:0,type:'user/message',data:{text:'saved text'}}]});

test('reopened text archives with an empty file map are unchanged in either representation',()=>{
 const saved=savedText(), reopened={...structuredClone(saved),files:{},_fp:'1:0:0'};
 const originals=structuredClone([saved,reopened]);
 assert.equal(hasUnsavedChanges([reopened],[saved]),false);
 assert.equal(hasUnsavedChanges([saved],[reopened]),false);
 assert.deepEqual([saved,reopened],originals,'Comparing snapshots must not alter the live or saved data');
});

test('new messages and same-length message edits still require saving',()=>{
 const saved=savedText();
 const added={...structuredClone(saved),files:{}};
 added.events.push({seq:1,type:'assistant/message',data:{text:'new text'}});
 assert.equal(hasUnsavedChanges([added],[saved]),true);
 const edited=structuredClone(saved);edited.events[0].data.text='other text';
 assert.equal(hasUnsavedChanges([edited],[saved]),true);
 assert.equal(hasUnsavedChanges([saved],[]),true);
 assert.equal(hasUnsavedChanges([{header:{id:'empty'},events:[],files:{}}],[]),false);
});

test('file additions, same-length edits, and removals still require saving',()=>{
 const saved={...savedText(),files:{note:{path:'note.txt',data:Buffer.from('before').toString('base64')}}};
 const added=structuredClone(saved);added.files.other={path:'other.txt',data:'YQ=='};
 const edited=structuredClone(saved);edited.files.note.data=Buffer.from('after!').toString('base64');
 const removed=structuredClone(saved);removed.files={};
 for(const current of [added,edited,removed])assert.equal(hasUnsavedChanges([current],[saved]),true);
 assert.equal(hasUnsavedChanges([saved],[savedText()]),true);
});

test('inline versus spilled files remain equivalent without ignoring actual binary changes',()=>{
 const saved={...savedText(),files:{image:{path:'image.png',data:Buffer.alloc(spillMin+1,1).toString('base64')}}};
 const spilled=refifyRow(saved);
 assert.equal(hasUnsavedChanges([spilled],[saved]),false);
 const edited=structuredClone(saved);edited.files.image.data=Buffer.alloc(spillMin+1,2).toString('base64');
 assert.equal(hasUnsavedChanges([refifyRow(edited)],[saved]),true);
});

test('workspace, attachment, and child-session changes still require saving',()=>{
 const saved={...savedText(),workspaceState:{archived:false},attachments:[]};
 const archived=structuredClone(saved);archived.workspaceState.archived=true;
 const attachment=structuredClone(saved);attachment.attachments.push({ref:{attachmentId:'synthetic'},data:'YQ=='});
 const child={header:{id:'synthetic-child',parentSession:saved.header.id,origin:'subagent'},events:[{seq:0,type:'user/message',data:{text:'child task'}}]};
 for(const current of [archived,attachment])assert.equal(hasUnsavedChanges([current],[saved]),true);
 assert.equal(hasUnsavedChanges([saved,child],[saved]),true);
});

const blankSession=()=>({header:{id:'synthetic-blank'},events:[
 {seq:0,type:'permission/preset',data:{preset:'workspace-write'}},
 {seq:1,type:'sandbox/mode',data:{mode:'workspace-write'}},
 {seq:2,type:'approval/policy',data:{policy:'ask'}},
],attachments:[]});
const workspace=(order)=>({workspaceId:'synthetic-workspace',record:{path:'synthetic',title:'Saved workspace',sessionIds:['synthetic-session'],updatedAt:'before'},sessionOrder:order,order:0,archived:false});

test('read-only activation, projection rebuilds, and an automatic blank tab do not require saving',()=>{
 const saved={...savedText(),workspaceState:workspace(0),projection:{rows:{permissions:{seq:0,val:{seeded:false}}}}};
 const reopened=structuredClone(saved);
 reopened.events.push({seq:1,type:'session/end-seed',time:123,data:{}});
 reopened.projection.rows.permissions={seq:1,val:{seeded:true}};
 reopened.workspaceState.sessionOrder=1;
 reopened.workspaceState.record.updatedAt='after';
 const blank={...blankSession(),workspaceState:workspace(0)};
 assert.equal(hasUnsavedChanges([reopened,blank],[saved]),false);
 assert.equal(hasUnsavedChanges([blank],[]),false);
 const attached=structuredClone(blank);attached.attachments.push({data:'YQ=='});
 assert.equal(hasUnsavedChanges([attached],[]),true);
 const changedPolicy=structuredClone(blank);changedPolicy.events.push({seq:3,type:'approval/policy',data:{policy:'never'}});
 assert.equal(hasUnsavedChanges([changedPolicy],[]),true);
 const inherited=structuredClone(reopened);inherited.events.at(-1).data.inherited=true;
 assert.equal(hasUnsavedChanges([inherited],[saved]),true);
});

test('saved workspace ordering, titles, paths, and archive state remain significant',()=>{
 const first={...savedText(),workspaceState:workspace(3)};
 const second={...savedText(),header:{id:'synthetic-second'},workspaceState:workspace(8)};
 const compacted=structuredClone([first,second]);compacted[0].workspaceState.sessionOrder=0;compacted[1].workspaceState.sessionOrder=1;
 assert.equal(hasUnsavedChanges(compacted,[first,second]),false);
 const reordered=structuredClone(compacted);reordered[0].workspaceState.sessionOrder=1;reordered[1].workspaceState.sessionOrder=0;
 assert.equal(hasUnsavedChanges(reordered,[first,second]),true);
 for(const [key,value] of [['title','Changed title'],['path','another-workspace']]){
  const edited=structuredClone(first);edited.workspaceState.record[key]=value;
  assert.equal(hasUnsavedChanges([edited,second],[first,second]),true);
 }
 const setting=structuredClone(first);setting.events.push({seq:1,type:'approval/policy',data:{policy:'never'}});
 assert.equal(hasUnsavedChanges([setting,second],[first,second]),true);
});
