// UI mirror of server/config/serviceArea.js: places must be in Luzon and its
// nearby islands. Keep the numbers in step with the server, which is the one
// that actually refuses a trip outside it.
const LUZON = { south: 12.0, north: 21.2, west: 119.4, east: 124.6 };

export const OUTSIDE_LUZON_MESSAGE = 'Pick a place in Luzon. RideShareEU only covers trips in Luzon.';

export function inLuzon(point: { lat: number; lng: number }): boolean {
  return point.lat >= LUZON.south && point.lat <= LUZON.north && point.lng >= LUZON.west && point.lng <= LUZON.east;
}
