# Outline Editor UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建大纲树编辑器，支持层级展示、节点增删改、Markdown 写作、拖拽排序。

**Architecture:** 客户端 React 组件 + Server Actions。树结构用递归组件渲染，节点编辑用内联表单，拖拽用 HTML5 drag-and-drop（不引入第三方拖拽库）。状态管理用 `useReducer` 集中管理树状态，增删改通过 Server Actions 持久化。

**Tech Stack:** React 19, Next.js 16 Server Actions, Tailwind CSS 4, Markdown 预览（暂用简单的文本渲染，后续可加编辑器库）

---

## File Structure

```
src/
  app/
    actions/
      lookup-doi.ts       ← 已存在
      outline.ts          ← 创建: OutlineNode CRUD Server Actions
  components/
    outline/
      OutlineTree.tsx     ← 创建: 递归树容器
      OutlineNodeItem.tsx ← 创建: 单个节点（展开/折叠/编辑/拖拽）
      OutlineEditor.tsx   ← 创建: 主编辑器（含顶部工具栏）
      AddNodeForm.tsx     ← 创建: 添加节点内联表单
  hooks/
    useOutlineTree.ts     ← 创建: useReducer 管理树状态
  lib/
    prisma.ts             ← 已存在
    outline-utils.ts      ← 创建: 树扁平化/排序等工具函数
  app/
    page.tsx              ← 修改: 集成大纲编辑器
```

---

### Task 1: Create Outline CRUD Server Actions

**Files:**
- Create: `src/app/actions/outline.ts`

**Step 1: Write server actions**

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { OutlineNodeType } from "@/generated/prisma/enums";

// ── Queries ──

export async function getOutlineTree(projectId: string) {
  const nodes = await prisma.outlineNode.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    include: {
      outlineReferences: {
        include: { reference: { select: { id: true, title: true, year: true } } },
      },
    },
  });
  return nodes.map((n) => ({
    ...n,
    authors: undefined as never,
    outlineReferences: n.outlineReferences.map((or) => ({
      id: or.id,
      citationText: or.citationText,
      reference: or.reference,
    })),
  }));
}

// ── Mutations ──

export async function addNode(
  projectId: string,
  parentId: string | null,
  title: string,
  type: OutlineNodeType,
  sortOrder: number
) {
  const node = await prisma.outlineNode.create({
    data: { projectId, parentId, title, type, sortOrder },
    include: { outlineReferences: { include: { reference: true } } },
  });
  revalidatePath("/");
  return node;
}

export async function updateNode(
  nodeId: string,
  data: { title?: string; content?: string; notes?: string; type?: OutlineNodeType }
) {
  await prisma.outlineNode.update({ where: { id: nodeId }, data });
  revalidatePath("/");
}

export async function deleteNode(nodeId: string) {
  // Cascade: delete children, references, and the node itself
  const children = await prisma.outlineNode.findMany({ where: { parentId: nodeId } });
  for (const child of children) {
    await deleteNode(child.id);
  }
  await prisma.outlineReference.deleteMany({ where: { outlineNodeId: nodeId } });
  await prisma.outlineNode.delete({ where: { id: nodeId } });
  revalidatePath("/");
}

export async function reorderNode(nodeId: string, newParentId: string | null, newSortOrder: number) {
  await prisma.outlineNode.update({
    where: { id: nodeId },
    data: { parentId: newParentId, sortOrder: newSortOrder },
  });
  revalidatePath("/");
}

