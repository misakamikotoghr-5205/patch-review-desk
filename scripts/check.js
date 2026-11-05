import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
for (const folder of ['lib', 'actions', 'public', 'scripts', 'tests']) {
  for (const file of await readdir(folder)) if (file.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', path.join(folder, file)], { stdio: 'inherit' });
    if (result.status) process.exit(result.status);
  }
}
const result = spawnSync(process.execPath, ['--check', 'server.js'], { stdio: 'inherit' }); if (result.status) process.exit(result.status);
for (const file of ['public/index.html', 'public/styles.css', 'public/app.js']) {
  const content = await readFile(file, 'utf8');
  if (/https?:\/\/|@import/.test(content)) throw Error('Unexpected runtime external resource: '+file);
}
console.log('Syntax and local UI asset checks passed.');
for (const [dependency, version, license] of [['@agent-native/core', '0.223.0', 'agent-native-MIT.txt'], ['diff', '9.0.0', 'jsdiff-BSD-3-Clause.txt'], ['zod', '4.4.3', 'zod-MIT.txt']]) {
  const installed = JSON.parse(await readFile(`node_modules/${dependency}/package.json`, 'utf8'));
  if (installed.version !== version) throw Error('Unexpected installed dependency version: '+dependency);
  if (!(await readFile(`node_modules/${dependency}/LICENSE`)).equals(await readFile(`licenses/${license}`))) throw Error('Original license differs: '+dependency);
}
console.log('Pinned direct dependencies and retained original license texts verified.');
