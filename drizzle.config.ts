import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL, ensure the database is provisioned');
}

export default defineConfig({
  out: './drizzle/migrations',
  // Single entry point that exports ALL pgTable/pgEnum definitions exactly once.
  // See shared/drizzle-schema.ts for details on conflict resolution.
  schema: './shared/drizzle-schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
