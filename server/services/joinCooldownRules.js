// Pure rules against join-then-cancel loops (pre-defense fixes, item 9).
// A cancellation here is a rider withdrawing their own request or seat; the
// driver's CANCELLATION notification about it records when it happened.
const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;

const REJOIN_COOLDOWN_MS = 2 * HOUR_MS; // same trip, after cancelling it
const BURST_WINDOW_MS = 24 * HOUR_MS;
const BURST_MIN = 3; // cancellations inside the window...
const BURST_PAUSE_MS = HOUR_MS; // ...pause new requests this long after the latest

const latest = (times) => times.reduce((a, b) => (b > a ? b : a), new Date(0));

// cancels: [{ tripId, at: Date }]. Returns null, or the refusal to send.
function joinCooldown(cancels, tripId, now = new Date()) {
  const sameTrip = cancels.filter((c) => c.tripId === tripId).map((c) => c.at);
  if (sameTrip.length > 0) {
    const retryAt = new Date(latest(sameTrip).getTime() + REJOIN_COOLDOWN_MS);
    if (now < retryAt) return { status: 409, body: { error: 'REJOIN_COOLDOWN', retryAt: retryAt.toISOString() } };
  }
  const recent = cancels.filter((c) => now - c.at < BURST_WINDOW_MS).map((c) => c.at);
  if (recent.length >= BURST_MIN) {
    const retryAt = new Date(latest(recent).getTime() + BURST_PAUSE_MS);
    if (now < retryAt) return { status: 429, body: { error: 'JOIN_COOLDOWN', retryAt: retryAt.toISOString() } };
  }
  return null;
}

// True when some BURST_WINDOW_MS stretch holds at least BURST_MIN of the times
// (for the admins' watch list).
function hasBurst(times) {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted.some((t, i) => i + BURST_MIN - 1 < sorted.length && sorted[i + BURST_MIN - 1] - t < BURST_WINDOW_MS);
}

module.exports = { joinCooldown, hasBurst, REJOIN_COOLDOWN_MS, BURST_WINDOW_MS, BURST_MIN, BURST_PAUSE_MS };
