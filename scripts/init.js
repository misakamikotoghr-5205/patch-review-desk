import * as fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Desk } from '../lib/desk.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desk = new Desk(path.join(root, '.data'));
const tokens = path.join(root, '.data/roles.json');
try {
  fs.writeFileSync(tokens, JSON.stringify({ human: randomBytes(32).toString('hex'), agent: randomBytes(32).toString('hex') }, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
} catch (error) { if (error.code !== 'EEXIST') throw error; }
const destination = path.join(desk.workspace, 'welcome.md');
try { fs.copyFileSync(path.join(root, 'fixtures/welcome.md'), destination, fs.constants.COPYFILE_EXCL); fs.chmodSync(destination, 0o600); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
desk.close();
console.log('Private fixture workspace initialized without replacing files. Paste the human token from .data/roles.json into the local UI. Never share or commit that file.');
