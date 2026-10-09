// Request-body schemas, one per write route. A body may contain only the
// fields listed for its route (strictBody rejects anything else), and each
// field must have the listed type. Every field is optional and may be null at
// this layer: whether a field is required, and its range or format, is still
// checked by the controller or its validator (tripValidation, vehicleValidation,
// supportService, dataRequestValidation …). This layer's job is narrower: no
// field the route doesn't expect ever reaches a controller.
//
// Types: 'string' | 'number' | 'boolean' | 'array' | 'object', joined with '|'
// for alternatives. 'numeric' is a number or a numeric string (form inputs).
// A nested plain object is itself a strict schema.

// Never accepted on any route. Who the caller is comes from the session token;
// ownership, seat counts, prices and roles are decided by the server.
const NEVER_SET = new Set([
  'id', 'userId', 'hostId', 'passengerId', 'raterId', 'reporterId', 'ownerId',
  'issuedById', 'actorId', 'createdAt', 'updatedAt',
  'isAdmin', 'isSuperAdmin', 'bannedUntil', 'banSeverity', 'deletedAt', 'trustScore',
  'filledSeats', 'fuelSharePerSeat', 'fuelShareAmount', 'isDefault',
]);

const LAT_LNG = { lat: 'number', lng: 'number' };

const VEHICLE = {
  make: 'string',
  model: 'string',
  color: 'string',
  plate: 'string',
  fuelEfficiencyKmL: 'numeric',
  fuelType: 'string',
};

const TRIP_ROUTE = {
  originAddress: 'string',
  originLat: 'number',
  originLng: 'number',
  destinationAddress: 'string',
  destinationLat: 'number',
  destinationLng: 'number',
  routeWaypoints: 'array',
  distanceMeters: 'number',
  durationSeconds: 'number',
};

const TRIP_SETTINGS = {
  departureTime: 'string',
  recurrenceType: 'string',
  customDays: 'array',
  totalSeats: 'numeric',
  driverNotes: 'string',
  genderPreference: 'string',
  flexibleDeparture: 'boolean',
  flexWindowMinutes: 'number',
  familiarRidersOnly: 'boolean',
  meetingPointAddress: 'string',
  meetingPointLat: 'number',
  meetingPointLng: 'number',
};

const SEARCH = {
  origin: LAT_LNG,
  destination: LAT_LNG,
  departureMinutes: 'number',
  date: 'string',
  flexWindowMinutes: 'number',
  genderPreference: 'string',
};

const NONE = {};
const EMAIL = { email: 'string' };
const OTP = { email: 'string', otp: 'string|number' };
const MESSAGE = { body: 'string' };

const SCHEMAS = {
  // Sign-up, sign-in, password reset
  'auth.registerStart': EMAIL,
  'auth.registerVerifyOtp': OTP,
  'auth.registerComplete': {
    verificationTicket: 'string',
    password: 'string',
    fullName: 'string',
    universityId: 'string',
    gender: 'string',
    termsAccepted: 'boolean',
  },
  'auth.forgotPassword': EMAIL,
  'auth.verifyResetOtp': OTP,
  'auth.resetPassword': { resetTicket: 'string', password: 'string' },
  'auth.login': { email: 'string', password: 'string' },

  // Trips
  'trip.create': { vehicleId: 'string', fuelPricePerLiter: 'numeric', ...TRIP_ROUTE, ...TRIP_SETTINGS },
  'trip.update': { ...TRIP_ROUTE, ...TRIP_SETTINGS, confirmStructural: 'boolean', vehicle: VEHICLE },
  'trip.cancel': { reason: 'string' },
  'trip.complete': NONE,
  'trip.start': NONE,
  'trip.end': NONE,
  'trip.arrived': NONE,
  'trip.dayConfirm': NONE,
  'trip.daySkip': { reason: 'string' },
  'trip.dayUnskip': NONE,
  'trip.location': { ...LAT_LNG, etaSeconds: 'number' },
  'trip.message': MESSAGE,

  // Cars
  'vehicle.create': VEHICLE,
  'savedVehicle.create': VEHICLE,
  'savedVehicle.update': VEHICLE,
  'savedVehicle.setDefault': NONE,
  'savedVehicle.remove': NONE,

  // Matching, joining, rating
  'match.search': SEARCH,
  'match.showAll': SEARCH,
  'match.routeOverlap': { tripId: 'string', origin: LAT_LNG, destination: LAT_LNG },
  'match.create': {
    tripId: 'string',
    score: 'number',
    routeOverlap: 'number',
    scheduleAlignment: 'number',
    preferenceMatch: 'boolean',
    message: 'string',
  },
  'match.respond': { status: 'string' },
  'match.rate': { rateeId: 'string', score: 'number', comment: 'string', anonymous: 'boolean', occurrenceDate: 'string' },

  // Account and settings
  'alert.markRead': NONE,
  'preference.update': {
    genderPreference: 'string',
    flexWindowMinutes: 'number',
    familiarRidersOnly: 'boolean',
  },
  'user.avatar': NONE,
  'admin.licenseApprove': NONE,
  'admin.licenseReject': { reason: 'string', note: 'string' },
  'user.license': { licenseNumber: 'string', licenseType: 'string', expiresOn: 'string' },
  'user.mode': { mode: 'string' }, // the image itself is the multipart file, not a body field
  'user.onboarding': NONE,
  'user.gender': { gender: 'string', confirm: 'boolean' },
  'user.delete': { password: 'string' },
  'warning.acknowledge': NONE,

  // Reports and support
  'report.create': { reportedUserId: 'string', matchId: 'string', category: 'string', description: 'string' },
  'support.create': { category: 'string', subject: 'string', body: 'string', relatedTripId: 'string' },
  'support.reply': MESSAGE,
  'support.close': NONE,

  // Admin console
  'admin.fuelPrice': { fuelType: 'string', pricePerLiter: 'numeric' },
  'admin.warn': { reason: 'string', note: 'string', ticketId: 'string', reportId: 'string' },
  'admin.ban': { duration: 'string', reason: 'string', note: 'string' },
  'admin.unban': { note: 'string' },
  'admin.promote': NONE,
  'admin.demote': NONE,
  'admin.reviewReport': {
    status: 'string',
    note: 'string',
    ban: { duration: 'string', reason: 'string' },
    warn: { reason: 'string', note: 'string' },
  },
  'admin.cancelTrip': { reason: 'string' },
  'admin.supportReply': MESSAGE,
  'admin.supportClose': NONE,
  'admin.dataRequestCreate': {
    subjectUserId: 'string',
    agency: 'string',
    officerName: 'string',
    officerContact: 'string',
    referenceNumber: 'string',
    legalBasis: 'string',
    fromDate: 'string',
    toDate: 'string',
    includeChats: 'boolean',
    includeSupport: 'boolean',
    verificationNote: 'string',
    password: 'string',
  },
  'admin.dataRequestPaperwork': NONE,
  'admin.announcementPost': { title: 'string', body: 'string', endsAt: 'string' },
  'admin.announcementEnd': NONE,
};

module.exports = { SCHEMAS, NEVER_SET };
