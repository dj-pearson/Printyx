import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { drizzleLogger } from './lib/db-logger';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// SECURITY FIX: Enable SSL/TLS for database connections in production
const poolConfig: any = {
  connectionString: process.env.DATABASE_URL,
};

// Neon automatically uses SSL/TLS, but we ensure it's enforced in production
if (process.env.NODE_ENV === 'production') {
  // Neon requires SSL by default, but we explicitly configure it for clarity
  poolConfig.ssl = true;
}

export const pool = new Pool(poolConfig);

// Enable query logging based on environment configuration
const enableQueryLogging = process.env.DB_LOG_QUERIES !== 'false';

export const db = drizzle({
  client: pool,
  schema,
  logger: enableQueryLogging ? drizzleLogger : undefined,
});