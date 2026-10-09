// Weekly official fuel prices from the DOE (rules: doeFuelRules.js). Runs on
// the server's cron and from the admin's "Check DOE now". A file is handled
// once: applied when every grade moved 15% or less, otherwise held for an
// admin's tap; a file that can't be read tells the admins to set prices by hand.
const prisma = require('../config/db');
const { record } = require('./adminActionService');
const { getOfficialFuelPrices } = require('./fuelPriceService');
const { newestRegionFile, parseRegionReport, decideImport } = require('./doeFuelRules');
const { pdfLines } = require('./doePdf');

const DOE_SOUTH_LUZON_URL = 'https://doe.gov.ph/data-and-prices/liquid-fuels/retail-pump-prices/south-luzon-pump-prices';
const TIMEOUT_MS = 30 * 1000;
const MAX_BYTES = 10 * 1024 * 1024;
const HEADERS = { 'User-Agent': 'RideShareEU/1.0 (MSEUF campus carpool; weekly fuel price check)' };
const RECENT_LIMIT = 5;

// Network and PDF reading, replaced in tests. Under Jest nothing reaches the DOE
// unless a test supplies a source.
const realSource = { fetch: (url, init) => fetch(url, init), readPdf: pdfLines };
let source = process.env.NODE_ENV === 'test' ? null : realSource;
function setDoeSource(next) {
  source = next;
}

const phDay = (now) => now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

async function download(url) {
  const res = await source.fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > MAX_BYTES) throw new Error(`${url} is larger than ${MAX_BYTES} bytes`);
  return body;
}

const prices = (row) => ({ REGULAR: row.regular, PREMIUM: row.premium, DIESEL: row.diesel });

async function applyChanges(tx, row, changes, adminId) {
  for (const c of changes) {
    await tx.fuelPrice.create({ data: { fuelType: c.fuelType, pricePerLiter: c.to, setById: adminId, importId: row.id } });
    await record(tx, {
      actorId: adminId,
      action: 'FUEL_PRICE_SET',
      details: { fuelType: c.fuelType, from: c.from, to: c.to, source: 'DOE', period: row.period },
    });
  }
}

async function notifyAdmins(tx, row) {
  const week = row.period ? ` for ${row.period}` : '';
  const message =
    row.status === 'HELD'
      ? `The DOE prices${week} wait for you: ${row.reason} Apply them or keep the current prices on the Fuel price page.`
      : `This week’s DOE fuel prices couldn’t be read automatically: ${row.reason} Set the official prices by hand.`;
  const admins = await tx.user.findMany({ where: { isAdmin: true, deletedAt: null }, select: { id: true } });
  if (admins.length > 0) {
    await tx.notification.createMany({ data: admins.map((a) => ({ userId: a.id, type: 'FUEL_PRICE_CHECK', message })) });
  }
}

// Saves the outcome for a file (or a day's page failure) exactly once; a
// second run that finds it already saved changes nothing.
async function recordOnce(data, changes = []) {
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.doeFuelImport.create({ data });
      if (data.status === 'APPLIED') await applyChanges(tx, created, changes, null);
      else await notifyAdmins(tx, created);
      return created;
    });
    return { import: row, alreadyHandled: false };
  } catch (err) {
    if (err.code !== 'P2002') throw err;
    return { import: await prisma.doeFuelImport.findUnique({ where: { key: data.key } }), alreadyHandled: true };
  }
}

async function check(now) {
  if (!source) throw new Error('DOE source not set (tests must call setDoeSource)');
  let file;
  try {
    file = newestRegionFile((await download(DOE_SOUTH_LUZON_URL)).toString('utf8'), now);
  } catch (err) {
    console.error(`[doe fuel] page unreachable: ${err.message}`);
    return { unreachable: true };
  }
  if (!file) return recordOnce({ key: `page:${phDay(now)}`, status: 'FAILED', reason: 'The DOE page lists no Region IV-A file.' });

  const existing = await prisma.doeFuelImport.findUnique({ where: { key: file.url } });
  if (existing) return { import: existing, alreadyHandled: true };

  let pdf;
  try {
    pdf = await download(file.url);
  } catch (err) {
    console.error(`[doe fuel] file unreachable: ${err.message}`);
    return { unreachable: true };
  }
  let parsed;
  try {
    parsed = parseRegionReport(await source.readPdf(pdf));
  } catch {
    parsed = { error: 'The file couldn’t be read as a PDF.' };
  }
  const base = { key: file.url, sourceUrl: file.url };
  if (parsed.error) return recordOnce({ ...base, status: 'FAILED', reason: parsed.error });

  const { REGULAR, PREMIUM, DIESEL } = parsed.prices;
  const fields = { ...base, period: parsed.period, regular: REGULAR, premium: PREMIUM, diesel: DIESEL };
  const decision = decideImport(parsed.prices, await getOfficialFuelPrices());
  if (decision.status === 'HELD') return recordOnce({ ...fields, status: 'HELD', reason: decision.reason });
  return recordOnce({ ...fields, status: 'APPLIED' }, decision.changes);
}

// One check at a time: the cron and an admin's tap share a run.
let running = null;
function checkDoeFuelPrices(now = new Date()) {
  running ??= check(now).finally(() => {
    running = null;
  });
  return running;
}

// An admin applies a held file: { import } or { error: 'NOT_FOUND' | 'NOT_HELD' }.
async function applyHeldImport(id, adminId, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.doeFuelImport.findUnique({ where: { id } });
    if (!row) return { error: 'NOT_FOUND' };
    const decided = { status: 'APPLIED', decidedById: adminId, decidedAt: now };
    const { count } = await tx.doeFuelImport.updateMany({ where: { id, status: 'HELD' }, data: decided });
    if (count === 0) return { error: 'NOT_HELD' };
    const { changes } = decideImport(prices(row), await getOfficialFuelPrices(tx));
    await applyChanges(tx, row, changes, adminId);
    return { import: { ...row, ...decided } };
  });
}

// An admin keeps the current prices instead.
async function dismissHeldImport(id, adminId, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.doeFuelImport.findUnique({ where: { id } });
    if (!row) return { error: 'NOT_FOUND' };
    const decided = { status: 'DISMISSED', decidedById: adminId, decidedAt: now };
    const { count } = await tx.doeFuelImport.updateMany({ where: { id, status: 'HELD' }, data: decided });
    if (count === 0) return { error: 'NOT_HELD' };
    await record(tx, { actorId: adminId, action: 'DOE_PRICES_DISMISSED', details: { period: row.period, ...prices(row) } });
    return { import: { ...row, ...decided } };
  });
}

function recentImports() {
  return prisma.doeFuelImport.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: RECENT_LIMIT });
}

module.exports = {
  DOE_SOUTH_LUZON_URL,
  setDoeSource,
  checkDoeFuelPrices,
  applyHeldImport,
  dismissHeldImport,
  recentImports,
};
