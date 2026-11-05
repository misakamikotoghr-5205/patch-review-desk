import http from 'node:http';
import * as fs from 'node:fs';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Desk } from './lib/desk.js';
import { createActions, invoke } from './actions/index.js';

const root = path.dirname(fileURLToPath(import.meta.url));
export function makeServer(desk, tokens) {
  if (!tokens || !/^[a-f0-9]{64}$/.test(tokens.human) || !/^[a-f0-9]{64}$/.test(tokens.agent) || tokens.human === tokens.agent) throw Error('Initialize separate private role tokens.');
  const actions = createActions(desk);
  const equal = (a, b) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const server = http.createServer(async (request, response) => {
    const reply = (status, value, type = 'application/json') => {
      const data = type === 'application/json' ? JSON.stringify(value) : value;
      response.writeHead(status, { 'Content-Type': type+'; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" }); response.end(data);
    };
    try {
      if (!/^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/.test(request.headers.host || '')) return reply(403, { error: 'LOCAL_HOST_REQUIRED' });
      if (request.headers.origin && request.headers.origin !== 'http://'+request.headers.host) return reply(403, { error: 'ORIGIN_REJECTED' });
      if (request.method === 'GET' && ['/', '/app.js', '/styles.css'].includes(request.url)) {
        const name = request.url === '/' ? 'index.html' : request.url.slice(1);
        return reply(200, fs.readFileSync(path.join(root, 'public', name)), name.endsWith('.html') ? 'text/html' : name.endsWith('.js') ? 'text/javascript' : 'text/css');
      }
      const auth = request.headers.authorization || '';
      const role = equal(auth, 'Bearer '+tokens.human) ? 'human' : equal(auth, 'Bearer '+tokens.agent) ? 'agent' : null;
      if (!role) return reply(401, { error: 'UNAUTHORIZED' });
      if (request.method === 'GET' && request.url === '/api/tools') return reply(200, Object.entries(actions).filter(([, action]) => role === 'human' || action.agentTool !== false).map(([name, action]) => ({ name, ...action.tool })));
      const match = /^\/api\/actions\/([a-z]+)$/.exec(request.url);
      if (request.method !== 'POST' || !match) return reply(404, { error: 'NOT_FOUND' });
      if (request.headers['content-type'] !== 'application/json' || request.headers['transfer-encoding'] || !/^\d+$/.test(request.headers['content-length'] || '') || Number(request.headers['content-length']) > 250_000) return reply(400, { error: 'JSON_BODY_REQUIRED' });
      let bytes = 0; const chunks = [];
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 250_000) throw Error('BODY_LIMIT'); chunks.push(chunk); }
      let input; try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400, { error: 'INVALID_JSON' }); }
      return reply(200, await invoke(actions, match[1], input, role));
    } catch (error) {
      const status = error.statusCode || (error.name === 'ActionInputValidationError' ? 400 : 503);
      return reply(status, { error: error.code || error.errorCode || (status === 400 ? 'INVALID_INPUT' : 'SERVICE_ERROR'), message: status < 500 ? error.message : 'Operation was interrupted. Inspect the saved receipt before retrying.' });
    }
  });
  server.requestTimeout = 10_000; server.headersTimeout = 10_000;
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tokens = JSON.parse(fs.readFileSync(path.join(root, '.data/roles.json'), 'utf8'));
  const desk = new Desk(path.join(root, '.data'));
  const port = Number(process.env.PORT || 4185);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local port.');
  makeServer(desk, tokens).listen(port, '127.0.0.1', () => console.log(`Patch Review Desk: http://127.0.0.1:${port} — fixture workspace, model off.`));
}
