import { NextResponse } from "next/server";

import { answerQuestionAboutContent } from "@/lib/ai";
import { getBookmarkById } from "@/lib/bookmark-store";
import { getCurrentUser } from "@/utils/auth";

type ChatRequestBody = {
  bookmarkId?: string;
  question?: string;
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

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const record = await getBookmarkById(bookmarkId, user.id);

    if (!record) {
      return NextResponse.json({ error: "未找到对应收藏内容" }, { status: 404 });
    }

    const answer = await answerQuestionAboutContent({
      title: record.title,
      summary: record.summary,
      outline: record.outline,
      tags: record.tags,
      content: record.content,
      question,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提问失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
