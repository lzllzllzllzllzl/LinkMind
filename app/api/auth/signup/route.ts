import { NextResponse } from "next/server";

import { AuthError, createSession, registerUser } from "@/lib/auth";
import { hasDbConfig } from "@/lib/db";
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/utils/auth";

type SignUpRequestBody = {
  email?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignUpRequestBody;
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }

    if (!hasDbConfig()) {
      return NextResponse.json({ error: "数据库未配置，无法注册" }, { status: 503 });
    }

    const user = await registerUser(email, password);
    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json(
      { user: { id: user.id, email: user.email } },
      { status: 201 },
    );
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      ...getSessionCookieOptions(),
      expires: expiresAt,
    });
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "注册失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
