interface AuthorEntry {
  given: string;
  family: string;
  order: number;
}

export interface ReferenceData {
  id: string;
  title: string;
  authors: string;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  year: number | null;
  publisher: string | null;
  url: string | null;
  doi: string | null;
}

interface CitationStyleData {
  name: string;
  formatType: string;
  template: Record<string, string>;
}

// ── Author name formatting per style ──

function parseAuthors(authorsJson: string): AuthorEntry[] {
  try {
    return JSON.parse(authorsJson) as AuthorEntry[];
  } catch {
    return [];
  }
}

function formatAuthorsGB(authors: AuthorEntry[]): string {
  if (authors.length === 0) return "";
  return authors
    .sort((a, b) => a.order - b.order)
    .map((a) => a.given.trim() ? `${a.family} ${a.given}` : a.family)
    .join(", ");
}

function formatAuthorsAPA(authors: AuthorEntry[]): string {
  if (authors.length === 0) return "";
  const sorted = [...authors].sort((a, b) => a.order - b.order);
  const names = sorted.map((a) => {
    // Organizational author (no given name) — needs trailing period in APA
    if (!a.given.trim()) return a.family + ".";
    const initials = a.given
      .split(/\s+/)
      .map((w) => (w[0] ?? "").toUpperCase() + ".")
      .join(" ");
    return `${a.family}, ${initials}`;
  });
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  return names.slice(0, -1).join(", ") + ", & " + names[names.length - 1];
}

function formatAuthorsMLA(authors: AuthorEntry[]): string {
  if (authors.length === 0) return "";
  const sorted = [...authors].sort((a, b) => a.order - b.order);
  // Organizational author (no given name)
  if (sorted.length === 1) return sorted[0].given.trim() ? `${sorted[0].family}, ${sorted[0].given}` : sorted[0].family;
  if (sorted.length === 2) {
    const a0 = sorted[0].given.trim() ? `${sorted[0].family}, ${sorted[0].given}` : sorted[0].family;
    const a1 = sorted[1].given.trim() ? `${sorted[1].given} ${sorted[1].family}` : sorted[1].family;
    return `${a0}, and ${a1}`;
  }
  const first = sorted[0].given.trim() ? `${sorted[0].family}, ${sorted[0].given}` : sorted[0].family;
  return `${first}, et al.`;
}

function formatAuthorsIEEE(authors: AuthorEntry[]): string {
  if (authors.length === 0) return "";
  const sorted = [...authors].sort((a, b) => a.order - b.order);
  return sorted
    .map((a) => {
      // Organizational author (no given name)
      if (!a.given.trim()) return a.family;
      const initials = a.given
        .split(/\s+/)
        .map((w) => (w[0] ?? "").toUpperCase() + ".")
        .join(" ");
      return `${initials} ${a.family}`;
    })
    .join(", ");
}

// ── MLA Title Case ──

const MLA_LOWERCASE = new Set([
  "a", "an", "the",
  "and", "but", "or", "nor", "for", "so", "yet",
  "at", "by", "in", "of", "on", "to", "up", "as",
  "is", "it", "be", "am", "are", "was", "were", "been",
  "from", "with", "into", "onto", "upon", "within", "without",
]);

function toTitleCase(title: string): string {
  const words = title.split(/\s+/);
  if (words.length === 0) return title;

  const last = words.length - 1;
  return words
    .map((w, i) => {
      // Always capitalize first and last word
      if (i === 0 || i === last) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
      // Keep lowercase for minor words
      if (MLA_LOWERCASE.has(w.toLowerCase())) {
        return w.toLowerCase();
      }
      // Capitalize all other words
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

// ── Template filling ──

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

// ── Reference entry formatting ──

export function formatReferenceEntry(
  ref: ReferenceData,
  style: CitationStyleData,
  index: number
): string {
  const authors = parseAuthors(ref.authors);
  const hasJournal = !!ref.journal;
  const tmplKey = hasJournal ? "article" : "book";
  const tmpl = style.template[tmplKey] ?? style.template["article"] ?? "";

  let authorsStr: string;
  switch (style.formatType) {
    case "author_year":
      authorsStr = formatAuthorsAPA(authors);
      break;
    case "author_page":
      authorsStr = formatAuthorsMLA(authors);
      break;
    default:
      if (style.name.startsWith("IEEE")) {
        authorsStr = formatAuthorsIEEE(authors);
      } else {
        authorsStr = formatAuthorsGB(authors);
      }
  }

  // MLA: use title case and append DOI
  const isMLA = style.formatType === "author_page";
  const displayTitle = isMLA ? toTitleCase(ref.title) : ref.title;

  const vars: Record<string, string> = {
    authors: authorsStr,
    title: displayTitle,
    journal: ref.journal ?? "",
    volume: ref.volume ?? "",
    issue: ref.issue ?? "",
    pages: ref.pages ?? "",
    year: ref.year?.toString() ?? "",
    publisher: ref.publisher ?? "",
    address: "",
    index: index.toString(),
    doi: ref.doi ?? "",
    url: ref.url ?? "",
  };

  let result = fillTemplate(tmpl, vars);

  // MLA 9th: append DOI if available
  if (isMLA && ref.doi) {
    result += ` doi:${ref.doi}.`;
  }

  return result;
}

// ── In-text citation formatting ──

export function formatInTextCitation(
  ref: ReferenceData,
  style: CitationStyleData,
  index: number
): string {
  const authors = parseAuthors(ref.authors);
  const firstAuthor = authors[0]?.family ?? "?";
  const year = ref.year?.toString() ?? "n.d.";

  switch (style.formatType) {
    case "numeric":
      return `[${index}]`;
    case "author_year":
      if (authors.length === 1) return `(${firstAuthor}, ${year})`;
      if (authors.length === 2)
        return `(${firstAuthor} & ${authors[1].family}, ${year})`;
      return `(${firstAuthor} et al., ${year})`;
    case "author_page":
      return `(${firstAuthor})`;
    default:
      return `[${index}]`;
  }
}
