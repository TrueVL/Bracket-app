import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { openDb } from './db';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = Number(process.env.PORT ?? 3001);
// `npm run dev` passes --dev: Vite serves the pages, this process only the API.
const dev = process.argv.includes('--dev');
const DEV_SITE = 'http://localhost:5173';

const db = openDb();
const app = createApp({
  db,
  clientDir: dev ? undefined : path.join(root, 'dist', 'client'),
  devClientUrl: dev ? DEV_SITE : undefined,
  // Unset = automatic: Secure cookies whenever the site is reached over HTTPS.
  secureCookies: process.env.SECURE_COOKIES ? process.env.SECURE_COOKIES === 'true' : undefined,
});

const server = app.listen(port, (err?: Error) => {
  if (err) return; // reported by the 'error' handler below
  if (dev) console.log(`API server ready. Open the site at ${DEV_SITE}`);
  else console.log(`Bracket Club is running. Open http://localhost:${port} in your browser.`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EADDRINUSE') throw err;
  console.error(
    `\n  ✖ Port ${port} is already in use. Bracket Club is probably already running in another window —` +
      `\n    close that window (or press Ctrl+C in it) and try again.\n`,
  );
  process.exit(1);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
