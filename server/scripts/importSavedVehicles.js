// One-time import for "My cars": saves each host's most recently used car
// (the car on their newest trip) as their default saved car. Skips anyone who
// already has a saved car, so it is safe to run again.
//
// Usage: npm run import-saved-cars
require('dotenv').config({ quiet: true });
const prisma = require('../config/db');

async function importSavedVehicles({ ownerIds } = {}) {
  const hosts = await prisma.user.findMany({
    where: {
      ...(ownerIds ? { id: { in: ownerIds } } : {}),
      hostedTrips: { some: {} },
      savedVehicles: { none: {} },
    },
    select: { id: true },
  });

  let imported = 0;
  for (const { id } of hosts) {
    const latest = await prisma.trip.findFirst({
      where: { hostId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { vehicle: true },
    });
    const car = latest?.vehicle;
    if (!car) continue;
    await prisma.savedVehicle.create({
      data: {
        ownerId: id,
        make: car.make,
        model: car.model,
        color: car.color,
        plate: car.plate,
        fuelEfficiencyKmL: car.fuelEfficiencyKmL,
        isDefault: true,
      },
    });
    imported += 1;
  }
  return { imported };
}

if (require.main === module) {
  importSavedVehicles()
    .then(({ imported }) => console.warn(`Imported a saved car for ${imported} host(s).`))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { importSavedVehicles };
