import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

function createDatabase(url: string) {
  const client = postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return drizzle(client, { schema });
}

let database: Database | null | undefined;

export function getDatabase() {
  if (database !== undefined) return database;
  const databaseUrl =
    process.env.LOGLY_DATABASE_URL ?? process.env.DATABASE_URL;
  database = databaseUrl ? createDatabase(databaseUrl) : null;
  return database;
}

export function getRequiredDatabase() {
  const current = getDatabase();
  if (current) return current;
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return createDatabase("postgres://logly:logly@127.0.0.1:5432/logly");
  }
  throw new Error("DATABASE_URL is required for Logly authentication");
}
