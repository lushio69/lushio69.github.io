import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { normalizeBase } from './lib/utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const base = normalizeBase(config.basePath);
const startPort = Number(process.env.PORT) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf',
};

function build() {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });
  return result.status === 0;
}

function watch() {
  let timer = null;
  let building = false;
  let pending = false;

  const rebuild = () => {
    if (building) {
      pending = true;
      return;
    }
    building = true;
    console.log('\n  Change detected — rebuilding…');
    const ok = build();
    building = false;
    if (ok) broadcast('reload');
    else broadcast('error');
    if (pending) {
      pending = false;
      setTimeout(rebuild, 120);
    }
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 150);
  };

  const targets = [path.join(ROOT, 'content'), path.join(ROOT, 'src'), path.join(ROOT, 'site.config.json')];
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    try {
      fs.watch(target, { recursive: true }, schedule);
    } catch (error) {
      console.warn(`  Could not watch ${path.relative(ROOT, target)}: ${error.message}`);
    }
  }
}

const clients = new Set();

function broadcast(event) {
  for (const response of clients) {
    response.write(`event: ${event}\ndata: reload\n\n`);
  }
}

function safePath(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split('?')[0]);
  } catch (error) {
    return null;
  }

  if (base !== '/' && pathname === '/') return { redirect: base };
  let relative = pathname;
  if (base !== '/') {
    if (!pathname.startsWith(base)) return null;
    relative = pathname.slice(base.length - 1);
  }

  const clean = relative.replace(/^\/+/, '');
  const resolved = path.resolve(DIST, clean || 'index.html');
  if (!resolved.startsWith(DIST + path.sep) && resolved !== DIST) return null;
  return { resolved, pathname };
}

function serveFile(response, filePath, pathname, status = 200) {
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      if (!path.extname(filePath)) {
        const index = path.join(filePath, 'index.html');
        if (fs.existsSync(index)) return serveFile(response, index, pathname, status);
        const html = `${filePath}.html`;
        if (fs.existsSync(html)) return serveFile(response, html, pathname, status);
      }
      const notFound = path.join(DIST, '404.html');
      if (fs.existsSync(notFound) && pathname !== '/404.html') {
        return serveFile(response, notFound, '/404.html', 404);
      }
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('404 — Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    response.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });

    if (ext === '.html') {
      let html = fs.readFileSync(filePath, 'utf8');
      const script = `<script>
        (() => {
          const source = new EventSource('${base}__livereload');
          source.addEventListener('reload', () => window.location.reload());
        })();
      </script>`;
      html = html.replace('</body>', `${script}</body>`);
      response.end(html);
      return;
    }

    fs.createReadStream(filePath).pipe(response);
  });
}

function startServer(port) {
  const server = http.createServer((request, response) => {
    const urlPath = request.url || '/';

    if (urlPath.split('?')[0] === `${base}__livereload`) {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      response.write('retry: 1000\n\n');
      clients.add(response);
      const heartbeat = setInterval(() => response.write(': ping\n\n'), 25000);
      request.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(response);
      });
      return;
    }

    const target = safePath(urlPath);
    if (!target) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('404 — Not found');
      return;
    }
    if (target.redirect) {
      response.writeHead(302, { Location: target.redirect });
      response.end();
      return;
    }
    serveFile(response, target.resolved, target.pathname);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < startPort + 10) {
      startServer(port + 1);
    } else {
      console.error(error);
      process.exit(1);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`\n  Local preview  →  http://localhost:${port}${base}`);
    console.log('  Watching content/, src/ and site.config.json\n');
  });

  const close = () => {
    for (const client of clients) client.end();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

if (!build()) {
  console.error('\n  Build failed. Fix the error above, then run again.');
  process.exit(1);
}
watch();
startServer(startPort);
