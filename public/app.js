const $ = id => document.getElementById(id);
let token = '', snapshot = null, role = 'agent', selected = '';
const keys = new Map();
const key = identity => { if (!keys.has(identity)) keys.set(identity, crypto.randomUUID()); return keys.get(identity); };
const notice = (message, error = false) => { $('notice').textContent = message; $('notice').className = error ? 'error' : ''; };
async function action(name, input = {}) {
  const response = await fetch('/api/actions/'+name, { method: 'POST', headers: { Authorization: 'Bearer '+token, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const body = await response.json();
  if (!response.ok) throw Error(body.message || body.error);
  return body;
}
function baseline() {
  const file = snapshot?.files.find(file => file.path === $('file').value && !file.unavailable);
  $('baseline').value = file?.content || ''; $('content').value = file?.content || '';
  $('hash').textContent = file ? 'SHA-256 '+file.sha256 : 'No available fixture file.';
}
function download(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderReview() {
  const proposal = snapshot?.proposals.find(item => item.id === selected);
  const container = $('review'); container.replaceChildren();
  $('apply').disabled = !proposal || role !== 'human' || proposal.status !== 'review' || !proposal.approved.length;
  if (!proposal) { container.textContent = 'A proposal will appear here.'; return; }
  const state = document.createElement('p'); state.className = 'state'+(proposal.status === 'stale' ? ' warning' : '');
  state.textContent = `${proposal.path} · ${proposal.status} · revision ${proposal.revision} · ${proposal.approved.length}/${proposal.hunks.length} approved`;
  container.append(state);
  if (proposal.status === 'stale') { const p = document.createElement('p'); p.className = 'warning'; p.textContent = 'Baseline changed. All approvals were revoked. Read the current file and make a new proposal.'; container.append(p); }
  for (const hunk of proposal.hunks) {
    const approved = proposal.approved.includes(hunk.id);
    const card = document.createElement('article'); card.className = 'hunk'+(approved ? ' approved' : '');
    const heading = document.createElement('header');
    const label = document.createElement('span'); label.textContent = `Lines ${hunk.oldStart}–${hunk.oldStart + Math.max(0, hunk.oldLines-1)}`;
    const button = document.createElement('button'); button.className = 'quiet'; button.textContent = approved ? 'Revoke approval' : 'Approve this hunk';
    button.disabled = role !== 'human' || proposal.status !== 'review';
    button.onclick = guarded(async () => { await action('review', { id: proposal.id, hunk_id: hunk.id, approved: !approved, expected_revision: proposal.revision }); await refresh(); });
    heading.append(label, button); card.append(heading);
    const pre = document.createElement('pre');
    for (const line of hunk.lines) { const span = document.createElement('span'); span.className = 'line'+(line[0] === '+' ? ' added' : line[0] === '-' ? ' removed' : ''); span.textContent = line; pre.append(span); }
    card.append(pre); container.append(card);
  }
}
function renderReceipts() {
  $('receipts').replaceChildren();
  if (!snapshot.receipts.length) $('receipts').textContent = 'No file has been changed.';
  for (const receipt of snapshot.receipts) {
    const row = document.createElement('article'); row.className = 'receipt';
    const text = document.createElement('div'); const title = document.createElement('strong'); title.textContent = `${receipt.kind} · ${receipt.path} · ${receipt.status}`;
    const detail = document.createElement('p'); detail.className = 'meta'; detail.textContent = receipt.id + (receipt.rolled_back_by ? ' · reverted' : ''); text.append(title, detail);
    const buttons = document.createElement('div'); buttons.className = 'buttons';
    const backup = document.createElement('button'); backup.className = 'quiet'; backup.textContent = 'Download receipt + backup'; backup.onclick = () => download(receipt, `patch-receipt-${receipt.id}.json`); buttons.append(backup);
    if (receipt.kind === 'apply' && receipt.status === 'applied' && !receipt.rolled_back_by && role === 'human') {
      const rollback = document.createElement('button'); rollback.className = 'quiet'; rollback.textContent = 'Rollback'; rollback.onclick = guarded(async () => {
        if (!confirm('Restore the original text? This is refused if the file has later edits.')) return;
        await action('rollback', { receipt_id: receipt.id, key: key('rollback:'+receipt.id) }); await refresh(); notice('Original text restored. Both receipts are retained.');
      }); buttons.append(rollback);
    }
    row.append(text, buttons); $('receipts').append(row);
  }
}
async function refresh() {
  snapshot = await action('inspect');
  const oldFile = $('file').value;
  $('file').replaceChildren(...snapshot.files.filter(file => !file.unavailable).map(file => new Option(file.path, file.path)));
  if (snapshot.files.some(file => file.path === oldFile)) $('file').value = oldFile;
  baseline();
  $('proposal').replaceChildren(...snapshot.proposals.map(proposal => new Option(proposal.title+' · '+proposal.status, proposal.id)));
  if (!snapshot.proposals.some(proposal => proposal.id === selected)) selected = snapshot.proposals[0]?.id || '';
  $('proposal').value = selected; renderReview(); renderReceipts();
}
function guarded(fn) { return async () => { try { await fn(); } catch (error) { notice(error.message, true); } }; }
$('connect').onclick = guarded(async () => {
  token = $('token').value.trim(); $('token').value = '';
  const response = await fetch('/api/tools', { headers: { Authorization: 'Bearer '+token } });
  const tools = await response.json(); if (!response.ok) throw Error('Capability token was rejected.');
  role = tools.some(tool => tool.name === 'apply') ? 'human' : 'agent'; $('role').textContent = role === 'human' ? 'Human review capability active.' : 'Agent draft capability: no approval or file-write authority.';
  await refresh(); notice('Shared desk loaded. No model was called.');
});
$('file').onchange = baseline;
$('proposal').onchange = () => { selected = $('proposal').value; renderReview(); };
for (const id of ['refresh','refresh-review']) $(id).onclick = guarded(refresh);
$('fixture').onclick = () => {
  $('content').value = $('baseline').value.replace('Doors open at 09:00.', 'Doors open at 09:30.').replace('Come back next month.', 'Come back on the first Saturday next month.');
  notice('Two fixed sample edits drafted for review. No inference or file write.');
};
$('propose').onclick = guarded(async () => {
  const file = snapshot?.files.find(item => item.path === $('file').value); if (!file) throw Error('Open the desk and choose a file first.');
  const proposal = await action('propose', { path: file.path, base_sha256: file.sha256, content: $('content').value, title: 'Review '+file.path }); selected = proposal.id; await refresh(); notice('Draft saved. Approve individual hunks to continue.');
});
$('apply').onclick = guarded(async () => {
  const proposal = snapshot.proposals.find(item => item.id === selected);
  if (!confirm(`Apply ${proposal.approved.length} approved hunk(s) to ${proposal.path}? A backup will be retained.`)) return;
  const receipt = await action('apply', { id: proposal.id, expected_revision: proposal.revision, key: key(`apply:${proposal.id}:${proposal.revision}`) });
  await refresh(); notice(`Receipt ${receipt.id}: ${receipt.status}.`);
});
