import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { openDb } from './db';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = Number(process.env.PORT ?? 3001);

const db = openDb();
const app = createApp({
  db,
  clientDir: path.join(root, 'dist', 'client'),
  // Unset = automatic: Secure cookies whenever the site is reached over HTTPS.
  secureCookies: process.env.SECURE_COOKIES ? process.env.SECURE_COOKIES === 'true' : undefined,
});

const server = app.listen(port, () => {
  console.log(`Bracket app listening on http://localhost:${port}`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
