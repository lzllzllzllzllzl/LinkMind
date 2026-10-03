import { NextResponse } from "next/server";

import { AuthError, authenticateUser, createSession } from "@/lib/auth";
import { hasDbConfig } from "@/lib/db";
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/utils/auth";

type SignInRequestBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignInRequestBody;
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
    }

    if (!hasDbConfig()) {
      return NextResponse.json({ error: "数据库未配置，无法登录" }, { status: 503 });
    }

    const user = await authenticateUser(email, password);
    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      ...getSessionCookieOptions(),
      expires: expiresAt,
    });
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
