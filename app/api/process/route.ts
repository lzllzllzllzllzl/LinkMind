import { NextResponse } from "next/server";

import { generateStructuredContent } from "@/lib/ai";
import { extractMainContent } from "@/lib/content-extractor";

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();

    if (!url) {
      return NextResponse.json({ error: "url 不能为空" }, { status: 400 });
    }

    if (!isValidUrl(url)) {
      return NextResponse.json({ error: "url 格式不合法" }, { status: 400 });
    }

    const extracted = await extractMainContent(url);
    const result = await generateStructuredContent(extracted.title, url, extracted.content);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "处理失败";
    if (message.includes("提取失败")) {
      return NextResponse.json(
        {
          success: false,
          error: "提取失败，该平台反爬较强，请手动复制正文后粘贴到输入框",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}