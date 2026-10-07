jest.mock('../services/addressSuggestService', () => ({ suggestAddresses: jest.fn() }));

require('dotenv').config({ quiet: true });
const app = require('../app');
const prisma = require('../config/db');
const { bearer } = require('../test-helpers/auth');
const { suggestAddresses } = require('../services/addressSuggestService');

let server;
let base;

beforeAll(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
});

const get = (path, userId) => fetch(`${base}${path}`, { headers: userId ? bearer(userId) : {} });

describe('GET /api/geocode/suggest', () => {
  test('needs a signed-in user', async () => {
    expect((await get('/api/geocode/suggest?q=lucena')).status).toBe(401);
  });

  test('returns the suggestions for the typed text', async () => {
    const place = { label: 'Puregold, Lucena', primary: 'Puregold', secondary: 'Lucena', lat: 13.94, lng: 121.61 };
    suggestAddresses.mockResolvedValueOnce([place]);
    const res = await get('/api/geocode/suggest?q=puregold', 'suggest-user');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suggestions: [place] });
    expect(suggestAddresses).toHaveBeenLastCalledWith('puregold');
  });

  test('no query or a repeated q parameter is treated as empty text', async () => {
    suggestAddresses.mockResolvedValue([]);
    expect(await (await get('/api/geocode/suggest', 'suggest-user')).json()).toEqual({ suggestions: [] });
    expect(suggestAddresses).toHaveBeenLastCalledWith('');
    await get('/api/geocode/suggest?q=a&q=b', 'suggest-user');
    expect(suggestAddresses).toHaveBeenLastCalledWith('');
  });

  test('very long text is cut to 200 characters before it is sent on', async () => {
    suggestAddresses.mockResolvedValue([]);
    await get(`/api/geocode/suggest?q=${'x'.repeat(500)}`, 'suggest-user');
    expect(suggestAddresses.mock.lastCall[0]).toHaveLength(200);
  });
});
