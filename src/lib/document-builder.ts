import { parseMarkdown, type ParsedSegment } from "./markdown-parser";
import type { FlatNode } from "./outline-utils";
import { flattenTree } from "./outline-utils";

export interface FormatConfig {
  pageMargins: { top: number; bottom: number; left: number; right: number };
  lineSpacing: number;
  headingStyles: Record<string, { font: string; size: number; bold: boolean }>;
  bodyFont: { family: string; size: number };
  headerFooter: { header?: string; footer?: string };
}

export interface CitationConfig {
  formatType: "numeric" | "author_year" | "author_page";
  template: Record<string, string>;
}

export interface DocumentData {
  title: string;
  subtitle?: string | null;
  sections: DocumentSection[];
  references: { index: number; text: string; id: string }[];
}

export interface DocumentSection {
  nodeId: string;
  title: string;
  type: string;
  level: number;
  segments: ParsedSegment[];
  citations: string[];
  children: DocumentSection[];
}

function getNodeLevel(node: FlatNode, tree: FlatNode[]): number {
  let level = 1;
  let current: FlatNode | undefined = node;
  const flat = flattenTree(tree);
  while (current.parentId) {
    level++;
    current = flat.find((n) => n.id === current!.parentId);
    if (!current) break;
  }
  return Math.min(level, 4);
}

export function buildDocument(
  project: { title: string; subtitle?: string | null },
  tree: FlatNode[],
  formatConfig: FormatConfig,
  citationConfig: CitationConfig
): DocumentData {
  const referencesList: { id: string; text: string }[] = [];

  function buildSections(nodes: FlatNode[]): DocumentSection[] {
    return nodes.map((node) => {
      const segments = node.content ? parseMarkdown(node.content) : [];
      const level = getNodeLevel(node, tree);

      const citations: string[] = [];
      if (node.outlineReferences) {
        for (const or of node.outlineReferences) {
          if (or.citationText) {
            citations.push(or.citationText);
          }
          if (!referencesList.find((r) => r.id === or.reference.id)) {
            referencesList.push({ id: or.reference.id, text: "" });
          }
        }
      }

      return {
        nodeId: node.id,
        title: node.title,
        type: node.type,
        level,
        segments,
        citations,
        children: buildSections(node.children),
      };
    });
  }

  const sections = buildSections(tree);

  const refEntries = referencesList.map((ref, index) => {
    const num = index + 1;
    const refRecord = flattenTree(tree)
      .find((n) =>
        n.outlineReferences?.some((or) => or.reference.id === ref.id)
      );
    const fullRef = refRecord?.outlineReferences?.find(
      (or) => or.reference.id === ref.id
    )?.reference;
    const text = fullRef
      ? `[${num}] ${fullRef.title}${fullRef.year ? ` (${fullRef.year})` : ""}`
      : `[${num}] Reference ${ref.id}`;
    return { index: num, text, id: ref.id };
  });

  return {
    title: project.title,
    subtitle: project.subtitle,
    sections,
    references: refEntries,
  };
}
