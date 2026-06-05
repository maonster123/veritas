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
      ? `You are an academic writing assistant. Thesis: "${thesisTitle}". Write in professional academic English. After each paragraph, provide a Chinese translation below it, separated by a blank line and marked with "【中文】". Do NOT use markers like "first", "second", "finally". Vary sentence length. Be concise and substantive.`
      : `你是学术论文写作助手。论文题目：「${thesisTitle}」。用中文撰写专业学术内容。`;

    const userPrompt = isEnglish
      ? `Write approximately 200-400 words of academic content for "${node.title}" (under ${chapter}, type: ${typeLabelEn}). After each paragraph, add a Chinese translation on the next line marked "【中文】".`
      : `请为「${node.title}」（所属：${chapter}，类型：${typeLabelZh}）撰写约200-400字的学术内容。`;

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
