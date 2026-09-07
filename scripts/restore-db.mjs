// Restore a JSON dump produced by the migration backup into the database that
// DATABASE_URL currently points at.
//
//   node scripts/restore-db.mjs [backups/<dir>] [--force]
//
// - No dir given: uses the newest folder under backups/.
// - Refuses to run if the target already has users, unless --force is passed
//   (which wipes the target's data first).
//
// Models are inserted parents-first so foreign keys resolve. Every scalar field
// is preserved, including ids, password hashes, JSON route geometry and dates.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const MODELS = ['user', 'vehicle', 'trip', 'match', 'notification', 'preference', 'rating', 'emailVerification'];

const args = process.argv.slice(2);
const force = args.includes('--force');
const dirArg = args.find((a) => !a.startsWith('--'));

const backupDir =
  dirArg ||
  path.join(
    'backups',
    fs
      .readdirSync('backups')
      .filter((d) => fs.statSync(path.join('backups', d)).isDirectory())
      .sort()
      .pop() || '',
  );

if (!backupDir || !fs.existsSync(path.join(backupDir, 'data.json'))) {
  console.error(`No data.json found in "${backupDir}"`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path.join(backupDir, 'data.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const retry = async (fn, n = 8) => {
  for (let i = 0; i < n; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!['P1017', 'P1001'].includes(e.code)) throw e;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  throw new Error('database unreachable after retries');
};

console.log(`Restoring from ${backupDir}`);
console.log(`  → ${process.env.DATABASE_URL}\n`);

const existingUsers = await retry(() => prisma.user.count());
if (existingUsers > 0 && !force) {
  console.error(`Target already has ${existingUsers} users. Pass --force to wipe and restore.`);
  await prisma.$disconnect();
  process.exit(1);
}

if (force && existingUsers > 0) {
  console.log('--force: clearing target data first');
  for (const m of [...MODELS].reverse()) await retry(() => prisma[m].deleteMany());
}

const restored = {};
for (const m of MODELS) {
  const rows = data[m] || [];
  if (rows.length) await retry(() => prisma[m].createMany({ data: rows }));
  restored[m] = await retry(() => prisma[m].count());
}

console.log('\nRow counts — backup vs restored:');
let mismatch = false;
for (const m of MODELS) {
  const want = manifest.counts[m] ?? 0;
  const got = restored[m];
  const ok = want === got;
  if (!ok) mismatch = true;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${m}: backup ${want} / restored ${got}`);
}

await prisma.$disconnect();
if (mismatch) {
  console.error('\nRow counts do not match — restore is NOT complete.');
  process.exit(1);
}
console.log('\nRestore complete, all row counts match.');