export async function reorderSiblings(updates: { id: string; sortOrder: number }[]) {
  for (const u of updates) {
    await prisma.outlineNode.update({
      where: { id: u.id },
      data: { sortOrder: u.sortOrder },
    });
  }
  revalidatePath("/");
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 2: Create Outline Utility Functions

**Files:**
- Create: `src/lib/outline-utils.ts`

**Step 1: Write utilities**

```typescript
export interface FlatNode {
  id: string;
  projectId: string;
  parentId: string | null;
  sortOrder: number;
  title: string;
  type: "chapter" | "section" | "subsection" | "paragraph";
  content: string | null;
  notes: string | null;
  children: FlatNode[];
  outlineReferences: {
    id: string;
    citationText: string | null;
    reference: { id: string; title: string; year: number | null };
  }[];
}

export function buildTree(nodes: FlatNode[]): FlatNode[] {
  const map = new Map<string, FlatNode>();
  const roots: FlatNode[] = [];

  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else if (!node.parentId) {
      roots.push(node);
    }
  }

  // Sort children by sortOrder
  const sortFn = (a: FlatNode, b: FlatNode) => a.sortOrder - b.sortOrder;
  roots.sort(sortFn);
  for (const node of map.values()) {
    node.children.sort(sortFn);
  }

  return roots;
}

export function flattenTree(nodes: FlatNode[]): FlatNode[] {
  const result: FlatNode[] = [];
  function walk(list: FlatNode[]) {
    for (const node of list) {
      result.push(node);
      walk(node.children);
    }
  }
  walk(nodes);
  return result;
}

export function getNodePath(
  tree: FlatNode[],
  targetId: string
): number[] | null {
  function find(nodes: FlatNode[], path: number[]): number[] | null {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === targetId) return [...path, i];
      const found = find(nodes[i].children, [...path, i]);
      if (found) return found;
    }
    return null;
  }
  return find(tree, []);
}

export function nodeTypeLabel(type: string): string {
  const map: Record<string, string> = {
    chapter: "章",
    section: "节",
    subsection: "小节",
    paragraph: "段",
  };
  return map[type] ?? type;
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 3: Create useOutlineTree Hook

**Files:**
- Create: `src/hooks/useOutlineTree.ts`

**Step 1: Write the hook**

```typescript
"use client";

import { useReducer, useCallback } from "react";
import type { FlatNode } from "@/lib/outline-utils";
import {
  getOutlineTree,
  addNode,
  updateNode,
  deleteNode,
  reorderNode,
  reorderSiblings,
} from "@/app/actions/outline";
import type { OutlineNodeType } from "@/generated/prisma/enums";

interface State {
  tree: FlatNode[];
  loading: boolean;
  selectedId: string | null;
  editingId: string | null;
}

type Action =
  | { type: "SET_TREE"; tree: FlatNode[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SELECT"; id: string | null }
  | { type: "EDIT"; id: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_TREE":
      return { ...state, tree: action.tree, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SELECT":
      return { ...state, selectedId: action.id, editingId: null };
    case "EDIT":
      return { ...state, editingId: action.id };
    default:
      return state;
  }
}

export function useOutlineTree(projectId: string) {
  const [state, dispatch] = useReducer(reducer, {
    tree: [],
    loading: true,
    selectedId: null,
    editingId: null,
  });

  const loadTree = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true });
    const nodes = await getOutlineTree(projectId);
    const { buildTree } = await import("@/lib/outline-utils");
    dispatch({ type: "SET_TREE", tree: buildTree(nodes as FlatNode[]) });
  }, [projectId]);

  const handleAdd = useCallback(
    async (parentId: string | null, title: string, type: OutlineNodeType) => {
      await addNode(projectId, parentId, title, type, 0);
      await loadTree();
    },
    [projectId, loadTree]
  );

  const handleUpdate = useCallback(
    async (nodeId: string, data: { title?: string; content?: string; notes?: string; type?: OutlineNodeType }) => {
      await updateNode(nodeId, data);
      await loadTree();
    },
    [loadTree]
  );

  const handleDelete = useCallback(
    async (nodeId: string) => {
      await deleteNode(nodeId);
      dispatch({ type: "SELECT", id: null });
      await loadTree();
    },
    [loadTree]
  );

  const handleDrop = useCallback(
    async (dragId: string, targetId: string | null, position: "before" | "after" | "inside") => {
      // Reorder logic: find target's parent and recalculate sortOrders
      const flat = await getOutlineTree(projectId);
      const { buildTree, flattenTree } = await import("@/lib/outline-utils");
      const tree = buildTree(flat as FlatNode[]);

      // Find the target node to determine its parent
      const target = flat.find((n) => n.id === targetId);
      const newParentId = position === "inside" ? targetId : target?.parentId ?? null;

      await reorderNode(dragId, newParentId, 0);
      await loadTree();
    },
    [projectId, loadTree]
  );

  return { state, dispatch, loadTree, handleAdd, handleUpdate, handleDelete, handleDrop };
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 4: Create Outline UI Components

**Files:**
- Create: `src/components/outline/OutlineNodeItem.tsx`
- Create: `src/components/outline/OutlineTree.tsx`
- Create: `src/components/outline/AddNodeForm.tsx`

**Step 1: OutlineNodeItem.tsx**

