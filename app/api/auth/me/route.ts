import { NextResponse } from "next/server";

import { getCurrentUser } from "@/utils/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取登录状态失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
