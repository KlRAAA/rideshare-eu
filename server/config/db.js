const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// Local dev runs against a real PostgreSQL 17 service (see .env). The old
// `npx prisma dev` PGlite database couldn't handle concurrent connections and
// needed a `max: 1` pool cap to stay alive — that workaround was removed when we
// switched off it (Sep 2026). A real Postgres uses the default pg pool.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
