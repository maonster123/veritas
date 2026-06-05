"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── AI Content Generation (no citations, logic-focused) ──

export async function generateAIContent(nodeId: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { deepseekApiKey: true },
    });
    if (!currentUser?.deepseekApiKey) {
      return { success: false, error: "MISSING_KEY" };
    }

    const node = await prisma.outlineNode.findUnique({
      where: { id: nodeId },
      include: {
        project: { select: { userId: true, title: true, subtitle: true, lang: true } },
        parent: { select: { title: true } },
      },
    });
    if (!node) return { success: false, error: "节点不存在" };
    if (node.project.userId !== session.user.id) return { success: false, error: "无权操作" };

    const isEnglish = node.project.lang === "en";
    const thesisTitle = node.project.title + (node.project.subtitle ? ` — ${node.project.subtitle}` : "");
    const chapter = node.parent?.title ?? "";
    const typeLabelEn = node.type === "chapter" ? "Chapter" : node.type === "section" ? "Section" : node.type === "subsection" ? "Subsection" : "Paragraph";
    const typeLabelZh = node.type === "chapter" ? "章" : node.type === "section" ? "节" : "小节";

    const systemPrompt = isEnglish
      ? `You are a senior academic writing advisor. Thesis: "${thesisTitle}".

CORE MISSION: Write logically coherent, evidence-based academic prose WITHOUT citing any references. Focus on reasoning, argumentation, and conceptual clarity — not on literature review.

RULES:
1. NO CITATIONS: Do not cite any papers, authors, studies, or references. Do not use markers like [1], (Author, 2020), or "According to...". Write as if you are presenting your own analysis.
2. LOGICAL STRUCTURE: Each paragraph should make a clear point, supported by reasoning rather than external citations. Use deductive logic, analogies, theoretical frameworks, and conceptual arguments.
3. SCIENTIFIC ACCURACY: Every factual claim must be precise and verifiable. Use exact terminology. "Mean age was 45.2 years (SD = 12.7)" NOT "average age was around 45".
4. LANGUAGE QUALITY: Native-level academic English. No garbled sentences, no invented words. Proofread before output.
5. TERMINOLOGY: Use established disciplinary terms. Define acronyms on first use.
6. NO FILLER: Cut "it is worth noting", "interestingly", "in other words". One clear sentence > three hedging ones.
7. VARY SENTENCE STRUCTURE: Alternate short and long sentences.

After each paragraph, provide an ACCURATE Chinese translation marked "【中文】" on its own line. CRITICAL: translate ALL technical terms fully — "average" → "平均", "mean" → "均值", "standard deviation" → "标准差", never abbreviate.`
      : `你是学术论文写作导师。论文题目：「${thesisTitle}」。

核心任务：撰写逻辑清晰、有理有据的学术内容，不引用任何文献。聚焦推理、论证和概念分析。

规则：
1. 不引用任何文献：不提及任何论文、作者、研究。不写 [1]、(张三, 2020)、"根据..."等引用标记。像呈现自己的分析一样写作。
2. 逻辑结构：每段有明确论点，用推理支撑而非外部引用。运用演绎逻辑、类比、理论框架和概念论证。
3. 科学准确：事实性陈述精确可验证。使用确切术语。
4. 语言质量：专业学术中文，表述流畅，不啰嗦。
5. 术语规范：使用学科标准术语，首次出现时定义缩写。
6. 不废话：直接进入主题，一句话说清楚。
7. 句式多样：长短句交替。`;

    const userPrompt = isEnglish
      ? `Write approximately 200-400 words of rigorous academic content for "${node.title}" (section: ${chapter}, type: ${typeLabelEn}). Focus on logical argumentation and conceptual analysis — do NOT cite any references. After each paragraph, add a Chinese translation on the next line starting with "【中文】".`
      : `请为「${node.title}」（所属：${chapter}，类型：${typeLabelZh}）撰写约200-400字的学术内容，注重逻辑论证和概念分析，不要引用任何文献。`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return { success: false, error: `API 错误 ${res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { success: false, error: "AI 返回为空" };

    await prisma.outlineNode.update({
      where: { id: nodeId },
      data: { aiContent: content },
    });

    return { success: true, content };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "请求超时" };
    }
    return { success: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

// ── Resource / Website Recommendation ──

interface ResourceItem {
  name: string;
  url: string;
  description: string;
  needsVpn: boolean;
  citation: string;
}

export async function recommendResources(
  nodeId: string
): Promise<{ success: boolean; resources?: ResourceItem[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { deepseekApiKey: true },
    });
    if (!currentUser?.deepseekApiKey) {
      return { success: false, error: "MISSING_KEY" };
    }

    const node = await prisma.outlineNode.findUnique({
      where: { id: nodeId },
      include: {
        project: {
          select: {
            userId: true, title: true, subtitle: true, lang: true,
            citationStyles: {
              where: { isActive: true },
              include: { citationStyle: { select: { name: true } } },
            },
          },
        },
        parent: { select: { title: true } },
      },
    });
    if (!node) return { success: false, error: "节点不存在" };
    if (node.project.userId !== session.user.id) return { success: false, error: "无权操作" };

    const isEnglish = node.project.lang === "en";
    const thesisTitle = node.project.title + (node.project.subtitle ? ` — ${node.project.subtitle}` : "");
    const chapter = node.parent?.title ?? "";

    // Determine citation format
    const activeStyle = node.project.citationStyles[0]?.citationStyle;
    const citationFormat = activeStyle?.name ?? (isEnglish ? "APA 7th" : "GB/T 7714");

    const citationRule = isEnglish
      ? `IMPORTANT: For each resource, also generate a properly formatted citation in ${citationFormat} format. Include the citation as a "citation" field. For websites: use "Author/Organization. (Year). Title. Site Name. URL" or the ${citationFormat}-specific equivalent. If year is unknown, use "n.d.".`
      : `重要：为每个资源生成符合 ${citationFormat} 格式的规范引用，放在 "citation" 字段中。`;

    const systemPrompt = isEnglish
      ? `You are an academic research assistant. Recommend 3-5 real academic websites/resources relevant to the user's research topic.

RULES:
1. Only recommend well-known, real websites (Google Scholar, PubMed, arXiv, CNKI, Web of Science, Scopus, official journal sites, university repositories, government data portals).
2. NEVER fabricate URLs.
3. For each resource provide: name, full URL, 1-sentence description, VPN requirement, and a formatted citation.
4. VPN: blocked in mainland China → needsVpn: true. CNKI/Wanfang/PubMed/arXiv → needsVpn: false.
5. ${citationRule}

Return ONLY a JSON array:
[{"name":"...","url":"https://...","description":"...","needsVpn":true/false,"citation":"..."}]`
      : `你是学术研究助手。推荐 3-5 个真实学术网站/资源。

规则：
1. 只推荐知名真实网站（Google Scholar、PubMed、arXiv、知网、万方、Web of Science、Scopus等）。
2. 绝不编造网址。
3. 每个资源提供：名称、网址、一句话描述、VPN需求、规范引用。
4. VPN：国内被墙 → needsVpn: true。知网/万方/PubMed/arXiv → needsVpn: false。
5. ${citationRule}

只返回 JSON 数组：
[{"name":"...","url":"https://...","description":"...","needsVpn":true/false,"citation":"..."}]`;

    const userPrompt = isEnglish
      ? `Thesis: "${thesisTitle}". Section: "${node.title}" (under ${chapter}). Content: ${node.content ? node.content.slice(0, 800) : "(none)"}. Recommend 3-5 academic websites with ${citationFormat} citations. Return only JSON array.`
      : `论文：「${thesisTitle}」。章节：「${node.title}」（${chapter}）。内容：${node.content ? node.content.slice(0, 800) : "（无）"}。推荐 3-5 个学术网站，附带 ${citationFormat} 格式引用。只返回 JSON 数组。`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return { success: false, error: `API 错误 ${res.status}` };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) return { success: false, error: "AI 返回为空" };

    // Parse JSON — DeepSeek may wrap it in an object or return a bare array
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { success: false, error: "AI 返回格式异常，请重试" };
    }

    // Handle both { "resources": [...] } and [...] formats
    const resources: ResourceItem[] = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>).resources && Array.isArray((parsed as Record<string, unknown>).resources)
        ? (parsed as Record<string, unknown>).resources as ResourceItem[]
        : [];

    if (resources.length === 0) {
      return { success: false, error: "未找到相关资源推荐" };
    }

    return { success: true, resources };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "请求超时" };
    }
    return { success: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

export async function saveDeepseekKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "请先登录" };

    await prisma.user.update({
      where: { id: session.user.id },
      data: { deepseekApiKey: apiKey },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "保存失败" };
  }
}
