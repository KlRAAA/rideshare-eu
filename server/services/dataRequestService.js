const { decryptField, decryptTripFields } = require('./encryptionService');

const EMERGENCY_PAPERWORK_MS = 72 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RIDING = ['APPROVED', 'COMPLETED'];
const TRIP_INCLUDE = {
  host: { select: { fullName: true } },
  vehicle: { select: { make: true, model: true, color: true, plate: true } },
  matches: { select: { passengerId: true, status: true, passenger: { select: { fullName: true } } } },
};

// An emergency release goes out before the paperwork; the written request is
// due within 72 hours (data request policy §4).
function paperworkDueAt(basis, now = new Date()) {
  return basis === 'EMERGENCY' ? new Date(now.getTime() + EMERGENCY_PAPERWORK_MS) : null;
}

function isOverdue(request, now = new Date()) {
  return Boolean(request.paperworkDueAt && !request.paperworkReceivedAt && new Date(request.paperworkDueAt) < now);
}

const nameOf = (user) => (user ? decryptField(user.fullName) : null);

// Trips the person hosted or asked to join, whatever became of the request.
function involving(subjectId) {
  return { OR: [{ hostId: subjectId }, { matches: { some: { passengerId: subjectId } } }] };
}

// Trips in the date range. A recurring trip that started earlier but was still
// running counts too; its row shows the repeat pattern.
function tripsInRange(db, subjectId, from, to) {
  return db.trip.findMany({
    where: {
      AND: [
        involving(subjectId),
        { departureTime: { lte: to } },
        { OR: [{ departureTime: { gte: from } }, { recurrenceType: { not: 'ONE_TIME' }, status: { not: 'CANCELLED' } }] },
      ],
    },
    include: TRIP_INCLUDE,
    orderBy: { departureTime: 'asc' },
  });
}

// The minimum for a risk to life (data request policy §4): the most recent
// one-time trip at or before now, one-time trips in the next 24 hours, and the
// person's active recurring trips (their regular commute).
async function emergencyTrips(db, subjectId, now) {
  const [latest, upcoming, recurring] = await Promise.all([
    db.trip.findFirst({
      where: { AND: [involving(subjectId), { recurrenceType: 'ONE_TIME', departureTime: { lte: now } }] },
      include: TRIP_INCLUDE,
      orderBy: { departureTime: 'desc' },
    }),
    db.trip.findMany({
      where: {
        AND: [involving(subjectId), { recurrenceType: 'ONE_TIME', departureTime: { gt: now, lte: new Date(now.getTime() + DAY_MS) } }],
      },
      include: TRIP_INCLUDE,
    }),
    db.trip.findMany({
      where: { AND: [involving(subjectId), { recurrenceType: { not: 'ONE_TIME' }, status: { in: ['OPEN', 'FULL'] } }] },
      include: TRIP_INCLUDE,
    }),
  ]);
  return [latest, ...upcoming, ...recurring].filter(Boolean).sort((a, b) => a.departureTime - b.departureTime);
}

async function chatFor(db, tripId) {
  const rows = await db.message.findMany({
    where: { tripId },
    orderBy: { createdAt: 'asc' },
    select: { body: true, createdAt: true, sender: { select: { fullName: true } } },
  });
  return rows.map((m) => ({ sender: nameOf(m.sender), body: m.body, sentAt: m.createdAt }));
}

async function toReleaseTrip(db, tripRaw, subjectId, withChats) {
  const trip = decryptTripFields(tripRaw);
  const own = trip.matches.find((m) => m.passengerId === subjectId);
  return {
    departureTime: trip.departureTime,
    recurrenceType: trip.recurrenceType,
    customDays: trip.customDays,
    origin: trip.originAddress,
    destination: trip.destinationAddress,
    meetingPoint: trip.meetingPointAddress ?? null,
    status: trip.status,
    subjectRole: trip.hostId === subjectId ? 'DRIVER' : 'PASSENGER',
    subjectRequestStatus: own ? own.status : null,
    driver: nameOf(trip.host),
    coRiders: trip.matches.filter((m) => m.passengerId !== subjectId && RIDING.includes(m.status)).map((m) => nameOf(m.passenger)),
    car: trip.vehicle,
    messages: withChats ? await chatFor(db, trip.id) : null,
  };
}

async function supportFor(db, subjectId) {
  const tickets = await db.supportTicket.findMany({
    where: { userId: subjectId },
    orderBy: { createdAt: 'asc' },
    include: { messages: { orderBy: { createdAt: 'asc' }, select: { fromAdmin: true, body: true, createdAt: true } } },
  });
  return tickets.map((t) => ({
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.createdAt,
    messages: t.messages.map((m) => ({ from: m.fromAdmin ? 'Admin' : 'User', body: m.body, sentAt: m.createdAt })),
  }));
}

// Built when opened, never stored (superadmin spec D10). Holds only what the
// request covers: no emails, passwords, codes, security logs, ratings, or
// co-riders' other trips (spec §5).
async function buildRelease(db, request, now = new Date()) {
  const emergency = request.legalBasis === 'EMERGENCY';
  const withChats = request.includeChats && !emergency;
  const withSupport = request.includeSupport && !emergency;
  const [subject, rows] = await Promise.all([
    db.user.findUnique({
      where: { id: request.subjectUserId },
      select: { fullName: true, universityId: true, role: true, deletedAt: true },
    }),
    emergency
      ? emergencyTrips(db, request.subjectUserId, now)
      : tripsInRange(db, request.subjectUserId, request.fromDate, request.toDate),
  ]);
  const trips = [];
  for (const row of rows) trips.push(await toReleaseTrip(db, row, request.subjectUserId, withChats));

  return {
    generatedAt: now,
    request: {
      id: request.id,
      agency: request.agency,
      officerName: request.officerName,
      referenceNumber: request.referenceNumber,
      legalBasis: request.legalBasis,
      fromDate: request.fromDate,
      toDate: request.toDate,
      includeChats: withChats,
      includeSupport: withSupport,
    },
    subject: {
      name: nameOf(subject),
      universityId: subject?.universityId ?? null,
      role: subject?.role ?? null,
      deleted: Boolean(subject?.deletedAt),
    },
    trips,
    supportRequests: withSupport ? await supportFor(db, request.subjectUserId) : null,
  };
}

module.exports = { paperworkDueAt, isOverdue, buildRelease };
