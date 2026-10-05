// Sets the one superadmin (the school's Data Protection Officer):
//   npm run make-superadmin <email>            first time
//   npm run make-superadmin <email> --replace  handover to someone new
// Never available in the app, so a hacked admin account can't grant it.
require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { record } = require('../services/adminActionService');

async function makeSuperAdmin(email, { replace = false } = {}) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, deletedAt: true } });
  if (!user || user.deletedAt) throw new Error('USER_NOT_FOUND');
  const current = await prisma.user.findFirst({ where: { isSuperAdmin: true }, select: { id: true } });
  if (current?.id === user.id) return { already: true, replacedId: null };
  if (current && !replace) throw new Error('SUPERADMIN_EXISTS');

  await prisma.$transaction(async (tx) => {
    if (current) await tx.user.update({ where: { id: current.id }, data: { isSuperAdmin: false } });
    await tx.user.update({ where: { id: user.id }, data: { isAdmin: true, isSuperAdmin: true } });
    await record(tx, {
      action: 'SUPERADMIN_SET',
      targetUserId: user.id,
      details: { via: 'make-superadmin script', replacedId: current?.id ?? null },
    });
  });
  return { already: false, replacedId: current?.id ?? null };
}

const MESSAGES = {
  USER_NOT_FOUND: (email) => `No account with email ${email}.`,
  SUPERADMIN_EXISTS: () => 'There is already a superadmin. Use --replace to hand over.',
};

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || email.startsWith('--')) {
    console.error('Usage: npm run make-superadmin <email> [--replace]');
    process.exitCode = 1;
    return;
  }
  try {
    const { already } = await makeSuperAdmin(email, { replace: process.argv.includes('--replace') });
    console.warn(already ? `${email} is already the superadmin.` : `${email} is now the superadmin.`);
  } catch (err) {
    console.error(MESSAGES[err.message] ? MESSAGES[err.message](email) : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();

module.exports = { makeSuperAdmin };
