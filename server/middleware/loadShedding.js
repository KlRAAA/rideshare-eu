// When more requests are in progress than the API can finish quickly, answer
// new ones "busy, try again" at once instead of queueing them. Without this,
// the load test collapsed at 600 users: the backlog grew faster than it
// drained, nearly every request timed out and memory reached 2.6 GB.
//
// The limit is requests in progress at the same moment. At the API's capacity
// (about 170 requests/s on one core) and a 0.4 s answer, that's about 70
// (requests/s x seconds each), so 80 leaves room for bursts.
const DEFAULT_LIMIT = Number(process.env.MAX_IN_FLIGHT || 80);

function createShedder(limit = DEFAULT_LIMIT) {
  let inFlight = 0;
  return function shedWhenBusy(req, res, next) {
    // Railway's deploy check and the uptime monitor must always get through.
    if (req.path === '/api/health') return next();
    if (inFlight >= limit) {
      res.set('Retry-After', '5');
      return res.status(503).json({ error: 'SERVER_BUSY', message: 'The app is busy right now. Try again in a moment.' });
    }
    inFlight += 1;
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      inFlight -= 1;
    };
    res.on('finish', release);
    res.on('close', release);
    next();
  };
}

module.exports = { createShedder, shedWhenBusy: createShedder() };
