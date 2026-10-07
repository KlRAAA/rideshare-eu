const { Prisma } = require('@prisma/client');
const BACKUP_MODELS = require('../../scripts/backupModels.cjs');

// A table missing from the backup list would be silently left out of every
// backup (it happened: the list had 8 of 19 tables).
test('the backup list covers every table exactly once', () => {
  const all = Object.keys(Prisma.ModelName).map((name) => name[0].toLowerCase() + name.slice(1));
  expect([...BACKUP_MODELS].sort()).toEqual(all.sort());
});
