import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL, ensure the database is provisioned');
}

export default defineConfig({
  out: './drizzle/migrations',
  // shared/schema.ts re-exports from ~37 specialized schemas + 3 server schemas.
  // Only list schema.ts plus the files it does NOT re-export to avoid duplicate enums/tables.
  schema: [
    './shared/schema.ts',
    // The following are NOT re-exported from schema.ts:
    './shared/accessibility-schema.ts',
    './shared/api-key-schema.ts',
    './shared/auth-schema.ts',
    './shared/csv-import-schema.ts',
    './shared/customer-success-schema.ts',
    './shared/gdpr-core-schema.ts',
    './shared/gps-tracking-schema.ts',
    './shared/lead-scoring-schema.ts',
    './shared/quote-proposal-schema.ts',
    './shared/reporting-schema.ts',
    './shared/soc2-compliance-schema.ts',
    './shared/sso-schema.ts',
    './shared/task-schema.ts',
    './shared/team-alerts-schema.ts',
  ],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
