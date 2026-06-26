import { parseMarkdown, type ParsedSegment } from "./markdown-parser";
import type { FlatNode } from "./outline-utils";
import { flattenTree } from "./outline-utils";
import { formatReferenceEntry, type ReferenceData } from "./citation-formatter";

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
  styleName?: string;
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

interface RefMeta {
  id: string;
  title: string;
  year: number | null;
  authors: string;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
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
  const referencesMap = new Map<string, RefMeta>();

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
          if (!referencesMap.has(or.reference.id)) {
            referencesMap.set(or.reference.id, {
              id: or.reference.id,
              title: or.reference.title,
              year: (or.reference as any).year ?? null,
              authors: (or.reference as any).authors ?? "[]",
              journal: (or.reference as any).journal ?? null,
              volume: (or.reference as any).volume ?? null,
              issue: (or.reference as any).issue ?? null,
              pages: (or.reference as any).pages ?? null,
            });
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

  const refEntries = Array.from(referencesMap.values()).map((ref, index) => {
    const num = index + 1;
    const refData: ReferenceData = {
      id: ref.id,
      title: ref.title,
      authors: ref.authors,
      journal: ref.journal,
      volume: ref.volume,
      issue: ref.issue,
      pages: ref.pages,
      year: ref.year,
      publisher: null,
      url: null,
      doi: (ref as any).doi ?? null,
    };
    const text = formatReferenceEntry(refData, {
      name: citationConfig.styleName ?? "",
      formatType: citationConfig.formatType,
      template: citationConfig.template,
    }, num);
    return { index: num, text, id: ref.id };
  });

  return {
    title: project.title,
    subtitle: project.subtitle,
    sections,
    references: refEntries,
  };
}
