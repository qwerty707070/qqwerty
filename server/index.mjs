import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './launcherBackend.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PORT = Number(process.env.PORT || 3000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (handleApiRequest(req, res, PROJECT_ROOT)) {
    return;
  }

  const parsed = new URL(req.url || '/', 'http://localhost');
  let safeRel = path.normalize(decodeURIComponent(parsed.pathname)).replace(/^(\.\.(\/|\\|$))+/, '');
  if (safeRel === '/' || safeRel === '') safeRel = '/index.html';

  let target = path.join(DIST_DIR, safeRel);
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    target = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(target).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Aether Visual Production Server running at http://0.0.0.0:${PORT}`);
});
