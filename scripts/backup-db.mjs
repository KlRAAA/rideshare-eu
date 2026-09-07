// Snapshot every table from the database DATABASE_URL points at into
// backups/<timestamp>/ (gitignored). Portable JSON — no pg_dump / version
// matching needed. Restore with scripts/restore-db.mjs.
//
//   node scripts/backup-db.mjs
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const MODELS = ['user', 'vehicle', 'trip', 'match', 'notification', 'preference', 'rating', 'emailVerification'];

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }) });
const retry = async (fn, n = 12) => {
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

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.join('backups', stamp);
fs.mkdirSync(dir, { recursive: true });

const data = {};
const counts = {};
for (const m of MODELS) {
  const rows = await retry(() => prisma[m].findMany());
  data[m] = rows;
  counts[m] = rows.length;
  console.log(`  ${m}: ${rows.length}`);
}

fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(data, null, 2));
fs.writeFileSync(
  path.join(dir, 'manifest.json'),
  JSON.stringify({ takenAt: new Date().toISOString(), source: process.env.DATABASE_URL, counts, models: MODELS }, null, 2),
);
fs.writeFileSync(
  path.join(dir, 'identity-check.json'),
  JSON.stringify(
    {
      users: data.user.map((u) => ({ id: u.id, email: u.email, fullName: u.fullName, universityId: u.universityId })),
      trips: data.trip.map((t) => ({ id: t.id, hostId: t.hostId, origin: t.originAddress, dest: t.destinationAddress, status: t.status })),
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
console.log(`\nBackup written to ${dir}/`);
