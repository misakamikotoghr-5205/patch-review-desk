import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Desk, digest } from '../lib/desk.js';
import { createActions, invoke } from '../actions/index.js';
import { makeServer } from '../server.js';
import { modelDraft } from '../scripts/agent.js';

const baseline = Array.from({ length: 20 }, (_, i) => `Line ${i+1}`).join('\n')+'\n';
const replacement = baseline.replace('Line 2\n','Revised second line\n').replace('Line 19\n','Revised nineteenth line\n');
function setup(t, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-desk-'));
  const directory = path.join(root, 'private'); const desk = new Desk(directory, options);
  fs.writeFileSync(path.join(desk.workspace, 'notes.md'), baseline);
  t.after(() => { try { desk.close(); } catch {} fs.rmSync(root, { recursive: true, force: true }); });
  return { root, directory, desk };
}
const propose = desk => desk.propose({ path: 'notes.md', base_sha256: digest(baseline), content: replacement });
function approve(desk, proposal, index = 0) { return desk.review({ id: proposal.id, hunk_id: proposal.hunks[index].id, approved: true, expected_revision: proposal.revision }); }

test('partial approval applies only one separated hunk and retains an exact backup', t => {
  const { desk } = setup(t); let p = propose(desk); assert.equal(p.hunks.length, 2);
  p = approve(desk, p);
  const r = desk.apply({ id: p.id, expected_revision: p.revision, key: 'partial-apply-key' });
  assert.equal(r.status, 'applied'); assert.equal(r.before_content, baseline);
  assert.equal(desk.read('notes.md').content, baseline.replace('Line 2\n','Revised second line\n'));
  assert.equal(r.after_sha256, digest(r.after_content));
});
test('approval can be revoked and stale review versions cannot overwrite newer decisions', t => {
  const { desk } = setup(t); const before = propose(desk); let p = approve(desk, before);
  assert.throws(() => approve(desk, before), /changed|drifted/);
  p = desk.review({ id: p.id, hunk_id: p.hunks[0].id, approved: false, expected_revision: p.revision });
  assert.throws(() => desk.apply({ id:p.id,expected_revision:p.revision,key:'revoked-apply-key' }), /Approve/);
  assert.equal(desk.read('notes.md').content, baseline);
});
test('observed baseline drift revokes all approvals permanently, even if original bytes return', t => {
  const { desk } = setup(t); let p = approve(desk, propose(desk));
  fs.writeFileSync(path.join(desk.workspace,'notes.md'), 'External edit\n');
  assert.equal(desk.list()[0].status, 'stale'); assert.deepEqual(desk.list()[0].approved, []);
  fs.writeFileSync(path.join(desk.workspace,'notes.md'), baseline);
  assert.throws(() => desk.apply({id:p.id,expected_revision:p.revision,key:'stale-apply-key'}), /baseline|review/);
});
test('a write injected after backup preparation is detected by the final baseline recheck', t => {
  let desk;
  ({ desk } = setup(t, {fault: point => { if(point==='prepared')fs.writeFileSync(path.join(desk.workspace,'notes.md'),'Concurrent change\n'); }}));
  const p=approve(desk,propose(desk));
  assert.throws(()=>desk.apply({id:p.id,expected_revision:p.revision,key:'last-check-key'}),/Baseline changed/);
  assert.equal(desk.read('notes.md').content,'Concurrent change\n');assert.equal(desk.receipts()[0].status,'conflict');
});
test('same apply key returns the original receipt while changed intent is rejected', t => {
  const {desk}=setup(t);const p=approve(desk,propose(desk)); const args={id:p.id,expected_revision:p.revision,key:'idempotent-key'};
  const first=desk.apply(args);assert.deepEqual(desk.apply(args),first);assert.equal(desk.receipts().length,1);
  assert.throws(()=>desk.apply({...args,expected_revision:p.revision+1}),/different operation/);
});
test('rollback restores original bytes once and refuses later edits', t => {
  const {desk}=setup(t);const p=approve(desk,propose(desk));const applied=desk.apply({id:p.id,expected_revision:p.revision,key:'before-rollback-key'});
  fs.writeFileSync(path.join(desk.workspace,'notes.md'),'Later work\n');
  assert.throws(()=>desk.rollback({receipt_id:applied.id,key:'rollback-drift-key'}),/overwrite new work/);
  assert.equal(desk.read('notes.md').content,'Later work\n');
  fs.writeFileSync(path.join(desk.workspace,'notes.md'),applied.after_content);
  const args={receipt_id:applied.id,key:'rollback-success-key'};const reverted=desk.rollback(args);
  assert.deepEqual(desk.rollback(args),reverted);assert.equal(desk.read('notes.md').content,baseline);
  assert.equal(desk.receipt(applied.id).rolled_back_by,reverted.id);
});
for (const point of ['prepared','renamed']) test(`restart reconciles an interrupted ${point} operation without applying twice`, t => {
  const {desk,directory}=setup(t,{fault:at=>{if(at===point)throw Error('simulated interruption');}});
  const p=approve(desk,propose(desk));const args={id:p.id,expected_revision:p.revision,key:'interrupted-operation'};
  assert.throws(()=>desk.apply(args),/interruption/);desk.close();
  const restored=new Desk(directory);t.after(()=>restored.close());
  const receipt=restored.apply(args);assert.equal(receipt.status,point==='renamed'?'applied':'aborted');
  assert.equal(restored.receipts().length,1);
  assert.equal(restored.read('notes.md').content,point==='renamed'?receipt.after_content:baseline);
});
test('traversal, absolute paths, hidden files, missing files, symlinks and hardlinks are refused', t => {
  const {root,desk}=setup(t);
  const outside=path.join(root,'outside.md');fs.writeFileSync(outside,'Never touch');
  fs.symlinkSync(outside,path.join(desk.workspace,'symlink.md'));fs.linkSync(outside,path.join(desk.workspace,'hardlink.md'));
  for(const name of ['../outside.md',outside,'.env','sub/file.md','notes.md\n','absent.md','symlink.md','hardlink.md'])assert.throws(()=>desk.read(name));
  assert.equal(fs.readFileSync(outside,'utf8'),'Never touch');
});
test('symlink data directories are rejected before any child is created outside the desk', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'patch-path-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const outside=path.join(root,'outside');fs.mkdirSync(outside);fs.symlinkSync(outside,path.join(root,'data'));
  assert.throws(()=>new Desk(path.join(root,'data')),/symlink/);assert.deepEqual(fs.readdirSync(outside),[]);
});
test('binary/oversized/invalid Unicode text fails while BOM and CRLF survive rollback', t => {
  const {desk}=setup(t);
  for(const content of ['a\0b','x'.repeat(100001),'\ud800'])assert.throws(()=>desk.propose({path:'notes.md',base_sha256:digest(baseline),content}));
  fs.writeFileSync(path.join(desk.workspace,'bad.txt'),Buffer.from([255]));assert.throws(()=>desk.read('bad.txt'));
  const text='\ufefffirst\r\nsecond\r\n';fs.writeFileSync(path.join(desk.workspace,'notes.md'),text);
  let p=desk.propose({path:'notes.md',base_sha256:digest(text),content:text.replace('second','updated')});p=approve(desk,p);
  const r=desk.apply({id:p.id,expected_revision:p.revision,key:'bom-crlf-apply'});desk.rollback({receipt_id:r.id,key:'bom-crlf-rollback'});
  assert.deepEqual(fs.readFileSync(path.join(desk.workspace,'notes.md')),Buffer.from(text));
});
test('real Agent-Native wrappers reject agent approvals and unknown fields before the handler', async t => {
  const {desk}=setup(t);const actions=createActions(desk);const p=await invoke(actions,'propose',{path:'notes.md',base_sha256:digest(baseline),content:replacement},'agent');
  const review={id:p.id,hunk_id:p.hunks[0].id,approved:true,expected_revision:0};
  await assert.rejects(invoke(actions,'review',review,'agent'),/human capability/);
  await assert.rejects(invoke(actions,'review',{...review,patchActor:'human'},'agent'),/Invalid action parameters/);
  assert.equal(desk.proposal(p.id).revision,0);assert.equal(actions.review.agentTool,false);assert.equal(actions.apply.mcpTool,false);
  assert.equal((await invoke(actions,'review',review,'human')).approved.length,1);
});
test('local HTTP exposes only draft tools to agent capability and never accepts client identity', async t => {
  const {desk}=setup(t);const tokens={human:'a'.repeat(64),agent:'b'.repeat(64)};const server=makeServer(desk,tokens);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(url+'/api/tools')).status,401);
  const tools=await (await fetch(url+'/api/tools',{headers:{Authorization:'Bearer '+tokens.agent}})).json();assert.deepEqual(tools.map(x=>x.name),['inspect','propose']);
  const p=propose(desk);
  const response=await fetch(url+'/api/actions/review',{method:'POST',headers:{Authorization:'Bearer '+tokens.agent,'Content-Type':'application/json'},body:JSON.stringify({id:p.id,hunk_id:p.hunks[0].id,approved:true,expected_revision:0})});
  assert.equal(response.status,403);assert.equal(desk.proposal(p.id).revision,0);
});
test('optional model can return text only, never an approval, path or action', async () => {
  await assert.rejects(modelDraft({path:'notes.md',content:baseline},'edit',{model:''}),/Set PATCH/);
  for(const output of [{content:'safe',approved:true},{path:'../escape',content:'safe'},{content:'x\0y'},['bad']]){
    const transport=async()=>new Response(JSON.stringify({message:{content:JSON.stringify(output)}}));
    await assert.rejects(modelDraft({path:'notes.md',content:baseline},'edit',{model:'test',transport}),/contract/);
  }
  const transport=async(url,request)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');assert.equal(request.redirect,'error');return new Response(JSON.stringify({message:{content:JSON.stringify({content:'A new text'})}}));};
  assert.equal(await modelDraft({path:'notes.md',content:baseline},'edit',{model:'test',transport}),'A new text');
});
