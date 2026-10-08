// Where the app looks up and accepts places: Luzon and its nearby islands
// (Mindoro, Marinduque, Catanduanes, Batanes), per the panel revisions (§7).
// A box, so its edges are approximate: the northern tip of Samar and part of
// Masbate also fall inside.
const LUZON = { south: 12.0, north: 21.2, west: 119.4, east: 124.6 };

// Photon's bbox order: west,south,east,north.
const LUZON_BBOX = `${LUZON.west},${LUZON.south},${LUZON.east},${LUZON.north}`;

function inLuzon(lat, lng) {
  return lat >= LUZON.south && lat <= LUZON.north && lng >= LUZON.west && lng <= LUZON.east;
}

module.exports = { LUZON, LUZON_BBOX, inLuzon };
