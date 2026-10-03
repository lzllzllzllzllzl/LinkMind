/**
 * Neon 数据库冒烟测试：注册 → 会话 → 收藏读写 → 用户隔离 → 级联清理
 *
 * 用法: DATABASE_URL=postgres://... npx tsx scripts/db-smoke.ts
 */

import { authenticateUser, createSession, getSessionUser, registerUser } from "../lib/auth";
import { getDb, hasDbConfig } from "../lib/db";
import { getAllBookmarks, getBookmarkById, saveBookmark } from "../lib/bookmark-store";
import type { SaveBookmarkInput } from "../types/bookmark";

let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS: ${message}`);
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

async function main() {
  console.log("=== LinkMind Neon 冒烟测试 ===\n");

  if (!hasDbConfig()) {
    console.error("缺少 DATABASE_URL 环境变量");
    process.exit(1);
  }

  const email = `smoke-${Date.now()}@linkmind-test.local`;
  const password = "smoke-test-123456";

  // 1. 注册
  const user = await registerUser(email, password);
  assert(Boolean(user.id), `注册用户成功: ${user.email}`);

  // 2. 重复注册被拒绝
  let duplicateRejected = false;
  try {
    await registerUser(email, password);
  } catch {
    duplicateRejected = true;
  }
  assert(duplicateRejected, "重复注册应被拒绝");

  // 3. 登录 + 会话
  const authUser = await authenticateUser(email, password);
  assert(authUser.id === user.id, "登录成功且用户一致");

  const { token } = await createSession(user.id);
  const sessionUser = await getSessionUser(token);
  assert(sessionUser?.id === user.id, "会话可换取用户");
  assert(sessionUser?.email === email, "会话用户邮箱一致");

  // 4. 保存收藏（验证 jsonb 读写）
  const input: SaveBookmarkInput = {
    user_id: user.id,
    title: "冒烟测试文章",
    url: `https://example.com/smoke-${Date.now()}`,
    content: "这是冒烟测试的正文。",
    summary: "冒烟测试摘要",
    outline: ["要点一", "要点二"],
    tags: ["冒烟测试"],
  };
  const saved = await saveBookmark(input);
  assert(!saved.duplicated && Boolean(saved.record.id), "首次保存成功");
  assert(JSON.stringify(saved.record.tags) === JSON.stringify(input.tags), "tags 读写一致");
  assert(JSON.stringify(saved.record.outline) === JSON.stringify(input.outline), "outline 读写一致");

  // 5. 重复保存 → 返回已有记录
  const savedAgain = await saveBookmark(input);
  assert(savedAgain.duplicated && savedAgain.record.id === saved.record.id, "重复保存返回已有记录");

  // 6. 用户隔离
  const list = await getAllBookmarks(user.id);
  assert(list.some((item) => item.id === saved.record.id), "列表包含新收藏");

  const found = await getBookmarkById(saved.record.id, user.id);
  assert(found?.id === saved.record.id, "按 id 查询成功");

  const otherEmail = `smoke-other-${Date.now()}@linkmind-test.local`;
  const otherUser = await registerUser(otherEmail, password);
  const forbidden = await getBookmarkById(saved.record.id, otherUser.id);
  assert(forbidden === null, "其他用户无法读取该收藏");

  // 7. 清理测试数据（级联删除收藏与会话）
  await getDb()`delete from users where id in (${user.id}, ${otherUser.id})`;
  const afterDelete = await getAllBookmarks(user.id);
  assert(!afterDelete.some((item) => item.id === saved.record.id), "级联删除生效");

  console.log(`\n=== 冒烟测试结果: ${failed === 0 ? "全部通过" : `${failed} 项失败`} ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("冒烟测试失败:", error);
  process.exit(1);
});
