export interface FlatNode {
  id: string;
  projectId: string;
  parentId: string | null;
  sortOrder: number;
  title: string;
  type: "chapter" | "section" | "subsection" | "paragraph";
  content: string | null;
  notes: string | null;
  aiContent: string | null;
  children: FlatNode[];
  outlineReferences?: {
    id: string;
    citationText: string | null;
    reference: { id: string; title: string; year: number | null };
  }[];
}

export function buildTree(nodes: Omit<FlatNode, "children">[]): FlatNode[] {
  const map = new Map<string, FlatNode>();
  const roots: FlatNode[] = [];

  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] } as FlatNode);
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else if (!node.parentId) {
      roots.push(node);
    }
  }

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

export function findNode(tree: FlatNode[], id: string): FlatNode | null {
  const flat = flattenTree(tree);
  return flat.find((n) => n.id === id) ?? null;
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
