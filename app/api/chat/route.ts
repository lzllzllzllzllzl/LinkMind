import { NextResponse } from "next/server";

import { answerQuestionAboutContent } from "@/lib/ai";
import { createClient } from "@/utils/supabase/server";

type ChatRequestBody = {
  bookmarkId?: string;
  question?: string;
};

type BookmarkRow = {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  summary: string;
  outline: string[];
  tags: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const bookmarkId = body.bookmarkId?.trim();
    const question = body.question?.trim();

    if (!bookmarkId || !question) {
      return NextResponse.json(
        { error: "bookmarkId 和 question 都不能为空" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("bookmarks")
      .select("id,user_id,title,content,summary,outline,tags")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "未找到对应收藏内容" }, { status: 404 });
    }

    const row = data as BookmarkRow;
    const answer = await answerQuestionAboutContent({
      title: row.title,
      summary: row.summary,
      outline: row.outline,
      tags: row.tags,
      content: row.content,
      question,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提问失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}