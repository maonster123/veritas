# Phase 1 对话式论文写作面板 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为论文大纲系统新增右侧对话式 AI 写作面板，用户可针对任意大纲节点与 AI 对话协作，对话历史持久化到 SQLite。

**Architecture:** 新增 ChatMessage 数据模型 + 两个 server action + useChat hook + ChatPanel 组件，集成到 OutlineApp 形成三栏布局。现有 ContentEditor、OutlineTree、AI 推荐功能完全不动。

**Tech Stack:** Next.js 16 server actions, Prisma + SQLite, DeepSeek Chat API, Tailwind CSS 4

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `prisma/schema.prisma` | 修改 | 新增 ChatMessage 模型 |
| `src/app/actions/chat.ts` | 新建 | sendMessage + getChatHistory server actions |
| `src/hooks/useChat.ts` | 新建 | 对话状态管理（messages, isLoading, send, loadHistory） |
| `src/components/chat/ChatPanel.tsx` | 新建 | 对话面板 UI 组件 |
| `src/components/OutlineApp.tsx` | 修改 | 集成 ChatPanel，三栏布局 |

---

### Task 1: 添加 ChatMessage 数据模型

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 Prisma schema 末尾添加 ChatMessage 模型**

在 `prisma/schema.prisma` 文件末尾（CitationStyle 模型之后）追加：

```prisma
// ──────────────────────────────────────────────
// 12. ChatMessage
// ──────────────────────────────────────────────

model ChatMessage {
  id        String      @id @default(cuid())
  nodeId    String
  node      OutlineNode @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  role      String
  content   String
  createdAt DateTime    @default(now())

  @@index([nodeId, createdAt])
}
```

- [ ] **Step 2: 运行 Prisma 迁移**

```bash
cd d:/thesis-outline && npx prisma db push
```

Expected: 输出 `Your database is now in sync with your schema.`

- [ ] **Step 3: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: add ChatMessage model for per-node chat history"
```

---

### Task 2: 创建 chat server actions

**Files:**
- Create: `src/app/actions/chat.ts`

- [ ] **Step 1: 创建 `src/app/actions/chat.ts`**

```typescript
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
      ...history.map((m) => ({ role: m.role, content: m.content })),
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
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd d:/thesis-outline && npx tsc --noEmit src/app/actions/chat.ts
```

Expected: No errors.

- [ ] **Step 3: 提交**

```bash
git add src/app/actions/chat.ts
git commit -m "feat: add sendMessage and getChatHistory server actions"
```

---

### Task 3: 创建 useChat hook

**Files:**
- Create: `src/hooks/useChat.ts`

- [ ] **Step 1: 创建 `src/hooks/useChat.ts`**

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import { sendMessage, getChatHistory } from "@/app/actions/chat";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

export function useChat(initialNodeId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const currentNodeIdRef = useRef<string | null>(initialNodeId);

  const loadHistory = useCallback(async (nodeId: string) => {
    currentNodeIdRef.current = nodeId;
    setError("");
    const result = await getChatHistory(nodeId);
    if (result.success && result.messages) {
      setMessages(result.messages);
    } else {
      setMessages([]);
    }
  }, []);

  const send = useCallback(async (nodeId: string, content: string) => {
    if (!content.trim() || isLoading) return;

    currentNodeIdRef.current = nodeId;
    setError("");

    // Optimistic user message
    const optimisticId = `temp-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: optimisticId,
      role: "user",
      content: content.trim(),
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const result = await sendMessage(nodeId, content.trim());

    // Discard if node changed during request
    if (currentNodeIdRef.current !== nodeId) return;

    if (result.success && result.reply) {
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        return [
          ...withoutOptimistic,
          { id: `usr-${Date.now()}`, role: "user", content: content.trim(), createdAt: new Date() },
          { id: `ai-${Date.now()}`, role: "assistant", content: result.reply!, createdAt: new Date() },
        ];
      });
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      if (result.error === "MISSING_KEY") {
        setError("请先在 AI 推荐面板设置 DeepSeek API Key");
      } else {
        setError(result.error ?? "发送失败");
      }
    }
    setIsLoading(false);
  }, [isLoading]);

  return { messages, isLoading, error, send, loadHistory, setError };
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd d:/thesis-outline && npx tsc --noEmit src/hooks/useChat.ts
```

Expected: No errors.

- [ ] **Step 3: 提交**

```bash
git add src/hooks/useChat.ts
git commit -m "feat: add useChat hook for chat state management"
```

---

### Task 4: 创建 ChatPanel 组件

**Files:**
- Create: `src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: 创建 `src/components/chat/ChatPanel.tsx`**

