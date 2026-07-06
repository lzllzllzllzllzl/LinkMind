/**
 * bookmark-store 单元测试
 *
 * 运行: npx tsx tests/bookmark-store.test.ts
 *
 * 测试 bookmark-store 的核心逻辑：
 * - 内存模式下的保存和查询
 * - 数据格式校验
 */

import { saveBookmark, getAllBookmarks, getBookmarkById } from "../lib/bookmark-store";
import type { SaveBookmarkInput } from "../types/bookmark";

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
      title: "测试文章",
      url: "https://example.com/test",
      content: "这是一篇测试文章的正文内容。",
      summary: "测试摘要",
      outline: ["节点1", "节点2"],
      tags: ["测试", "示例"],
    };

    const saved = await saveBookmark(input);
    assert(saved.id !== undefined, "返回记录应包含 id");
    assert(saved.title === input.title, "title 应匹配");
    assert(saved.url === input.url, "url 应匹配");
    assert(saved.content === input.content, "content 应匹配");
    assert(saved.summary === input.summary, "summary 应匹配");
    assert(JSON.stringify(saved.outline) === JSON.stringify(input.outline), "outline 应匹配");
    assert(JSON.stringify(saved.tags) === JSON.stringify(input.tags), "tags 应匹配");
    assert(saved.created_at !== undefined, "应包含 created_at");
  });

  await test("getAllBookmarks 返回所有收藏", async () => {
    const list = await getAllBookmarks();
    assert(Array.isArray(list), "应返回数组");
    assert(list.length >= 1, "应至少有一条记录");
  });

  await test("getBookmarkById 能查到已保存的记录", async () => {
    const list = await getAllBookmarks();
    const first = list[0];
    const found = await getBookmarkById(first.id);
    assert(found !== null, "应找到记录");
    assert(found?.id === first.id, "id 应匹配");
  });

  await test("getBookmarkById 查不到不存在的记录", async () => {
    const found = await getBookmarkById("non-existent-id-12345");
    assert(found === null, "不存在的 id 应返回 null");
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
    assert(saved.user_id === null, "未提供 user_id 时应为 null");
  });

  await test("带 user_id 保存时正确保留", async () => {
    const input: SaveBookmarkInput = {
      user_id: "test-user-uuid",
      title: "用户收藏",
      url: "https://example.com/user",
      content: "用户内容",
      summary: "用户摘要",
      outline: ["节点"],
      tags: ["标签"],
    };
    const saved = await saveBookmark(input);
    assert(saved.user_id === "test-user-uuid", "user_id 应匹配");
  });

  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
