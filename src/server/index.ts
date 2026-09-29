import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { openDb } from './db';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3001);

const db = openDb();
const app = createApp({
  db,
  clientDir: path.join(root, 'dist', 'client'),
  secureCookies: process.env.SECURE_COOKIES ? process.env.SECURE_COOKIES === 'true' : production,
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
