import { NextResponse } from "next/server";

import { getAllBookmarks, getBookmarkById } from "@/lib/bookmark-store";
import { getCurrentUser } from "@/utils/auth";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const data = await getBookmarkById(id, user.id);
      if (!data) {
        return NextResponse.json({ error: "未找到记录" }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    const list = await getAllBookmarks(user.id);
    return NextResponse.json(list);
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
