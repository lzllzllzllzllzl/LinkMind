/**
 * 将 db/schema.sql 应用到 Neon 数据库
 *
 * 用法: DATABASE_URL=postgres://... npx tsx scripts/apply-schema.ts
 */

import { readFile } from "fs/promises";
import path from "path";

import { neon } from "@neondatabase/serverless";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("缺少 DATABASE_URL 环境变量");
    process.exit(1);
  }

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const schemaSql = await readFile(schemaPath, "utf8");
  const statements = schemaSql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  const sql = neon(databaseUrl);

  for (const statement of statements) {
    await sql.query(statement);
    const preview = statement.replace(/\s+/g, " ").slice(0, 60);
    console.log(`  已执行: ${preview}...`);
  }

  console.log(`\nSchema 应用完成（共 ${statements.length} 条语句）`);
}

main().catch((error) => {
  console.error("Schema 应用失败:", error);
  process.exit(1);
});
