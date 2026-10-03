/**
 * bookmark-store 单元测试
 *
 * 运行: npx tsx tests/bookmark-store.test.ts
 *
 * 测试 bookmark-store 的核心逻辑（无 DATABASE_URL 时走内存回退）：
 * - 保存和查询
 * - 按 user_id 隔离
 * - 同一用户 URL 去重
 * - 数据格式校验
 */

import { saveBookmark, getAllBookmarks, getBookmarkById } from "../lib/bookmark-store";
import type { SaveBookmarkInput } from "../types/bookmark";

const TEST_USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

async function test(name: string, fn: () => Promise<void>) {
  console.log(`\n[Test] ${name}`);
  try {
    await fn();
  } catch (err) {
    console.error(`  ERROR: ${err}`);
    failed++;
  }
}

async function run() {
  console.log("=== LinkMind bookmark-store 测试 ===\n");

  await test("保存一条收藏并验证返回结构", async () => {
    const input: SaveBookmarkInput = {
      user_id: TEST_USER_ID,
      title: "测试文章",
      url: "https://example.com/test",
      content: "这是一篇测试文章的正文内容。",
      summary: "测试摘要",
      outline: ["节点1", "节点2"],
      tags: ["测试", "示例"],
    };

    const saved = await saveBookmark(input);
    assert(!saved.duplicated, "首次保存不应标记为重复");
    assert(saved.record.id !== undefined, "返回记录应包含 id");
    assert(saved.record.title === input.title, "title 应匹配");
    assert(saved.record.url === input.url, "url 应匹配");
    assert(saved.record.content === input.content, "content 应匹配");
    assert(saved.record.summary === input.summary, "summary 应匹配");
    assert(
      JSON.stringify(saved.record.outline) === JSON.stringify(input.outline),
      "outline 应匹配"
    );
    assert(JSON.stringify(saved.record.tags) === JSON.stringify(input.tags), "tags 应匹配");
    assert(saved.record.created_at !== undefined, "应包含 created_at");
  });

  await test("getAllBookmarks 只返回当前用户的收藏", async () => {
    const list = await getAllBookmarks(TEST_USER_ID);
    assert(Array.isArray(list), "应返回数组");
    assert(list.length >= 1, "应至少有一条记录");
    assert(
      list.every((item) => item.user_id === TEST_USER_ID),
      "所有记录的 user_id 应为当前用户"
    );
  });

  await test("getBookmarkById 能查到已保存的记录", async () => {
    const list = await getAllBookmarks(TEST_USER_ID);
    const first = list[0];
    const found = await getBookmarkById(first.id, TEST_USER_ID);
    assert(found !== null, "应找到记录");
    assert(found?.id === first.id, "id 应匹配");
  });

  await test("getBookmarkById 查不到不存在的记录", async () => {
    const found = await getBookmarkById("non-existent-id-12345", TEST_USER_ID);
    assert(found === null, "不存在的 id 应返回 null");
  });

  await test("用户数据隔离：其他用户查不到记录", async () => {
    const list = await getAllBookmarks(TEST_USER_ID);
    const first = list[0];
    const found = await getBookmarkById(first.id, OTHER_USER_ID);
    assert(found === null, "其他用户查询应返回 null");
  });

  await test("未登录用户保存时 user_id 为 null", async () => {
    const input: SaveBookmarkInput = {
      title: "匿名收藏",
      url: "https://example.com/anonymous",
      content: "匿名内容",
      summary: "匿名摘要",
      outline: [],
      tags: [],
    };
    const saved = await saveBookmark(input);
    assert(saved.record.user_id === null, "未提供 user_id 时应为 null");
  });

  await test("同一用户重复保存同一 URL 返回已有记录", async () => {
    const input: SaveBookmarkInput = {
      user_id: TEST_USER_ID,
      title: "去重收藏",
      url: "https://example.com/dedupe",
      content: "去重内容",
      summary: "去重摘要",
      outline: [],
      tags: [],
    };

    const first = await saveBookmark(input);
    assert(!first.duplicated, "首次保存不重复");

    const second = await saveBookmark(input);
    assert(second.duplicated, "第二次保存应标记为重复");
    assert(second.record.id === first.record.id, "应返回同一条已有记录");
  });

  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
