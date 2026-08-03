import { applyD1Migrations, env } from 'cloudflare:test';

// Applies `workers/migrations/*.sql` into each test's isolated D1 before any test runs. Idempotent
// — D1 records applied migrations in its own bookkeeping table, exactly as `wrangler d1 migrations
// apply` does against a real database, so the schema under test is the schema that ships.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
