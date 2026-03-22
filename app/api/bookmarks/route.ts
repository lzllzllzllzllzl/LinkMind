import { NextResponse } from "next/server";

import { getAllBookmarks, getBookmarkById } from "@/lib/bookmark-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const data = await getBookmarkById(id);
      if (!data) {
        return NextResponse.json({ error: "未找到记录" }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    const list = await getAllBookmarks();
    return NextResponse.json(list);
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}