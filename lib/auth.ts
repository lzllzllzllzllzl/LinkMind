import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";

import { getDb } from "@/lib/db";
import type { AuthUser } from "@/types/auth";

const SCRYPT_KEY_LENGTH = 64;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, salt, hashHex] = storedHash.split(":");

  if (scheme !== "scrypt" || !salt || !hashHex) {
    return false;
  }

  const derived = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(hashHex, "hex");

  if (expected.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

export async function registerUser(email: string, password: string): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const rows = await getDb()`
    insert into users (email, password_hash)
    values (${normalizedEmail}, ${passwordHash})
    on conflict (email) do nothing
    returning id, email
  `;

  if (rows.length === 0) {
    throw new AuthError("该邮箱已注册，请直接登录", 409);
  }

  return rows[0] as AuthUser;
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase();

  const rows = await getDb()`
    select id, email, password_hash
    from users
    where email = ${normalizedEmail}
    limit 1
  `;

  const row = rows[0] as { id: string; email: string; password_hash: string } | undefined;

  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw new AuthError("邮箱或密码不正确", 401);
  }

  return { id: row.id, email: row.email };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await getDb()`
    insert into sessions (token, user_id, expires_at)
    values (${token}, ${userId}, ${expiresAt.toISOString()}::timestamptz)
  `;

  return { token, expiresAt };
}

export async function getSessionUser(token: string): Promise<AuthUser | null> {
  const rows = await getDb()`
    select u.id, u.email
    from sessions s
    join users u on u.id = s.user_id
    where s.token = ${token} and s.expires_at > now()
    limit 1
  `;

  return (rows[0] as AuthUser | undefined) ?? null;
}

export async function destroySession(token: string): Promise<void> {
  await getDb()`delete from sessions where token = ${token}`;
}
