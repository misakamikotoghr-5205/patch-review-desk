import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { structuredPatch, applyPatch, formatPatch } from 'diff';

export class DeskError extends Error {
  constructor(code, message, status = 409) { super(message); this.code = code; this.statusCode = status; }
}
export const digest = value => createHash('sha256').update(value).digest('hex');
export const fail = (code, message, status) => { throw new DeskError(code, message, status); };
const MAX_BYTES = 100_000;
const filename = /^[A-Za-z][A-Za-z0-9_-]{0,63}\.(?:md|txt|json|js|css|html)$/;
const stable = value => JSON.stringify(value);
const decode = bytes => {
  if (bytes.length > MAX_BYTES || bytes.includes(0)) fail('TEXT_ONLY', 'Only UTF-8 text up to 100 KB is supported.', 400);
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { fail('TEXT_ONLY', 'Invalid UTF-8 is not a supported text file.', 400); }
};
export function checkText(value) {
  if (typeof value !== 'string' || value.includes('\0') || Buffer.byteLength(value) > MAX_BYTES || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(Buffer.from(value)) !== value)
    fail('TEXT_ONLY', 'Provide valid UTF-8 text up to 100 KB.', 400);
  return value;
}

export class Desk {
  constructor(directory, { fault = () => {} } = {}) {
    this.directory = path.resolve(directory);
    this.workspace = path.join(this.directory, 'workspace');
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    if (!fs.lstatSync(this.directory).isDirectory() || fs.realpathSync(this.directory) !== this.directory) fail('UNSAFE_PATH', 'Private data directory must not be a symlink.');
    fs.mkdirSync(this.workspace, { recursive: true, mode: 0o700 });
    this.checkDirectories();
    const dbPath = path.join(this.directory, 'desk.sqlite');
    let dbInfo;
    try { dbInfo = fs.lstatSync(dbPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (dbInfo && (!dbInfo.isFile() || dbInfo.nlink !== 1)) fail('UNSAFE_PATH', 'Unsafe ledger path.');
    this.db = new DatabaseSync(dbPath);
    fs.chmodSync(dbPath, 0o600);
    this.db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, intent TEXT NOT NULL, value TEXT NOT NULL);`);
    this.fault = fault;
    this.recover();
  }
  close() { this.db.close(); }
  checkDirectories() {
    for (const directory of [this.directory, this.workspace]) {
      const info = fs.lstatSync(directory);
      if (!info.isDirectory() || info.isSymbolicLink() || fs.realpathSync(directory) !== directory)
        fail('UNSAFE_PATH', 'The private data/workspace directory must not contain symlinks.');
    }
  }
  file(name) {
    if (typeof name !== 'string' || name !== name.trim() || !filename.test(name)) fail('UNSAFE_PATH', 'Choose an existing flat text filename; directories and hidden files are not supported.', 400);
    this.checkDirectories();
    return path.join(this.workspace, name);
  }
  read(name) {
    const target = this.file(name);
    let descriptor;
    try {
      descriptor = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      const info = fs.fstatSync(descriptor);
      if (!info.isFile() || info.nlink !== 1 || info.size > MAX_BYTES) fail('UNSAFE_PATH', 'Expected a small, regular file without hard links.', 400);
      const content = decode(fs.readFileSync(descriptor));
      return { path: name, content, sha256: digest(content) };
    } catch (error) {
      if (error instanceof DeskError) throw error;
      fail('FILE_UNAVAILABLE', 'The selected text file is unavailable or unsafe.', 400);
    } finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
  }
  inventory() {
    this.recover();
    return fs.readdirSync(this.workspace).filter(name => filename.test(name)).map(name => {
      try { return this.read(name); } catch { return { path: name, unavailable: true }; }
    });
  }
  saveProposal(proposal) { this.db.prepare('INSERT OR REPLACE INTO proposals VALUES (?,?)').run(proposal.id, stable(proposal)); }
  proposal(id) {
    const row = this.db.prepare('SELECT value FROM proposals WHERE id=?').get(id);
    if (!row) fail('NOT_FOUND', 'Proposal not found.', 404);
    return JSON.parse(row.value);
  }
  observe(proposal) {
    if (proposal.status !== 'review') return proposal;
    let current;
    try { current = this.read(proposal.path).sha256; } catch { current = null; }
    if (current !== proposal.base_sha256) {
      proposal.status = 'stale'; proposal.approved = []; proposal.revision++;
      this.saveProposal(proposal);
    }
    return proposal;
  }
  list() {
    this.recover();
    return this.db.prepare('SELECT value FROM proposals ORDER BY rowid DESC').all().map(row => this.observe(JSON.parse(row.value)));
  }
  propose({ path: name, base_sha256, content, title = 'Proposed text change' }) {
    this.recover(); checkText(content);
    const base = this.read(name);
    if (base.sha256 !== base_sha256) fail('STALE_BASE', 'File changed. Read the current baseline before proposing.');
    if (content === base.content) fail('NO_CHANGE', 'The proposal contains no change.', 400);
    const patch = structuredPatch(name, name, base.content, content, '', '', { context: 3, timeout: 1000, maxEditLength: 4000 });
    if (!patch || !patch.hunks.length || patch.hunks.length > 40) fail('PATCH_LIMIT', 'The diff is too complex or exceeds 40 hunks. Split it into smaller changes.', 400);
    const proposal = {
      id: randomUUID(), path: name, title, base_sha256, base_content: base.content,
      proposed_content: content, patch, patch_sha256: digest(stable(patch)),
      hunks: patch.hunks.map((hunk, index) => ({ id: digest(stable([base_sha256, index, hunk])).slice(0, 24), ...hunk })),
      approved: [], revision: 0, status: 'review', created_at: new Date().toISOString(),
    };
    this.saveProposal(proposal);
    return proposal;
  }
  review({ id, hunk_id, approved, expected_revision }) {
    this.recover();
    const proposal = this.observe(this.proposal(id));
    if (proposal.status !== 'review' || proposal.revision !== expected_revision) fail('STALE_REVIEW', 'Proposal changed or baseline drifted. Reload the review.');
    if (!proposal.hunks.some(hunk => hunk.id === hunk_id)) fail('UNKNOWN_HUNK', 'Hunk not found.', 400);
    proposal.approved = proposal.approved.filter(value => value !== hunk_id);
    if (approved) proposal.approved.push(hunk_id);
    proposal.revision++;
    this.saveProposal(proposal);
    return proposal;
  }
  receipt(id) {
    const row = this.db.prepare('SELECT value FROM receipts WHERE id=?').get(id);
    if (!row) fail('NOT_FOUND', 'Receipt not found.', 404);
    return JSON.parse(row.value);
  }
  saveReceipt(receipt, key, intent) {
    this.db.prepare('INSERT OR REPLACE INTO receipts VALUES (?,?,?,?)').run(receipt.id, key, intent, stable(receipt));
  }
  receipts() { this.recover(); return this.db.prepare('SELECT value FROM receipts ORDER BY rowid DESC').all().map(row => JSON.parse(row.value)); }
  prior(key, intent) {
    const row = this.db.prepare('SELECT * FROM receipts WHERE key=?').get(key);
    if (!row) return null;
    if (row.intent !== intent) fail('KEY_CONFLICT', 'Idempotency key belongs to a different operation.');
    return JSON.parse(row.value);
  }
  recover() {
    for (const row of this.db.prepare('SELECT * FROM receipts').all()) {
      const receipt = JSON.parse(row.value);
      if (receipt.status !== 'prepared') continue;
      let current;
      try { current = this.read(receipt.path).sha256; } catch { current = null; }
      receipt.status = current === receipt.after_sha256 ? 'applied' : current === receipt.before_sha256 ? 'aborted' : 'conflict';
      this.finish(receipt, row.key, row.intent);
    }
  }
  finish(receipt, key, intent) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.saveReceipt(receipt, key, intent);
      if (receipt.status === 'applied' && receipt.proposal_id) {
        const proposal = this.proposal(receipt.proposal_id);
        proposal.status = 'applied'; proposal.approved = []; proposal.revision++;
        this.saveProposal(proposal);
      }
      if (receipt.status === 'applied' && receipt.rollback_of) {
        const original = this.receipt(receipt.rollback_of);
        original.rolled_back_by = receipt.id;
        const row = this.db.prepare('SELECT key,intent FROM receipts WHERE id=?').get(original.id);
        this.saveReceipt(original, row.key, row.intent);
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  write(receipt, key, intent) {
    if (digest(receipt.before_content) !== receipt.before_sha256 || digest(receipt.after_content) !== receipt.after_sha256) fail('BACKUP_INVALID', 'Backup hashes do not match.');
    const target = this.file(receipt.path);
    const temporary = path.join(this.workspace, `.stage-${randomUUID()}`);
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(descriptor, receipt.after_content); fs.fsyncSync(descriptor); fs.closeSync(descriptor); descriptor = undefined;
      // Durable intent and backup precede the single-file atomic rename.
      this.saveReceipt(receipt, key, intent);
      this.fault('prepared');
      if (this.read(receipt.path).sha256 !== receipt.before_sha256) {
        receipt.status = 'conflict'; this.finish(receipt, key, intent);
        fail('STALE_BASE', 'Baseline changed before apply. No patch was written.');
      }
      fs.renameSync(temporary, target);
      const directory = fs.openSync(this.workspace, 'r'); try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
      this.fault('renamed');
      receipt.status = 'applied'; this.finish(receipt, key, intent);
      return receipt;
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      try { fs.unlinkSync(temporary); } catch {}
    }
  }
  apply({ id, expected_revision, key }) {
    this.recover();
    const intent = digest(stable({ action: 'apply', id, expected_revision }));
    const previous = this.prior(key, intent);
    if (previous) return previous;
    const proposal = this.observe(this.proposal(id));
    if (proposal.status !== 'review' || proposal.revision !== expected_revision) fail('STALE_REVIEW', 'Reload the proposal; review or baseline changed.');
    if (!proposal.approved.length) fail('APPROVAL_REQUIRED', 'Approve at least one hunk before applying.');
    const selected = proposal.patch.hunks.filter((_, index) => proposal.approved.includes(proposal.hunks[index].id));
    const patch = { ...proposal.patch, hunks: selected };
    const result = applyPatch(proposal.base_content, patch, { fuzzFactor: 0, autoConvertLineEndings: false });
    if (result === false || result === proposal.base_content) fail('PATCH_REJECTED', 'Selected hunks cannot produce a valid change.');
    checkText(result);
    const receipt = { id: randomUUID(), kind: 'apply', proposal_id: id, path: proposal.path,
      selected_hunks: [...proposal.approved], patch: formatPatch(patch), before_content: proposal.base_content,
      after_content: result, before_sha256: proposal.base_sha256, after_sha256: digest(result),
      status: 'prepared', created_at: new Date().toISOString() };
    return this.write(receipt, key, intent);
  }
  rollback({ receipt_id, key }) {
    this.recover();
    const intent = digest(stable({ action: 'rollback', receipt_id }));
    const previous = this.prior(key, intent); if (previous) return previous;
    const original = this.receipt(receipt_id);
    if (original.kind !== 'apply' || original.status !== 'applied' || original.rolled_back_by) fail('ROLLBACK_UNAVAILABLE', 'Only an applied, unreverted change can be rolled back.');
    if (this.read(original.path).sha256 !== original.after_sha256) fail('ROLLBACK_DRIFT', 'File changed after apply. Rollback would overwrite new work and was refused.');
    const receipt = { id: randomUUID(), kind: 'rollback', rollback_of: receipt_id, path: original.path,
      before_content: original.after_content, after_content: original.before_content,
      before_sha256: original.after_sha256, after_sha256: original.before_sha256,
      status: 'prepared', created_at: new Date().toISOString() };
    return this.write(receipt, key, intent);
  }
}
