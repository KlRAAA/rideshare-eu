const fs = require('fs');
const path = require('path');
const { newestRegionFile, parseRegionReport, decideImport } = require('../doeFuelRules');

const FIXTURES = path.join(__dirname, '../../test-helpers/fixtures');
const PAGE = fs.readFileSync(path.join(FIXTURES, 'doe-south-luzon-page.html'), 'utf8');
const REPORT = fs
  .readFileSync(path.join(FIXTURES, 'doe-region-iv-a-2026-09-29.txt'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.split(' | '));

const link = (href, text) => `<li><a href="${href}" target="_blank">${text}</a></li>`;
const week = (label, ...links) => `<li>${label}</li><li><ul>${links.join('')}</ul></li>`;

describe('newestRegionFile', () => {
  test('finds the newest Region IV-A file on the real DOE page', () => {
    expect(newestRegionFile(PAGE, new Date('2026-10-09T06:00:00Z'))).toEqual({
      url: 'https://d24qbtp4vooyzi.cloudfront.net/api/media/file/Region%20IV-A%20CALABARZON%2029%20Sep%20to%205%20Oct%202026.pdf?prefix=dev%2Fmedia',
      weekEnd: '2026-10-05',
    });
  });

  test('takes the latest week even when the month lists its weeks oldest first', () => {
    const html =
      '<li>October</li>' +
      week('September 29 to October 5', link('https://x.example/a.pdf', 'Region IV - A Calabarzon')) +
      week('October 6 to 12', link('https://x.example/b.pdf', 'Region IV - A Calabarzon'), link('https://x.example/c.pdf', 'Region IV - B Mimaropa'));
    expect(newestRegionFile(html, new Date('2026-10-14T00:00:00Z')).url).toBe('https://x.example/b.pdf');
  });

  test('a week ending in January after a December week is the newer one', () => {
    const html =
      week('December 23 to 29', link('https://x.example/dec.pdf', 'Region IV - A Calabarzon')) +
      week('December 30 to January 5', link('https://x.example/jan.pdf', 'Region IV - A Calabarzon'));
    expect(newestRegionFile(html, new Date('2027-01-07T00:00:00Z'))).toEqual({ url: 'https://x.example/jan.pdf', weekEnd: '2027-01-05' });
  });

  test('ignores other regions and non-https links, and returns null when nothing is left', () => {
    const html =
      week('October 6 to 12', link('http://x.example/a.pdf', 'Region IV - A Calabarzon'), link('https://x.example/b.pdf', 'Region V - Bicol'));
    expect(newestRegionFile(html, new Date('2026-10-14T00:00:00Z'))).toBeNull();
  });
});

describe('parseRegionReport', () => {
  test('reads Lucena’s highest monitored price per grade from the real Sep 29 – Oct 5 file', () => {
    expect(parseRegionReport(REPORT)).toEqual({
      period: 'September 29-October 5, 2026',
      prices: { REGULAR: 91.16, PREMIUM: 96.86, DIESEL: 98.13 },
    });
  });

  test('a file without Lucena is an error', () => {
    const lines = REPORT.filter((cells) => cells[0] !== 'Lucena');
    expect(parseRegionReport(lines)).toEqual({ error: 'Lucena isn’t in this file.' });
  });

  test('a file for another region is an error', () => {
    const lines = REPORT.map((cells) => (cells[0] === 'REGION IV-A' ? ['REGION V'] : cells));
    expect(parseRegionReport(lines)).toEqual({ error: 'This isn’t the Region IV-A report.' });
  });

  test('a Lucena grade with no price is an error naming it', () => {
    const lucena = REPORT.findIndex((cells) => cells[0] === 'Lucena');
    const lines = REPORT.map((cells, i) => (i > lucena && cells[0] === 'DIESEL' && i < lucena + 3 ? ['DIESEL', '0.00', '-', '0.00', 'None'] : cells));
    expect(parseRegionReport(lines)).toEqual({ error: 'No usable Lucena price for Diesel.' });
  });
});

describe('decideImport', () => {
  const found = { REGULAR: 91.16, PREMIUM: 96.86, DIESEL: 98.13 };
  const current = (r, p, d) => ({
    REGULAR: r == null ? null : { pricePerLiter: r },
    PREMIUM: p == null ? null : { pricePerLiter: p },
    DIESEL: d == null ? null : { pricePerLiter: d },
  });

  test('applies changes of 15% or less, listing only the grades that changed', () => {
    expect(decideImport(found, current(85, 96.86, 90))).toEqual({
      status: 'APPLIED',
      changes: [
        { fuelType: 'REGULAR', from: 85, to: 91.16 },
        { fuelType: 'DIESEL', from: 90, to: 98.13 },
      ],
    });
  });

  test('a grade with no official price yet is applied, whatever its value', () => {
    expect(decideImport(found, current(null, null, null)).status).toBe('APPLIED');
  });

  test('holds the whole file when any grade moves more than 15%, and says which', () => {
    expect(decideImport(found, current(110, 96, 98))).toEqual({
      status: 'HELD',
      reason: 'Regular changed by more than 15% (₱110.00 to ₱91.16).',
      changes: [
        { fuelType: 'REGULAR', from: 110, to: 91.16 },
        { fuelType: 'PREMIUM', from: 96, to: 96.86 },
        { fuelType: 'DIESEL', from: 98, to: 98.13 },
      ],
    });
  });
});
