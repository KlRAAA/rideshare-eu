const { SCHEMAS, NEVER_SET } = require('../validation/bodySchemas');
const { logSecurityEvent } = require('../services/securityLog');

function matchesType(value, spec) {
  return spec.split('|').some((type) => {
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return typeof value === 'object' && !Array.isArray(value);
    if (type === 'numeric') {
      return (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
    }
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    return typeof value === type;
  });
}

// Returns null when the body fits the schema, else { error, field }.
// `path` names nested fields, e.g. "vehicle.plate".
function checkBody(body, schema, path = '') {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'INVALID_BODY', field: path || null };
  }
  for (const [key, value] of Object.entries(body)) {
    const field = path ? `${path}.${key}` : key;
    if (NEVER_SET.has(key)) return { error: 'FORBIDDEN_FIELD', field };
    if (!(key in schema)) return { error: 'UNKNOWN_FIELD', field };
    if (value === null || value === undefined) continue;
    const spec = schema[key];
    const problem = typeof spec === 'string'
      ? (matchesType(value, spec) ? null : { error: 'INVALID_FIELD_TYPE', field })
      : checkBody(value, spec, field);
    if (problem) return problem;
  }
  return null;
}

// Route middleware: strictBody('trip.create'). An absent body counts as {}.
function strictBody(name) {
  const schema = SCHEMAS[name];
  if (!schema) throw new Error(`No body schema named ${name}`);
  const middleware = (req, res, next) => {
    const problem = checkBody(req.body ?? {}, schema);
    if (!problem) return next();
    if (problem.error === 'FORBIDDEN_FIELD') {
      logSecurityEvent(req, 'ACCESS_DENIED', { userId: req.user?.id, reason: `FORBIDDEN_FIELD ${problem.field}` });
    }
    return res.status(400).json(problem);
  };
  middleware.bodySchema = name;
  return middleware;
}

module.exports = { strictBody, checkBody };