```typescript
"use client";

import { useEffect, useRef } from "react";
import type { FlatNode } from "@/lib/outline-utils";
import { useChat } from "@/hooks/useChat";

interface Props {
  node: FlatNode | null;
}

export default function ChatPanel({ node }: Props) {
  const { messages, isLoading, error, send, loadHistory, setError } = useChat(node?.id ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load history when node changes
  useEffect(() => {
    if (node?.id) {
      loadHistory(node.id);
    }
  }, [node?.id, loadHistory]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const content = inputRef.current?.value ?? "";
    if (!content.trim() || isLoading || !node?.id) return;
    send(node.id, content);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Empty state
  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        选择一个大纲节点开始对话
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-l border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
          {node.title}
        </h2>
        <p className="text-[10px] text-zinc-400 mt-0.5">AI 写作助手</p>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-zinc-400 text-sm mt-8">
            向 AI 提问以开始协作写作
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-3">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 shrink-0">
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950 rounded px-3 py-2 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送)"
            disabled={isLoading}
            className="flex-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 placeholder:text-zinc-400"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="text-xs px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd d:/thesis-outline && npx tsc --noEmit src/components/chat/ChatPanel.tsx
```

Expected: No errors.

- [ ] **Step 3: 提交**

```bash
git add src/components/chat/ChatPanel.tsx
git commit -m "feat: add ChatPanel component with message list and input"
```

---

### Task 5: 集成 ChatPanel 到 OutlineApp 三栏布局

**Files:**
- Modify: `src/components/OutlineApp.tsx`

- [ ] **Step 1: 修改 `src/components/OutlineApp.tsx`**

需要改动两处：
1. 在 import 区域加 `import ChatPanel from "@/components/chat/ChatPanel";`（第 6 行之后）
2. 将右侧面板改为中间编辑区 + 右侧对话面板，宽度限制为 400px

```diff
 import ContentEditor from "@/components/outline/ContentEditor";
+import ChatPanel from "@/components/chat/ChatPanel";
 import ProjectTitleBar from "@/components/outline/ProjectTitleBar";
```

将第 111-114 行：
```tsx
      {/* Right: Content editor */}
      <div className="flex-1 overflow-y-auto">
        <ContentEditor node={selectedNode} onUpdate={handleUpdate} hasApiKey={hasApiKey} />
      </div>
```

替换为：
```tsx
      {/* Middle: Content editor */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <ContentEditor node={selectedNode} onUpdate={handleUpdate} hasApiKey={hasApiKey} />
      </div>

      {/* Right: Chat panel */}
      <div className="w-[400px] shrink-0 overflow-hidden">
        <ChatPanel node={selectedNode} />
      </div>
```

注意根容器 `className="flex flex-1 h-screen"` 保持不变。

- [ ] **Step 2: 验证整体 TypeScript 编译**

```bash
cd d:/thesis-outline && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: 提交**

```bash
git add src/components/OutlineApp.tsx
git commit -m "feat: integrate ChatPanel into three-column layout"
```

---

### Task 6: 端到端验证

- [ ] **Step 1: 本地构建验证**

```bash
cd d:/thesis-outline && npm run build
```

Expected: Build succeeds, no errors.

- [ ] **Step 2: 启动开发服务器**

```bash
cd d:/thesis-outline && npm run dev
```

Expected: `ready - started server on http://localhost:3000`

- [ ] **Step 3: 手动冒烟测试清单**

在浏览器中打开 `http://localhost:3000`，登录后验证：

| 检查项 | 预期行为 |
|---|---|
| 未选中节点 | 中间编辑器显示"选择一个大纲节点开始写作"，右侧聊天面板显示"选择一个大纲节点开始对话" |
| 点击大纲节点 | 中间显示该节点内容编辑器（正文/备注/AI推荐 tab），右侧显示该节点对话面板 |
| 发送消息 | 输入消息按 Enter 发送，用户消息立即显示，AI 回复在加载动画后显示 |
| 空消息 | 输入为空时按 Enter 不发送 |
| 切换节点 | 右侧对话面板切换到新节点的历史（如有），区分不同节点的对话 |
| 切换回之前节点 | 对话历史保持不变 |
| API key 缺失 | 显示提示"请先在 AI 推荐面板设置 DeepSeek API Key" |

- [ ] **Step 4: 提交（如有修复）**

如有问题，修复后提交：
```bash
git add -A
git commit -m "fix: end-to-end verification fixes"
```

---

## 完成标准

- [ ] `npm run build` 零错误通过
- [ ] 现有功能（大纲树、内容编辑、AI 推荐、导出）不受影响
- [ ] 对话面板可用：发送消息 → AI 回复 → 切换节点 → 对话恢复
- [ ] 6 个 git commit，每个对应一个 task
