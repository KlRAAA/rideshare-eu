// Fields safe to return to clients. Never spread a raw Prisma User record
// into a response — it carries passwordHash. Any query that includes a User
// relation in a response payload should use this as its `select`.
//
// `email` and `universityId` are deliberately absent: other students see a
// name and photo, never a school email or student number (trip chat covers
// pickup coordination). They come back only on your own profile and to admins,
// which ask for them explicitly. The Privacy Policy (/privacy) promises this,
// and crossUserAccess.test.js checks it.
//
// `gender` is deliberately absent: it's returned only on your own profile and
// to admins (Women+ spec §6), so trips and search never reveal anyone's gender.
module.exports = {
  id: true,
  fullName: true,
  role: true,
  trustScore: true,
  tripCount: true,
  verified: true,
  avatarUrl: true,
  hasSeenOnboarding: true,
};
