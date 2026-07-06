import { NextResponse } from "next/server";

import { saveBookmark } from "@/lib/bookmark-store";
import type { SaveBookmarkInput } from "@/types/bookmark";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SaveBookmarkInput>;

    if (!body?.url || !body?.title || !body?.content) {
      return NextResponse.json(
        { error: "缺少必要字段：url/title/content" },
        { status: 400 }
      );
    }

    if (
      typeof body.summary !== "string" ||
      !Array.isArray(body.outline) ||
      !body.outline.every((item) => typeof item === "string") ||
      !Array.isArray(body.tags) ||
      !body.tags.every((item) => typeof item === "string")
    ) {
      return NextResponse.json(
        { error: "字段格式错误：summary/outline/tags" },
        { status: 400 }
      );
    }

    const saved = await saveBookmark({
      user_id: body.user_id ?? null,
      title: body.title,
      url: body.url,
      content: body.content,
      summary: body.summary,
      outline: body.outline,
      tags: body.tags,
    });
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}