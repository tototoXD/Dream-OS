import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenAiDreamProvider } from './openai-provider.js';
import { ZhipuDreamProvider } from './zhipu-provider.js';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(serverDir, '..');
const dreamOsRoot = path.resolve(rootDir, '../..');

function loadDotEnv(file = path.join(serverDir, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadDotEnv();
const providerName = String(process.env.AI_PROVIDER || 'zhipu').toLowerCase();
const provider = providerName === 'openai' ? new OpenAiDreamProvider() : new ZhipuDreamProvider();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const maxBodyBytes = 12 * 1024 * 1024;

function json(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': process.env.ALLOWED_ORIGIN || '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(value));
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8'
};

async function servePrototype(req, res) {
  if (req.method !== 'GET') return false;
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const aliases = {
    '/': '05_UX/prototype/index.html',
    '/index.html': '05_UX/prototype/index.html',
    '/manifest.webmanifest': '05_UX/prototype/manifest.webmanifest',
    '/sw.js': '05_UX/prototype/sw.js',
    '/icon.svg': '05_UX/prototype/icon.svg',
    '/config.js': '05_UX/prototype/config.js'
  };
  const relative = aliases[pathname] || pathname.replace(/^\/+/, '');
  const file = path.resolve(dreamOsRoot, relative);
  if (!file.startsWith(`${dreamOsRoot}${path.sep}`) && file !== dreamOsRoot) return false;
  try {
    const stat = await fs.promises.stat(file);
    if (!stat.isFile()) return false;
    const ext = path.extname(file);
    res.writeHead(200, {
      'content-type': mimeTypes[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' || ext === '.js' ? 'no-cache' : 'public, max-age=3600',
      'access-control-allow-origin': process.env.ALLOWED_ORIGIN || '*'
    });
    res.end(await fs.promises.readFile(file));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const methods = new Set(['assessReadiness', 'startSession', 'continueSession', 'formulateUnderstanding', 'respondToSupplement']);
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method === 'GET' && req.url === '/healthz') return json(res, 200, { ok: true, aiConfigured: Boolean(provider.apiKey), provider: providerName, model: provider.model });
  try {
    if (req.method === 'POST' && req.url === '/api/ai') {
      const input = await body(req);
      if (!methods.has(input.operation)) return json(res, 400, { error: 'UNKNOWN_AI_OPERATION' });
      const result = await provider[input.operation](input.payload || {});
      return json(res, 200, result);
    }
    if (req.method === 'POST' && req.url === '/api/transcribe') {
      const input = await body(req);
      if (typeof provider.transcribe !== 'function') return json(res, 501, { error: 'TRANSCRIPTION_NOT_CONFIGURED' });
      return json(res, 200, await provider.transcribe(input));
    }
    if (await servePrototype(req, res)) return;
    return json(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    const message = String(error?.message || 'SERVER_ERROR');
    const status = message.endsWith('_API_KEY_MISSING') ? 503 : message === 'REQUEST_TOO_LARGE' ? 413 : 500;
    return json(res, status, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`Dream OS AI server listening on http://${host}:${port}`);
  console.log(`AI provider: ${providerName}; model: ${provider.model}; configured: ${Boolean(provider.apiKey)}`);
});
