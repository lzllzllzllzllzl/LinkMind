import { NextResponse } from "next/server";

import { saveBookmark } from "@/lib/bookmark-store";
import type { SaveBookmarkInput } from "@/types/bookmark";
import { getCurrentUser } from "@/utils/auth";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

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

    const result = await saveBookmark({
      user_id: user.id,
      title: body.title,
      url: body.url,
      content: body.content,
      summary: body.summary,
      outline: body.outline,
      tags: body.tags,
    });

    // 响应不回传正文（首页只用到 id 和 duplicated 标记），减少传输体积
    const { record, duplicated } = result;
    return NextResponse.json({
      id: record.id,
      user_id: record.user_id,
      title: record.title,
      url: record.url,
      summary: record.summary,
      outline: record.outline,
      tags: record.tags,
      created_at: record.created_at,
      duplicated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