```tsx
"use client";

import { useState } from "react";
import type { FlatNode } from "@/lib/outline-utils";
import { nodeTypeLabel } from "@/lib/outline-utils";

interface Props {
  node: FlatNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { title?: string; content?: string }) => void;
  onAdd: (parentId: string, title: string, type: "section" | "subsection" | "paragraph") => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string, position: "before" | "after" | "inside") => void;
}

export default function OutlineNodeItem({
  node,
  depth,
  selectedId,
  onSelect,
  onDelete,
  onUpdate,
  onAdd,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [showAdd, setShowAdd] = useState(false);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;

  const handleTitleSave = () => {
    if (title.trim() && title !== node.title) {
      onUpdate(node.id, { title: title.trim() });
    }
    setEditTitle(false);
  };

  const indent = depth * 24;

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragOver={onDragOver}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(e, node.id, "after");
        }}
        onClick={() => onSelect(node.id)}
        className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer group hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
          isSelected
            ? "bg-blue-50 dark:bg-blue-950 ring-1 ring-blue-300 dark:ring-blue-700"
            : ""
        }`}
        style={{ marginLeft: indent }}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-600 shrink-0"
        >
          {hasChildren ? (expanded ? "▾" : "▸") : "◦"}
        </button>

        {/* Type badge */}
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 shrink-0">
          {nodeTypeLabel(node.type)}
        </span>

        {/* Title */}
        {editTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") setEditTitle(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        ) : (
          <span
            className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 truncate"
            onDoubleClick={() => setEditTitle(true)}
          >
            {node.title}
          </span>
        )}

        {/* Actions */}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAdd(!showAdd);
            }}
            className="w-6 h-6 flex items-center justify-center text-xs text-zinc-400 hover:text-green-600 rounded"
            title="添加子节点"
          >
            +
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("确定删除此节点及其所有子节点？")) onDelete(node.id);
            }}
            className="w-6 h-6 flex items-center justify-center text-xs text-zinc-400 hover:text-red-600 rounded"
            title="删除"
          >
            ×
          </button>
        </div>
      </div>

      {/* Add child form */}
      {showAdd && (
        <div style={{ marginLeft: indent + 24 }} className="mb-1">
          <AddNodeForm
            onAdd={(title, type) => {
              onAdd(node.id, title, type);
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
            types={["section", "subsection", "paragraph"]}
          />
        </div>
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <OutlineNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onAdd={onAdd}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: AddNodeForm.tsx**

```tsx
"use client";

import { useState } from "react";
import type { OutlineNodeType } from "@/generated/prisma/enums";

interface Props {
  onAdd: (title: string, type: "section" | "subsection" | "paragraph") => void;
  onCancel: () => void;
  types: Array<"section" | "subsection" | "paragraph">;
}

export default function AddNodeForm({ onAdd, onCancel, types }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(types[0]);

  const handleSubmit = () => {
    if (title.trim()) {
      onAdd(title.trim(), type);
      setTitle("");
    }
  };

  return (
    <div className="flex items-center gap-2 py-1 px-2">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as typeof type)}
        className="text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1"
      >
        {types.map((t) => (
          <option key={t} value={t}>
            {t === "section" ? "节" : t === "subsection" ? "小节" : "段"}
          </option>
        ))}
      </select>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="标题..."
        className="flex-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        onClick={handleSubmit}
        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        确定
      </button>
      <button
        onClick={onCancel}
        className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-700"
      >
        取消
      </button>
    </div>
  );
}
```

**Step 3: OutlineTree.tsx**

```tsx
"use client";

import AddNodeForm from "./AddNodeForm";
import OutlineNodeItem from "./OutlineNodeItem";
import type { FlatNode } from "@/lib/outline-utils";

interface Props {
  tree: FlatNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { title?: string; content?: string }) => void;
  onAdd: (parentId: string | null, title: string, type: "chapter" | "section" | "subsection" | "paragraph") => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string, position: "before" | "after" | "inside") => void;
}

export default function OutlineTree({
  tree,
  selectedId,
  onSelect,
  onDelete,
  onUpdate,
  onAdd,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  const [showAddRoot, setShowAddRoot] = useState(false);

  return (
    <div className="py-2">
      {tree.map((node) => (
        <OutlineNodeItem
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onAdd={(parentId, title, type) => onAdd(parentId, title, type)}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      ))}

      {showAddRoot ? (
        <div className="mt-2">
          <AddNodeForm
            onAdd={(title, type) => {
              onAdd(null, title, type as "chapter");
              setShowAddRoot(false);
            }}
            onCancel={() => setShowAddRoot(false)}
            types={["chapter"]}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowAddRoot(true)}
          className="mt-2 ml-6 text-sm text-zinc-400 hover:text-blue-600 transition-colors"
        >
          + 添加章
        </button>
      )}
    </div>
  );
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 5: Create Content Editor Panel

**Files:**
- Create: `src/components/outline/ContentEditor.tsx`

**Step 1: Write content editor**

```tsx
"use client";

import { useState, useEffect } from "react";
import type { FlatNode } from "@/lib/outline-utils";

interface Props {
  node: FlatNode | null;
  onUpdate: (id: string, data: { content?: string; notes?: string }) => void;
}

export default function ContentEditor({ node, onUpdate }: Props) {
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<"content" | "notes">("content");

  useEffect(() => {
    setContent(node?.content ?? "");
    setNotes(node?.notes ?? "");
  }, [node?.id]);

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        选择一个大纲节点开始写作
      </div>
    );
  }

  const saveContent = () => {
    onUpdate(node.id, { content, notes });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Node info header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {node.title}
        </h2>
        {node.outlineReferences.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {node.outlineReferences.map((or) => (
              <span
                key={or.id}
                className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
              >
                {or.citationText || `[${or.reference.title}]`}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setTab("content")}
          className={`px-4 py-2 text-xs font-medium ${
            tab === "content"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-zinc-500"
          }`}
        >
          正文
        </button>
        <button
          onClick={() => setTab("notes")}
          className={`px-4 py-2 text-xs font-medium ${
            tab === "notes"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-zinc-500"
          }`}
        >
          备注
        </button>
      </div>

      {/* Editor area */}
      <div className="flex-1 p-4">
        {tab === "content" ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={saveContent}
            placeholder="在此撰写正文（支持 Markdown）..."
            className="w-full h-full min-h-[300px] bg-transparent text-sm text-zinc-800 dark:text-zinc-200 resize-none focus:outline-none placeholder:text-zinc-400"
          />
        ) : (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveContent}
            placeholder="个人备注（不会输出到最终文档）..."
            className="w-full h-full min-h-[300px] bg-transparent text-sm text-zinc-500 dark:text-zinc-400 resize-none focus:outline-none placeholder:text-zinc-400 italic"
          />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 6: Integrate into Main Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Rewrite page.tsx with split-pane layout**

```tsx
"use client";

import { useEffect, useCallback } from "react";
import { useOutlineTree } from "@/hooks/useOutlineTree";
import OutlineTree from "@/components/outline/OutlineTree";
import ContentEditor from "@/components/outline/ContentEditor";
import { flattenTree } from "@/lib/outline-utils";
import type { OutlineNodeType } from "@/generated/prisma/enums";

const PROJECT_ID = "7a31d02c-309c-4e79-a286-affc2ce05387";

export default function Home() {
  const { state, loadTree, handleAdd, handleUpdate, handleDelete, handleDrop } =
    useOutlineTree(PROJECT_ID);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const selectedNode = state.selectedId
    ? flattenTree(state.tree).find((n) => n.id === state.selectedId) ?? null
    : null;

  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent, targetId: string, position: "before" | "after" | "inside") => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData("text/plain");
      if (dragId && dragId !== targetId) {
        handleDrop(dragId, targetId, position);
      }
    },
    [handleDrop]
  );

  return (
    <div className="flex flex-1 h-screen">
      {/* Left: Outline tree */}
      <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
        <div className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <h1 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            论文大纲
          </h1>
        </div>
        {state.loading ? (
          <div className="p-4 text-sm text-zinc-400">加载中...</div>
        ) : (
          <OutlineTree
            tree={state.tree}
            selectedId={state.selectedId}
            onSelect={(id) => state.dispatch({ type: "SELECT", id })}
            onDelete={handleDelete}
            onUpdate={(id, data) => handleUpdate(id, data)}
            onAdd={(parentId, title, type) => handleAdd(parentId, title, type)}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        )}
      </div>

      {/* Right: Content editor */}
      <div className="flex-1 overflow-y-auto">
        <ContentEditor node={selectedNode} onUpdate={handleUpdate} />
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd d:\thesis-outline && npx tsc --noEmit
```

---

### Task 7: End-to-End Test

- [ ] **Step 1: Start dev server and verify UI**

```bash
cd d:\thesis-outline && npm run dev
```

Open http://localhost:3000, verify:
- Left panel shows the outline tree from seed data (2 chapters, 4 sections)
- Click a node to select it and show the content editor on the right
- Add a new chapter/section using the + buttons
- Double-click a title to edit inline
- Delete a node with × button (confirmation dialog)
- Edit content in the right panel (auto-saves on blur)
- Drag and drop to reorder nodes

---

### Task 8: Commit

```bash
cd d:\thesis-outline && git add -A && git commit -m "feat: add outline tree editor with drag-drop and Markdown writing"
```
