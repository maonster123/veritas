export interface ParsedSegment {
  type: "heading" | "paragraph" | "list";
  level?: number;
  items?: ParsedInline[][];
  content?: ParsedInline[];
}

export interface ParsedInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export function parseMarkdown(md: string): ParsedSegment[] {
  const lines = md.split("\n");
  const segments: ParsedSegment[] = [];
  let listItems: ParsedInline[][] = [];

  function flushList() {
    if (listItems.length > 0) {
      segments.push({ type: "list", items: [...listItems] });
      listItems = [];
    }
  }

  for (const line of lines) {
    // Heading: # Title
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      flushList();
      segments.push({
        type: "heading",
        level: headingMatch[1].length,
        content: parseInline(headingMatch[2]),
      });
      continue;
    }

    // List item: - text or * text
    const listMatch = line.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      listItems.push(parseInline(listMatch[1]));
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    segments.push({ type: "paragraph", content: parseInline(line) });
  }

  flushList();
  return segments;
}

function parseInline(text: string): ParsedInline[] {
  const result: ParsedInline[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[2]) {
      result.push({ text: match[2], bold: true });
    } else if (match[3]) {
      result.push({ text: match[3], italic: true });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ text: text.slice(lastIndex) });
  }

  return result.length > 0 ? result : [{ text }];
}
