import { describe, test, expect } from '@jest/globals';
import { dayLabel, dayStatusLabel, findAnotherRideHref, riderDayLine, NO_SHOW_CANCEL_REASON, type TripDay } from '../tripDays';

// 2026-10-13T23:00Z = Wednesday 14 Oct, 7:00 AM in the Philippines.
const DEP = '2026-10-13T23:00:00.000Z';
const day = (status: TripDay['status']): TripDay => ({ date: '2026-10-14', departure: DEP, status });
const base = { status: 'OPEN', cancelReason: null, days: [] as TripDay[], nextDeparture: null, currentRun: null };

describe('labels', () => {
  test('a day reads as weekday, date and month', () => {
    expect(dayLabel('2026-10-14')).toBe('Wed 14 Oct');
  });
  test('each status has a plain label', () => {
    expect(dayStatusLabel(null)).toBe('Not confirmed');
    expect(dayStatusLabel('CONFIRMED')).toBe('Confirmed');
    expect(dayStatusLabel('SKIPPED')).toBe('Skipped');
    expect(dayStatusLabel('NO_SHOW')).toBe('No-show');
  });
});

describe('findAnotherRideHref', () => {
  test('fills in the trip’s places and the day’s Philippine date and time', () => {
    const href = findAnotherRideHref(
      { originAddress: 'Sariaya', originLat: 13.96, originLng: 121.52, destinationAddress: 'MSEUF', destinationLat: 13.95, destinationLng: 121.62 },
      DEP
    );
    const q = new URLSearchParams(href.split('?')[1]);
    expect(href.startsWith('/auth/search?')).toBe(true);
    expect(Object.fromEntries(q)).toEqual({
      origin: 'Sariaya',
      olat: '13.960000',
      olng: '121.520000',
      destination: 'MSEUF',
      dlat: '13.950000',
      dlng: '121.620000',
      date: '2026-10-14',
      time: '07:00',
    });
  });
});

describe('riderDayLine', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  test('the next day’s status', () => {
    expect(riderDayLine({ ...base, days: [day('CONFIRMED')] }, now)).toMatchObject({ text: 'Your driver confirmed Wed 14 Oct.', tone: 'ok', findAnother: false });
    expect(riderDayLine({ ...base, days: [day('SKIPPED')] }, now)).toMatchObject({ text: 'Your driver isn’t driving on Wed 14 Oct.', tone: 'warn', findAnother: true });
    expect(riderDayLine({ ...base, days: [day(null)] }, now)).toMatchObject({ text: 'Not confirmed yet for Wed 14 Oct.', tone: 'neutral' });
    expect(riderDayLine(base, now)).toBeNull();
  });
  test('late after 15 minutes, nothing to say before', () => {
    const nextDeparture = { departure: DEP };
    expect(riderDayLine({ ...base, nextDeparture }, new Date('2026-10-13T23:10:00Z'))).toBeNull();
    expect(riderDayLine({ ...base, nextDeparture }, new Date('2026-10-13T23:15:00Z'))).toMatchObject({
      text: 'Your driver hasn’t started yet.',
      findAnother: true,
      departure: DEP,
    });
    expect(riderDayLine({ ...base, nextDeparture, currentRun: { status: 'ONGOING' } }, new Date('2026-10-13T23:20:00Z'))).toBeNull();
  });
  test('a trip cancelled because the driver never came', () => {
    expect(riderDayLine({ ...base, status: 'CANCELLED', cancelReason: NO_SHOW_CANCEL_REASON }, now)).toMatchObject({
      text: 'Your driver didn’t start this trip.',
      tone: 'bad',
      findAnother: true,
    });
    expect(riderDayLine({ ...base, status: 'CANCELLED', cancelReason: 'Car broke down' }, now)).toBeNull();
  });
});
