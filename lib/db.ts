import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export type DbClient = NeonQueryFunction<false, false>;

let cachedClient: DbClient | null = null;

export function hasDbConfig(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): DbClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("缺少 DATABASE_URL 环境变量");
  }

  if (!cachedClient) {
    cachedClient = neon(databaseUrl);
  }

  return cachedClient;
}
