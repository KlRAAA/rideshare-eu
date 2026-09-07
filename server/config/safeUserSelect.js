// Fields safe to return to clients. Never spread a raw Prisma User record
// into a response — it carries passwordHash. Any query that includes a User
// relation in a response payload should use this as its `select`.
//
// `email` is deliberately included, not an oversight: this is a verified
// institutional address (the platform's whole trust model rests on that),
// and matched riders realistically need it to coordinate a pickup — there's
// no in-app messaging in scope. It's still gated by `safeUserSelect` so a
// non-matched user browsing search results never sees it embedded in a
// response that doesn't need it (callers choose per-query whether to use
// this select at all).
module.exports = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  gender: true,
  universityId: true,
  trustScore: true,
  tripCount: true,
  verified: true,
  avatarUrl: true,
};
