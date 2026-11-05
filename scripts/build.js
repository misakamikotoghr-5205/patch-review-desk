import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true }); await mkdir('dist');
for (const entry of ['public', 'lib', 'actions', 'fixtures', 'scripts', 'tests', 'licenses', 'server.js', 'package.json', 'package-lock.json', '.gitignore', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'docs']) await cp(entry, 'dist/'+entry, { recursive: true });
console.log('Built a local server distribution in dist/. It contains no tokens, workspace data or node_modules. Run npm ci --ignore-scripts --omit=optional, npm run init, npm run dev inside it.');
