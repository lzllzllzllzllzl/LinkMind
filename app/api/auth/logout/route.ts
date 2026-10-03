import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth";
import { hasDbConfig } from "@/lib/db";
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/utils/auth";

export async function POST() {
  if (hasDbConfig()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      try {
        await destroySession(token);
      } catch (error) {
        console.error("销毁会话失败:", error);
      }
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
