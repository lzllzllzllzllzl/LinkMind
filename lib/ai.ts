import type { ProcessResult } from "@/types/bookmark";

type AIConfig = {
  apiKey?: string;
  baseURL: string;
  model: string;
};

function getAIConfig(): AIConfig {
  const arkApiKey = process.env.ARK_API_KEY?.trim();
  if (arkApiKey) {
    return {
      apiKey: arkApiKey,
      baseURL: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
      model: process.env.ARK_MODEL || "doubao-1-5-lite-32k-250115",
    };
  }

  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

async function chatCompletion(
  config: AIConfig,
  messages: { role: "system" | "user"; content: string }[],
  options?: { temperature?: number; responseFormat?: { type: "json_object" } }
) {
  if (!config.apiKey) {
    throw new Error("未配置 API Key");
  }

  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options?.temperature ?? 0.2,
      ...(options?.responseFormat && { response_format: options.responseFormat }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 调用失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function buildPrompt(title: string, content: string) {
  return `你是一个知识结构化助手。请先总结文章，再给出结构图节点。
必须只输出 JSON，不要输出任何额外文字或 Markdown 代码块。
字段必须严格为：
{
  "summary": "中文摘要，120-220字，先给结论再给依据",
  "outline": ["结构图节点1：解释", "结构图节点2：解释", "结构图节点3：解释", "结构图节点4：解释"],
  "tags": ["关键词1", "关键词2", "关键词3"]
}

要求：
1) summary 必须可直接给用户阅读；
2) outline 用于页面展示"结构图"，建议 4-8 条；
3) 每条 outline 尽量是"节点名：简要说明"格式；
4) tags 返回 3-6 个中文关键词。

文章标题：
${title}

文章正文：
${content}`;
}

function parseStructured(raw: string) {
  const sanitized = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(sanitized) as {
      summary?: string;
      outline?: string[];
      tags?: string[];
    };
  } catch {
    const jsonBlock = sanitized.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonBlock) {
      return {};
    }

    try {
      return JSON.parse(jsonBlock) as {
        summary?: string;
        outline?: string[];
        tags?: string[];
      };
    } catch {
      return {};
    }
  }
}

function normalizeStringArray(value: unknown, max = 8) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
}

export async function generateStructuredContent(
  title: string,
  url: string,
  content: string
): Promise<ProcessResult> {
  const config = getAIConfig();

  if (!config.apiKey) {
    throw new Error("未检测到可用模型配置，请在环境变量中设置 ARK_API_KEY 或 OPENAI_API_KEY。");
  }

  const clippedContent = content.slice(0, 12000);
  const prompt = buildPrompt(title, clippedContent);

  try {
    let raw = "";

    try {
      raw = await chatCompletion(
        config,
        [
          { role: "system", content: "你是人工智能助手，擅长结构化总结文章。" },
          { role: "user", content: prompt },
        ],
        { responseFormat: { type: "json_object" } }
      );
    } catch (e) {
      console.error("[AI] JSON模式调用失败，尝试普通模式：", e);
    }

    if (!raw) {
      raw = await chatCompletion(
        config,
        [
          { role: "system", content: "你是人工智能助手，必须返回可解析JSON。" },
          {
            role: "user",
            content: `${prompt}

再次强调：只输出 JSON 对象本身。`,
          },
        ]
      );
    }

    if (!raw) {
      throw new Error("模型未返回内容");
    }

    const parsed = parseStructured(raw);
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const outline = normalizeStringArray(parsed.outline, 8);
    const tags = normalizeStringArray(parsed.tags, 6);

    if (!summary || outline.length === 0) {
      throw new Error("模型返回缺少 summary 或 outline");
    }

    return {
      title,
      url,
      content,
      summary,
      outline,
      tags,
    };
  } catch (e) {
    console.error("[AI] 结构化生成失败：", e);
    throw new Error(e instanceof Error ? e.message : "AI 结构化失败");
  }
}

export async function answerQuestionAboutContent(args: {
  title: string;
  summary?: string;
  outline?: string[];
  tags?: string[];
  content: string;
  question: string;
}): Promise<string> {
  const config = getAIConfig();

  if (!config.apiKey) {
    return "当前未配置大模型密钥，无法直接回答。请先配置 ARK_API_KEY 或 OPENAI_API_KEY。";
  }

  const { title, summary, outline, tags, content, question } = args;
  const safeOutline = normalizeStringArray(outline, 10);
  const safeTags = normalizeStringArray(tags, 10);

  try {
    const raw = await chatCompletion(
      config,
      [
        {
          role: "system",
          content:
            "你是一个知识助手。请严格基于给定文章摘要、结构图节点与正文回答，并优先引用结构图节点来组织答案。",
        },
        {
          role: "user",
          content: `文章标题：${title}
文章摘要：${summary || "暂无"}
知识结构图节点：
${safeOutline.length ? safeOutline.map((item, idx) => `${idx + 1}. ${item}`).join("\n") : "暂无"}
关键词标签：${safeTags.length ? safeTags.join("、") : "暂无"}
文章正文：${content.slice(0, 12000)}

用户问题：${question}

请用中文回答，先给结论，再分点说明。`,
        },
      ],
      { temperature: 0.3 }
    );

    return raw || "未获取到模型回答。";
  } catch (e) {
    console.error("[AI] 追问调用失败：", e);
    return "模型调用失败，请稍后重试。";
  }
}
