// Grants admin to an existing account: npm run make-admin <email>
// Only for the first admin — after that, admins promote each other in the app.
require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { record } = require('../services/adminActionService');

async function promoteByEmail(email) {
  const user = await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } }, select: { id: true, isAdmin: true } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.isAdmin) return { alreadyAdmin: true };
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { isAdmin: true } });
    await record(tx, { action: 'PROMOTE', targetUserId: user.id, details: { via: 'make-admin script' } });
  });
  return { alreadyAdmin: false };
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run make-admin <email>');
    process.exitCode = 1;
    return;
  }
  try {
    const { alreadyAdmin } = await promoteByEmail(email.trim().toLowerCase());
    console.warn(alreadyAdmin ? `${email} is already an admin.` : `${email} is now an admin.`);
  } catch (err) {
    console.error(err.message === 'USER_NOT_FOUND' ? `No account with email ${email}.` : err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main();

module.exports = { promoteByEmail };
