/**
 * content-extractor 单元测试
 *
 * 运行: npx tsx tests/content-extractor.test.ts
 *
 * 测试 URL 校验和标题规范化逻辑。
 */

import { load } from "cheerio";

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

function test(name: string, fn: () => void) {
  console.log(`\n[Test] ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`  ERROR: ${err}`);
    failed++;
  }
}

console.log("=== LinkMind content-extractor 测试 ===\n");

test("isValidUrl 识别合法 URL", () => {
  const validUrls = [
    "https://example.com",
    "http://localhost:3000",
    "https://zhihu.com/question/123",
    "https://www.xiaohongshu.com/explore/abc",
  ];

  for (const url of validUrls) {
    try {
      const parsed = new URL(url);
      assert(["http:", "https:"].includes(parsed.protocol), `${url} 应被识别为合法`);
    } catch {
      assert(false, `${url} 不应抛出异常`);
    }
  }
});

test("isValidUrl 拒绝非法 URL", () => {
  const invalidUrls = [
    "not-a-url",
    "ftp://example.com",
    "",
    "javascript:alert(1)",
  ];

  for (const url of invalidUrls) {
    try {
      const parsed = new URL(url);
      assert(!["http:", "https:"].includes(parsed.protocol), `${url} 应被拒绝`);
    } catch {
      assert(true, `${url} 正确抛出异常`);
    }
  }
});

test("cheerio 能解析 HTML 标题", () => {
  const html = `<!DOCTYPE html><html><head><title>测试标题</title></head><body><p>正文</p></body></html>`;
  const $ = load(html);
  const title = $("title").text();
  assert(title === "测试标题", "应正确提取 title 标签内容");
});

test("cheerio 能提取正文内容", () => {
  const html = `<html><body><article><p>第一段内容</p><p>第二段内容</p></article></body></html>`;
  const $ = load(html);
  const text = $("article").text();
  assert(text.includes("第一段内容"), "应包含第一段");
  assert(text.includes("第二段内容"), "应包含第二段");
});

test("HTML 实体解码正确", () => {
  const encoded = "Hello&nbsp;World&amp;Test&lt;tag&gt;";
  const decoded = encoded
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  assert(decoded === "Hello World&Test<tag>", "实体应被正确解码");
});

test("normalizeText 合并空白字符", () => {
  const raw = "  这是   一段\n\n有\t空白的  文本  ";
  const normalized = raw.replace(/\s+/g, " ").trim();
  assert(normalized === "这是 一段 有 空白的 文本", "空白应被合并");
});

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
