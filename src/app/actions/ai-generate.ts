"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      ? `You are a senior academic writing advisor for a peer-reviewed journal. Thesis: "${thesisTitle}".

RULES (violations will be rejected):
1. SCIENTIFIC ACCURACY: Every factual claim must be precise and verifiable. Use exact terminology — never approximate, never simplify. "Mean age was 45.2 years (SD = 12.7)" NOT "average age was around 45". Report exact values, effect sizes, confidence intervals where applicable.
2. NO HALLUCINATION: If you cite a study, the citation must be real and traceable. If you are uncertain, write "[citation needed]" — never fabricate.
3. LANGUAGE QUALITY: Native-level academic English. No garbled sentences, no mixed grammar, no invented words. Every sentence must parse correctly. Proofread before output.
4. TERMINOLOGY: Use established disciplinary terms correctly. Never invent abbreviations. Define acronyms on first use: "Confirmatory Factor Analysis (CFA)".
5. NO MARKERS: Do not use "first", "second", "third", "finally", "in conclusion" as transition words. Use logical flow.
6. Vary sentence length. Avoid 3+ long complex sentences in a row.
7. Be concise: no filler, no hedging chain ("it could perhaps be suggested that"), no throat-clearing.

After each paragraph, provide an ACCURATE Chinese translation marked "【中文】" on its own line. CRITICAL for translations: fully translate ALL technical terms — "average" → "平均", "mean" → "均值", "standard deviation" → "标准差", never abbreviate to single letters or English shorthand.`
      : `你是学术论文写作助手。论文题目：「${thesisTitle}」。用中文撰写专业学术内容。`;

    const userPrompt = isEnglish
      ? `Write approximately 200-400 words of rigorous academic content for "${node.title}" (section: ${chapter}, type: ${typeLabelEn}). Requirements: use precise terminology, provide exact figures where relevant, maintain formal academic register. After each paragraph, provide an accurate full Chinese translation on the next line starting with "【中文】".`
      : `请为「${node.title}」（所属：${chapter}，类型：${typeLabelZh}）撰写约200-400字的学术内容，要求专业严谨。`;

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
