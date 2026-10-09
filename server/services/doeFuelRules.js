// Official fuel prices from the DOE's weekly price monitoring (pure). The DOE
// South Luzon page lists one PDF per region per week; the Region IV-A file has
// a block per city, and Lucena's highest monitored price per grade becomes
// the cap. Network and database work: doeFuelService.js.
const { FUEL_TYPES, isValidFuelPrice } = require('./fuelPriceService');

// A change bigger than this waits for an admin's tap.
const MAX_AUTO_CHANGE = 0.15;
// The DOE product row for each grade.
const PRODUCT_ROWS = { REGULAR: 'RON 91', PREMIUM: 'RON 95', DIESEL: 'DIESEL' };
const GRADE_NAMES = { REGULAR: 'Regular', PREMIUM: 'Premium', DIESEL: 'Diesel' };
const CITY = /^lucena(\s+city)?$/i;
const PRODUCT = /^(RON \d+|DIESEL( PLUS)?|KEROSENE)$/;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH = `(${MONTHS.join('|')})`;
// On the page, a year heading ("2026") is followed by its weeks, each a label
// ("September 29 to October 5", "October 6 to 12") and that week's files.
const WEEK = String.raw`${MONTH}\s+(\d{1,2})\s*(?:to|-|–)\s*(?:${MONTH}\s+)?(\d{1,2})`;
const YEAR_OR_WEEK = new RegExp(String.raw`(?:^|\s)(20\d\d)(?=\s|$)|${WEEK}`, 'gi');
const ANCHOR = /<a\b[^>]*?\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
const pad = (n) => String(n).padStart(2, '0');

// The week's last day as YYYY-MM-DD, in the year of the heading above it
// (weeks are listed under the month they end in). Without a heading: the
// latest year that doesn't put the week in the future.
function weekEnd(m, year, now) {
  const month = MONTHS.indexOf((m[4] ?? m[2]).toLowerCase());
  const day = Number(m[5]);
  let y = year ?? now.getUTCFullYear();
  if (year == null && Date.UTC(y, month, day) > now.getTime() + 3 * 86400000) y -= 1;
  return `${y}-${pad(month + 1)}-${pad(day)}`;
}

// { url, weekEnd } of the newest Region IV-A file, or null.
function newestRegionFile(html, now) {
  let year = null;
  let end = null;
  let last = 0;
  let newest = null;
  for (const a of html.matchAll(ANCHOR)) {
    for (const m of text(html.slice(last, a.index)).matchAll(YEAR_OR_WEEK)) {
      if (m[1]) year = Number(m[1]);
      else end = weekEnd(m, year, now);
    }
    last = a.index + a[0].length;
    const url = a[1].replace(/&amp;/g, '&');
    if (!end || !url.startsWith('https://') || !/IV\s*-\s*A\b/i.test(text(a[2]))) continue;
    if (!newest || end > newest.weekEnd) newest = { url, weekEnd: end };
  }
  return newest;
}

const product = (cells) => (cells[0] ?? '').trim().toUpperCase();
const isProductRow = (cells) => PRODUCT.test(product(cells));

// The highest monitored price: rows end "low | - | high | common".
function highest(cells) {
  const dash = cells.lastIndexOf('-');
  return dash > 0 ? Number(cells[dash + 1]) : Number.NaN;
}

const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

// lines: the PDF text, one array of cells per printed line.
// → { period, prices: { REGULAR, PREMIUM, DIESEL } } or { error }.
function parseRegionReport(lines) {
  if (!lines.some((cells) => cells.some((c) => /^REGION IV-A$/i.test(c.trim())))) {
    return { error: 'This isn’t the Region IV-A report.' };
  }
  const at = lines.findIndex((cells) => !isProductRow(cells) && cells.some((c) => CITY.test(c.trim())));
  if (at < 0) return { error: 'Lucena isn’t in this file.' };

  // The city's name is printed halfway down its block (between RON 95 and
  // RON 91); the block runs from its RON 100 row to its KEROSENE row.
  let start = at;
  while (start > 0 && product(lines[start - 1]) !== 'KEROSENE' && product(lines[start]) !== 'RON 100') start--;
  let end = at;
  while (end < lines.length - 1 && product(lines[end + 1]) !== 'RON 100' && product(lines[end]) !== 'KEROSENE') end++;
  const block = lines.slice(start, end + 1);

  const prices = {};
  for (const type of FUEL_TYPES) {
    const row = block.find((cells) => product(cells) === PRODUCT_ROWS[type]);
    const price = row ? highest(row) : Number.NaN;
    if (!isValidFuelPrice(price)) return { error: `No usable Lucena price for ${GRADE_NAMES[type]}.` };
    prices[type] = price;
  }

  const periodLine = lines.find((cells) => cells.some((c) => /PERIOD OF/i.test(c)))?.join(' ') ?? '';
  const period = periodLine.match(/PERIOD OF\s*(.+?)\)?\s*$/i)?.[1].trim();
  return { period: period ? titleCase(period) : null, prices };
}

const peso = (n) => `₱${n.toFixed(2)}`;

// found: { REGULAR, PREMIUM, DIESEL } from the file; current: the official
// prices ({ pricePerLiter } | null per grade).
// → { status: 'APPLIED' | 'HELD', reason?, changes: [{ fuelType, from, to }] }
function decideImport(found, current) {
  const changes = FUEL_TYPES.map((t) => ({ fuelType: t, from: current[t]?.pricePerLiter ?? null, to: found[t] })).filter(
    (c) => c.from === null || Math.round(c.from * 100) !== Math.round(c.to * 100)
  );
  const jump = changes.find((c) => c.from !== null && Math.abs(c.to - c.from) / c.from > MAX_AUTO_CHANGE);
  if (!jump) return { status: 'APPLIED', changes };
  return {
    status: 'HELD',
    reason: `${GRADE_NAMES[jump.fuelType]} changed by more than ${MAX_AUTO_CHANGE * 100}% (${peso(jump.from)} to ${peso(jump.to)}).`,
    changes,
  };
}

module.exports = { MAX_AUTO_CHANGE, newestRegionFile, parseRegionReport, decideImport };
