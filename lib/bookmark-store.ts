import { randomUUID } from "crypto";

import { getDb, hasDbConfig } from "@/lib/db";
import type { BookmarkRecord, SaveBookmarkInput } from "@/types/bookmark";

const memoryBookmarks: BookmarkRecord[] = [];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SaveBookmarkResult = {
  record: BookmarkRecord;
  duplicated: boolean;
};

type BookmarkRow = {
  id: string;
  user_id: string | null;
  title: string;
  url: string;
  content: string;
  summary: string;
  outline: unknown;
  tags: unknown;
  created_at: string | Date;
};

function mapRow(row: BookmarkRow): BookmarkRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    url: row.url,
    content: row.content,
    summary: row.summary,
    outline: Array.isArray(row.outline) ? (row.outline as string[]) : [],
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function normalizeBookmark(input: SaveBookmarkInput): BookmarkRecord {
  return {
    id: randomUUID(),
    user_id: input.user_id ?? null,
    title: input.title,
    url: input.url,
    content: input.content,
    summary: input.summary ?? "",
    outline: input.outline ?? [],
    tags: input.tags ?? [],
    created_at: new Date().toISOString(),
  };
}

export async function saveBookmark(input: SaveBookmarkInput): Promise<SaveBookmarkResult> {
  if (!hasDbConfig()) {
    const userId = input.user_id ?? null;
    const existed = memoryBookmarks.find(
      (item) => (item.user_id ?? null) === userId && item.url === input.url,
    );

    if (existed) {
      return { record: existed, duplicated: true };
    }

    const record = normalizeBookmark(input);
    memoryBookmarks.unshift(record);
    return { record, duplicated: false };
  }

  const db = getDb();
  const outline = JSON.stringify(input.outline ?? []);
  const tags = JSON.stringify(input.tags ?? []);

  const inserted = await db`
    insert into bookmarks (user_id, title, url, content, summary, outline, tags)
    values (${input.user_id ?? null}, ${input.title}, ${input.url}, ${input.content},
            ${input.summary ?? ""}, ${outline}::jsonb, ${tags}::jsonb)
    on conflict (user_id, url) do nothing
    returning *
  `;

  if (inserted.length > 0) {
    return { record: mapRow(inserted[0] as BookmarkRow), duplicated: false };
  }

  const existed = await db`
    select * from bookmarks
    where user_id is not distinct from ${input.user_id ?? null} and url = ${input.url}
    limit 1
  `;

  if (existed.length === 0) {
    throw new Error("保存失败：链接已存在但未能读取已有记录");
  }

  return { record: mapRow(existed[0] as BookmarkRow), duplicated: true };
}

export async function getAllBookmarks(userId: string): Promise<BookmarkRecord[]> {
  if (!hasDbConfig()) {
    return memoryBookmarks.filter((item) => item.user_id === userId);
  }

  const rows = await getDb()`
    select * from bookmarks
    where user_id = ${userId}
    order by created_at desc
  `;

  return rows.map((row) => mapRow(row as BookmarkRow));
}

export async function getBookmarkById(id: string, userId: string): Promise<BookmarkRecord | null> {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  if (!hasDbConfig()) {
    return memoryBookmarks.find((item) => item.id === id && item.user_id === userId) ?? null;
  }

  const rows = await getDb()`
    select * from bookmarks
    where id = ${id} and user_id = ${userId}
    limit 1
  `;

  return rows.length > 0 ? mapRow(rows[0] as BookmarkRow) : null;
}
