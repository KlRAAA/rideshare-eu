const { startRun, endRun } = require('../services/tripRunService');

const reply = (res, { status, body }) => res.status(status).json(body);

async function start(req, res) {
  return reply(res, await startRun(req.params.id, req.user.id));
}
async function end(req, res) {
  return reply(res, await endRun(req.params.id, req.user.id, 'DRIVER'));
}
// Called by the driver's phone near campus. Only an ongoing run can end this
// way, so it can never complete a trip that hasn't started.
async function arrived(req, res) {
  return reply(res, await endRun(req.params.id, req.user.id, 'ARRIVED'));
}

module.exports = { start, end, arrived };
