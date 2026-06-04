"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `你是一名资深学术写作导师，你的任务是帮助用户在已有论文框架和内容的基础上进行写作，而不是替用户"写论文"。你的每一条建议都必须基于用户提供的大纲和正文内容。

行为准则：
1. 严禁使用"然而""此外""总而言之""首先...其次...最后"等模板化连接词堆砌
2. 句式多样化：长短句交替，避免连续3句以上相同句式结构
3. 回答直接进入主题，不要铺垫、不要总结、不要"希望这些建议对你有帮助"
4. 中文表述自然口语化但不失学术性，避免翻译腔
5. 引用具体文献时给出完整引用信息，不做无出处的断言
6. 如果用户问你"帮我写这段"，你应该提供草稿并标注哪些部分需要用户自己补充
7. 避免过度使用排比句、"不仅...而且"、"在...的背景下"等高频学术套话
8. 不要用"首先其次最后"——用逻辑递进而非列表式

你的输出将用于论文写作，请确保所有内容均为原创、可追溯、不含抄袭。`;

async function verifyNodeOwnership(nodeId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const node = await prisma.outlineNode.findUnique({
    where: { id: nodeId },
    select: { project: { select: { userId: true } } },
  });
  if (!node) return false;
  return node.project.userId === session.user.id;
}

export async function sendMessage(
  nodeId: string,
  content: string
): Promise<{ success: boolean; reply?: string; error?: string }> {
  try {
    if (!(await verifyNodeOwnership(nodeId))) {
      return { success: false, error: "无权操作" };
    }

    const session = await auth();
    const currentUser = await prisma.user.findUnique({
      where: { id: session!.user!.id },
      select: { deepseekApiKey: true },
    });
    if (!currentUser?.deepseekApiKey) {
      return { success: false, error: "MISSING_KEY" };
    }

    // Load node context
    const node = await prisma.outlineNode.findUnique({
      where: { id: nodeId },
      include: {
        project: { select: { title: true, subtitle: true } },
        parent: { select: { title: true } },
      },
    });
    if (!node) return { success: false, error: "节点不存在" };

    // Save user message
    await prisma.chatMessage.create({
      data: { nodeId, role: "user", content },
    });

    // Load recent chat history (last 10 rounds = 20 messages)
    const history = await prisma.chatMessage.findMany({
      where: { nodeId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    // Build messages array for DeepSeek
    const thesisTitle = node.project.title + (node.project.subtitle ? ` — ${node.project.subtitle}` : "");
    const chapterTitle = node.parent?.title ?? "";
    const typeLabel =
      node.type === "chapter" ? "章" : node.type === "section" ? "节" : node.type === "subsection" ? "小节" : "段落";

    const systemMessage = `${SYSTEM_PROMPT}

当前论文信息：
- 论文题目：${thesisTitle}
- 所在章节：${chapterTitle}
- 当前节点：「${node.title}」（类型：${typeLabel}）
- 节点已有正文：${node.content ? node.content.slice(0, 2000) : "（暂无）"}

请基于以上上下文帮助用户进行学术写作。`;

    const messages = [
      { role: "system", content: systemMessage },
      ...history.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    ];

    // Call DeepSeek
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
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return { success: false, error: `API 错误 ${res.status}` };
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return { success: false, error: "AI 返回为空" };

    // Save assistant reply
    await prisma.chatMessage.create({
      data: { nodeId, role: "assistant", content: reply },
    });

    return { success: true, reply };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "AI 响应超时，请重试" };
    }
    return { success: false, error: error instanceof Error ? error.message : "未知错误" };
  }
}

export async function getChatHistory(
  nodeId: string
): Promise<{ success: boolean; messages?: { id: string; role: string; content: string; createdAt: Date }[]; error?: string }> {
  try {
    if (!(await verifyNodeOwnership(nodeId))) {
      return { success: false, error: "无权操作" };
    }

    const messages = await prisma.chatMessage.findMany({
      where: { nodeId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return { success: true, messages };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "加载失败" };
  }
}
