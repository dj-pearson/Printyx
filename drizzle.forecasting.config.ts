import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Minimal, non-destructive config to add ONLY sales forecasting tables
export default defineConfig({
  out: "./migrations-forecasting",
  schema: ["./server/sales-forecasting-schema.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

