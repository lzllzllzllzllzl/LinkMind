#!/usr/bin/env python3
"""
LinkMind API 健康检查脚本

用法:
  python3 scripts/health-check.py
  python3 scripts/health-check.py --url https://your-app.vercel.app

环境变量:
  HEALTH_CHECK_URL — 要检查的 base URL（默认 http://localhost:3000）

退出码:
  0 — 所有检查通过
  1 — 至少一项检查失败
"""

import os
import sys
import urllib.request
import urllib.error
import json
import time

BASE_URL = os.environ.get("HEALTH_CHECK_URL", "http://localhost:3000").rstrip("/")

CHECKS = [
    {
        "name": "首页可访问",
        "path": "/",
        "method": "GET",
        "expected_status": 200,
    },
    {
        "name": "历史页可访问",
        "path": "/history",
        "method": "GET",
        "expected_status": 200,
    },
    {
        "name": "认证页可访问",
        "path": "/auth",
        "method": "GET",
        "expected_status": 200,
    },
    {
        "name": "bookmarks API 正常",
        "path": "/api/bookmarks",
        "method": "GET",
        "expected_status": 200,
    },
    {
        "name": "process API 参数校验",
        "path": "/api/process",
        "method": "POST",
        "body": json.dumps({}).encode(),
        "headers": {"Content-Type": "application/json"},
        "expected_status": 400,
    },
    {
        "name": "save API 参数校验",
        "path": "/api/save",
        "method": "POST",
        "body": json.dumps({}).encode(),
        "headers": {"Content-Type": "application/json"},
        "expected_status": 400,
    },
    {
        "name": "chat API 未登录返回 401",
        "path": "/api/chat",
        "method": "POST",
        "body": json.dumps({"bookmarkId": "test", "question": "test"}).encode(),
        "headers": {"Content-Type": "application/json"},
        "expected_status": 401,
    },
]


def run_check(check: dict) -> bool:
    url = f"{BASE_URL}{check['path']}"
    method = check.get("method", "GET")
    body = check.get("body")
    headers = check.get("headers", {})
    expected = check["expected_status"]

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            elapsed = (time.time() - start) * 1000
    except urllib.error.HTTPError as e:
        status = e.code
        elapsed = (time.time() - start) * 1000
    except Exception as e:
        print(f"  FAIL: {check['name']} -- 连接失败: {e}")
        return False

    if status == expected:
        print(f"  PASS: {check['name']} -- {status} ({elapsed:.0f}ms)")
        return True
    else:
        print(f"  FAIL: {check['name']} -- 期望 {expected}, 实际 {status} ({elapsed:.0f}ms)")
        return False


def main():
    print(f"=== LinkMind 健康检查 ===")
    print(f"目标: {BASE_URL}\n")

    passed = 0
    failed = 0

    for check in CHECKS:
        if run_check(check):
            passed += 1
        else:
            failed += 1

    print(f"\n=== 结果: {passed} 通过, {failed} 失败 ===")
    sys.exit(1 if failed > 0 else 0)


if __name__ == "__main__":
    main()
