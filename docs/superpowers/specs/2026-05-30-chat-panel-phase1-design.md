# Phase 1: 对话式论文写作面板 — 设计文档

日期：2026-05-30
状态：已审批

## 背景

论文大纲管理系统已有完整的基础功能（大纲树、内容编辑器、AI推荐、文献管理、导出）。当前 AI 推荐功能是单向的"一键生成"，用户无法与 AI 对话式交互。

产品化方向确定为 **AI 驱动的写作辅助**，核心差异化是 **降低 AI 率和查重率**。Phase 1 新增对话式写作面板，让用户通过对话与 AI 协作，而非让 AI 全自动生成。

## 目标

1. 新增右侧对话面板，绑定到大纲节点
2. 对话历史持久化，切换节点时恢复
3. 通过 system prompt 降低 AI 生成内容的检测率
4. 不破坏任何现有功能

## 技术设计

### UI 布局

三栏可调整布局：

```
┌──────────────┬───────────────────────┬──────────────────────┐
│  大纲树      │   内容编辑器          │   对话面板            │
│  (384px)     │   (flex-1)           │   (400px)            │
│              │                       │                      │
│  ProjectTitle│   [正文|备注|AI推荐]  │  当前节点标题        │
│              │                       │  消息列表...         │
│  ▼ 第一章    │   正文内容...          │  [输入框] [发送]     │
│    ▼ 1.1节  │                       │                      │
│    ○ 1.2节  │                       │                      │
└──────────────┴───────────────────────┴──────────────────────┘
```

- 中间和右侧之间可拖拽调整宽度
- 现有 `ContentEditor` 三个 tab（正文/备注/AI推荐）完全不动

### 数据模型

新增 `ChatMessage` 模型（`prisma/schema.prisma`），不改动现有模型：

```prisma
model ChatMessage {
  id        String      @id @default(cuid())
  nodeId    String
  node      OutlineNode @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  role      String      // "user" | "assistant"
  content   String
  createdAt DateTime    @default(now())

  @@index([nodeId, createdAt])
}
```

### API

新增两个服务器动作（`src/app/actions/chat.ts`）：

**`sendMessage(nodeId, content)`**
- 验证节点所有权
- 组装上下文：对话历史（最近10轮）+ 节点标题/正文 + 父章节 + 项目标题
- 发送到 DeepSeek API（`deepseek-chat`）
- 存储用户消息和 AI 回复
- 返回 AI 回复内容
- 超时：30秒

**`getChatHistory(nodeId)`**
- 验证节点所有权
- 返回 `ChatMessage[]`，按 `createdAt` 升序

### System Prompt 策略

```text
你是一名资深学术写作导师，你的任务是帮助用户在已有论文框架和内容的基础上进行写作，
而不是替用户"写论文"。你的每一条建议都必须基于用户提供的大纲和正文内容。

行为准则：
1. 严禁使用"然而""此外""总而言之""首先...其次...最后"等模板化连接词堆砌
2. 句式多样化：长短句交替，避免连续3句以上相同句式结构
3. 回答直接进入主题，不要铺垫、不要总结、不要"希望这些建议对你有帮助"
4. 中文表述自然口语化但不失学术性，避免翻译腔
5. 引用具体文献时给出完整引用信息，不做无出处的断言
6. 如果用户问你"帮我写这段"，你应该提供草稿并标注哪些部分需要用户自己补充
7. 避免过度使用排比句、"不仅...而且"、"在...的背景下"等高频学术套话
8. 不要用"首先其次最后"——用逻辑递进而非列表式

你的输出将用于论文写作，请确保所有内容均为原创、可追溯、不含抄袭。
```

### 前端组件

**新建文件：**

| 文件 | 用途 |
|---|---|
| `src/components/chat/ChatPanel.tsx` | 对话面板主体组件 |
| `src/hooks/useChat.ts` | 对话状态管理 hook |

**ChatPanel 结构：**
- 顶部：当前节点标题（固定）
- 中部：消息列表，区分 user/assistant 气泡，自动滚动至最新
- 底部：输入框 + 发送按钮（Enter 发送，Shift+Enter 换行）
- 空状态：未选中节点时提示"选择一个大纲节点开始对话"
- 加载态：AI 思考时显示动画，禁用发送按钮
- 错误态：超时/网络错误显示"AI 响应超时，请重试"

**ChatPanel 集成：**
- 在 `OutlineApp.tsx` 中，`ContentEditor` 右侧新增 `<ChatPanel selectedNodeId={...}>`
- 三栏用 flex 布局包裹

**`useChat` hook：**
- 状态：`messages: ChatMessage[]`, `isLoading: boolean`
- 方法：`sendMessage(content)`, `loadHistory(nodeId)`
- 发送时乐观更新用户消息，AI 回复返回后追加
- 节点切换时自动调用 `loadHistory`
- 防竞态：忽略旧节点的响应（不匹配当前 nodeId 时丢弃）

### 边界情况

- 发送空消息：不允许，按钮保持 disabled
- 快速切换节点：上一节点的 pending 响应被丢弃
- 网络超时（30s）：显示超时提示
- DeepSeek API 错误：显示具体错误信息
- 未配置 API key 的用户：显示 key 配置引导

### 技术约束

- 数据库保持 SQLite（Phase 2 迁移 PostgreSQL）
- 不使用 WebSocket/SSE streaming，使用普通 server action 请求-响应
- 不引入新的依赖包
- 不影响现有 `ContentEditor`、`OutlineTree`、`ProjectTitleBar` 的代码路径

## 非目标（Phase 2+）

- 多模型路由
- 向量数据库 RAG
- 实时 collaboration
- 模板 marketplace
