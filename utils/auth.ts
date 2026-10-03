import { cookies } from "next/headers";

import { getSessionUser } from "@/lib/auth";
import type { AuthUser } from "@/types/auth";

export const SESSION_COOKIE_NAME = "lm_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return getSessionUser(token);
}
