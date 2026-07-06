import { randomUUID } from "crypto";

import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";
import type { BookmarkRecord, SaveBookmarkInput } from "@/types/bookmark";

const memoryBookmarks: BookmarkRecord[] = [];

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

export async function saveBookmark(input: SaveBookmarkInput): Promise<BookmarkRecord> {
  if (!hasSupabaseConfig()) {
    const record = normalizeBookmark(input);
    memoryBookmarks.unshift(record);
    return record;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bookmarks")
    .insert({
      user_id: input.user_id ?? null,
      title: input.title,
      url: input.url,
      content: input.content,
      summary: input.summary ?? "",
      outline: input.outline ?? [],
      tags: input.tags ?? [],
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "保存失败");
  }

  return data as BookmarkRecord;
}

export async function getAllBookmarks(): Promise<BookmarkRecord[]> {
  if (!hasSupabaseConfig()) {
    return [...memoryBookmarks];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BookmarkRecord[];
}

export async function getBookmarkById(id: string): Promise<BookmarkRecord | null> {
  if (!hasSupabaseConfig()) {
    return memoryBookmarks.find((item) => item.id === id) ?? null;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as BookmarkRecord;
}