// Runs before `npm run dev` and `npm start` (see package.json) and fixes or
// explains the common first-run problems. Only uses Node built-ins, so it
// works even before `npm install`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'dev';

function fail(lines) {
  console.error(`\n  ✖ ${lines.join('\n    ')}\n`);
  process.exit(1);
}

function npm(args) {
  // npm_execpath points at npm itself when we're run from an npm script.
  const r = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, stdio: 'inherit' })
    : spawnSync(`npm ${args.join(' ')}`, { cwd: root, stdio: 'inherit', shell: true });
  return r.status === 0;
}

// 1. Node version: Vite, better-sqlite3 and friends need 22.12 or newer.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  fail([
    `Your Node.js is version ${process.versions.node}, but this app needs 22.12 or newer.`,
    'Download the "LTS" version from https://nodejs.org, install it,',
    'then close this window, open a new one and try again.',
  ]);
}

// 2. Libraries: install them automatically the first time.
const needed = ['vite', 'concurrently', 'tsx', 'better-sqlite3', 'express', 'react'];
const missing = needed.filter((p) => !fs.existsSync(path.join(root, 'node_modules', p, 'package.json')));
if (missing.length) {
  console.log('\n  First run: installing the libraries the app needs (this takes a minute)…\n');
  if (!npm(['install'])) fail(['"npm install" failed. Scroll up for the error, or send it to whoever is helping you.']);
}

// 3. The database driver must load on this computer.
try {
  const Database = createRequire(path.join(root, 'package.json'))('better-sqlite3');
  new Database(':memory:').close();
} catch (err) {
  fail([
    'The database library (better-sqlite3) could not load on this computer:',
    String(err?.message ?? err).split('\n')[0],
    'Try deleting the "node_modules" folder and running "npm install" again.',
  ]);
}

// 4. `npm start` serves the built site, so build it if that hasn't happened yet.
if (mode === 'start' && !fs.existsSync(path.join(root, 'dist', 'client', 'index.html'))) {
  console.log('\n  Building the site first (only needed once, and after updates)…\n');
  if (!npm(['run', 'build'])) fail(['The build failed. Scroll up for the error.']);
}
