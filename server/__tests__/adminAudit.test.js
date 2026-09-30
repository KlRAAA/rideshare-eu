require('dotenv').config({ quiet: true });
const prisma = require('../config/db');
const { record, withNames } = require('../services/adminActionService');
const { promoteByEmail } = require('../scripts/makeAdmin');
const { newBag, makeUser, cleanup } = require('../test-helpers/seed');

let dbUp = false;
const bag = newBag();

beforeAll(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbUp = true;
  } catch {
    /* dbUp stays false */
  }
});

afterAll(async () => {
  if (dbUp) await cleanup(bag);
  await prisma.$disconnect().catch(() => {});
});

const guard = () => !dbUp;

describe('adminActionService.record', () => {
  test('writes one audit row with the given fields', async () => {
    if (guard()) return;
    const actor = await makeUser(bag, { fullName: 'Audit Actor' });
    const target = await makeUser(bag, { fullName: 'Audit Target' });

    const row = await record(prisma, {
      actorId: actor.id,
      action: 'BAN',
      targetUserId: target.id,
      details: { duration: '24H' },
    });

    expect(row.action).toBe('BAN');
    expect(row.details).toEqual({ duration: '24H' });
    const [named] = await withNames([row]);
    expect(named.actorName).toBe('Audit Actor');
    expect(named.targetUserName).toBe('Audit Target');
  });

  test('rolls back with the surrounding transaction', async () => {
    if (guard()) return;
    const target = await makeUser(bag);
    await expect(
      prisma.$transaction(async (tx) => {
        await record(tx, { action: 'UNBAN', targetUserId: target.id });
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(await prisma.adminAction.count({ where: { targetUserId: target.id } })).toBe(0);
  });
});

describe('make-admin script', () => {
  test('promotes by email and records a PROMOTE row with no actor', async () => {
    if (guard()) return;
    const user = await makeUser(bag);
    expect(await promoteByEmail(user.email)).toEqual({ alreadyAdmin: false });
    const saved = await prisma.user.findUnique({ where: { id: user.id }, select: { isAdmin: true } });
    expect(saved.isAdmin).toBe(true);
    const audit = await prisma.adminAction.findFirst({ where: { targetUserId: user.id, action: 'PROMOTE' } });
    expect(audit.actorId).toBeNull();
    expect(await promoteByEmail(user.email)).toEqual({ alreadyAdmin: true });
  });

  test('rejects an unknown email', async () => {
    if (guard()) return;
    await expect(promoteByEmail('nobody-here@test.local')).rejects.toThrow('USER_NOT_FOUND');
  });
});
