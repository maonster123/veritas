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

function formatAuthorsNLM(authors: AuthorEntry[]): string {
  if (authors.length === 0) return "";
  const sorted = [...authors].sort((a, b) => a.order - b.order);
  return sorted
    .map((a) => {
      // Organizational author (no given name)
      if (!a.given.trim()) return a.family;
      const initials = a.given
        .split(/\s+/)
        .map((w) => (w[0] ?? "").toUpperCase())
        .join(""); // NLM: no spaces between initials
      return `${a.family} ${initials}`;
    })
    .join(", ");
}

function formatAuthorsIEEE(authors: AuthorEntry[]): string {
  if (authors.length === 0) return "";
  const sorted = [...authors].sort((a, b) => a.order - b.order);
  const names = sorted.map((a) => {
    if (!a.given.trim()) return a.family;
    const initials = a.given
      .split(/\s+/)
      .map((w) => (w[0] ?? "").toUpperCase() + ".")
      .join(" ");
    return `${initials} ${a.family}`;
  });
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return names.slice(0, -1).join(", ") + ", and " + names[names.length - 1];
}

// ── IEEE Journal Abbreviations ──

const IEEE_JOURNAL_ABBRS: Record<string, string> = {
  "American Psychologist": "Am. Psychol.",
  "American Journal of Psychiatry": "Am. J. Psychiatry",
  "American Journal of Psychology": "Am. J. Psychol.",
  "Journal of Applied Psychology": "J. Appl. Psychol.",
  "Journal of Consulting and Clinical Psychology": "J. Consult. Clin. Psychol.",
  "Journal of Counseling Psychology": "J. Couns. Psychol.",
  "Journal of Personality and Social Psychology": "J. Pers. Soc. Psychol.",
  "Journal of Abnormal Psychology": "J. Abnorm. Psychol.",
  "Psychological Bulletin": "Psychol. Bull.",
  "Psychological Review": "Psychol. Rev.",
  "Clinical Psychology Review": "Clin. Psychol. Rev.",
  "Clinical Psychology: Science and Practice": "Clin. Psychol. Sci. Pract.",
  "Psychotherapy": "Psychotherapy",
  "Psychotherapy Research": "Psychother. Res.",
  "Behavior Therapy": "Behav. Ther.",
  "Cognitive Therapy and Research": "Cogn. Ther. Res.",
  "Journal of Experimental Psychology: General": "J. Exp. Psychol. Gen.",
  "Journal of Experimental Psychology: Learning, Memory, and Cognition": "J. Exp. Psychol. Learn. Mem. Cogn.",
  "Developmental Psychology": "Dev. Psychol.",
  "Health Psychology": "Health Psychol.",
  "Professional Psychology: Research and Practice": "Prof. Psychol. Res. Pract.",
  "British Medical Journal": "BMJ",
  "JAMA: Journal of the American Medical Association": "JAMA",
  "The Lancet": "Lancet",
  "New England Journal of Medicine": "N. Engl. J. Med.",
  "Science": "Science",
  "Nature": "Nature",
  "Proceedings of the National Academy of Sciences": "Proc. Natl. Acad. Sci.",
  "PLOS ONE": "PLOS ONE",
  "Journal of Behavioral Addictions": "J. Behav. Addict.",
  "Frontiers in Public Health": "Front. Public Health",
  "Frontiers in Psychology": "Front. Psychol.",
  "Frontiers in Psychiatry": "Front. Psychiatry",
  "Frontiers in Neuroscience": "Front. Neurosci.",
  "Saudi Journal of Biological Sciences": "Saudi J. Biol. Sci.",
  "Advances in Medical Education and Practice": "Adv. Med. Educ. Pract.",
};

function abbreviateJournal(name: string): string {
  return IEEE_JOURNAL_ABBRS[name] ?? name;
}

// ── MLA Title Case ──

const MLA_LOWERCASE = new Set([
  "a", "an", "the",
  "and", "but", "or", "nor", "for", "so", "yet",
  "at", "by", "in", "of", "on", "to", "up", "as",
  "is", "it", "be", "am", "are", "was", "were", "been",
  "from", "with", "into", "onto", "upon", "within", "without",
]);

function toSentenceCase(title: string): string {
  return title.replace(/[^:]+/g, (part, offset) => {
    const trimmed = part.trimStart();
    const leadingSpace = part.slice(0, part.length - trimmed.length);
    const first = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    return offset === 0 ? first : leadingSpace + first;
  });
}

function toTitleCase(title: string): string {
  const words = title.split(/\s+/);
  if (words.length === 0) return title;

  const last = words.length - 1;

  // Find words that come after a colon (they should be capitalized like first words)
  const afterColon = new Set<number>();
  for (let i = 1; i < words.length; i++) {
    if (words[i - 1].endsWith(":")) afterColon.add(i);
  }

  return words
    .map((w, i) => {
      // Capitalize hyphenated parts
      const parts = w.split("-");
      const capitalized = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("-");

      // Always capitalize first, last, and words after colon
      if (i === 0 || i === last || afterColon.has(i)) return capitalized;
      // Keep lowercase for minor words (but keep hyphenated capitalization)
      if (MLA_LOWERCASE.has(w.toLowerCase())) {
        return parts.map(p => p.toLowerCase()).join("-");
      }
      return capitalized;
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
      } else if (style.name.startsWith("NLM")) {
        authorsStr = formatAuthorsNLM(authors);
      } else {
        authorsStr = formatAuthorsGB(authors);
      }
  }

  // Title formatting per style
  const isMLA = style.formatType === "author_page";
  const isIEEE = style.name === "IEEE";
  const isAPA = style.formatType === "author_year";
  const displayTitle = isMLA || isIEEE ? toTitleCase(ref.title) : isAPA ? toSentenceCase(ref.title) : ref.title;
  // IEEE & NLM: abbreviate journal name
  const isNLM = style.name === "NLM";
  const displayJournal = (isIEEE || isNLM) ? abbreviateJournal(ref.journal ?? "") : (ref.journal ?? "");

  // APA sentence case: restore ALL-CAPS acronyms from original title (e.g., "GPA", "COVID-19")
  let finalTitle = displayTitle;
  if (isAPA) {
    const origWords = ref.title.split(/\s+/);
    const finalWords = finalTitle.split(/\s+/);
    for (let i = 0; i < origWords.length && i < finalWords.length; i++) {
      if (origWords[i].length >= 2 && origWords[i] === origWords[i].toUpperCase()) {
        finalWords[i] = origWords[i];
      }
    }
    finalTitle = finalWords.join(" ");
  }

  const vars: Record<string, string> = {
    authors: authorsStr,
    title: finalTitle,
    journal: displayJournal,
    volume: ref.volume ?? "",
    issue: ref.issue ?? "",
    pages: ref.pages ?? "",
    year: ref.year?.toString() ?? "",
    publisher: ref.publisher ?? "",
    address: "",
    month: "",
    index: index.toString(),
    doi: ref.doi ?? "",
    url: ref.url ?? "",
  };

  // Strip trailing periods only when template adds a period right after
  if (tmpl.includes("{authors}.")) {
    vars.authors = vars.authors.replace(/\.+$/, "");
  }
  if (tmpl.includes("{journal}.")) {
    vars.journal = vars.journal.replace(/\.+$/, "");
  }

  // ── Build citation programmatically (no template, no regex cleanup) ──
  const V = vars.volume;
  const I = vars.issue;
  const P = vars.pages;
  const Y = vars.year;
  const doi = vars.doi ? (vars.doi.startsWith("http") ? vars.doi : `https://doi.org/${vars.doi}`) : "";
  const pub = vars.publisher;

  let result = "";

  if (style.name === "APA 7th" || style.formatType === "author_year") {
    // APA 7th: Authors. (Year). Title. Journal, Volume(Issue), Pages. https://doi.org/xxx
    const volIssue = V ? (I ? `${V}(${I})` : V) : "";
    const pages = P || "";
    result = `${vars.authors} (${Y}). ${vars.title}. ${vars.journal}`;
    if (volIssue || pages) result += `, ${[volIssue, pages].filter(Boolean).join(", ")}`;
    result += ".";
    if (doi) result += ` ${doi}`;
  } else if (style.name === "MLA 9th" || style.formatType === "author_page") {
    // MLA 9th
    const isBook = !ref.journal;
    if (isBook) {
      // Book: Authors. _Title._ Publisher, Year.
      result = `${vars.authors}. _${vars.title}._`;
      if (pub) result += ` ${pub}`;
      if (Y) result += `, ${Y}`;
      result += ".";
    } else {
      // Article: Authors. "Title." Journal, vol. Volume, no. Issue, Year, pp. Pages.
      result = `${vars.authors}. "${vars.title}." ${vars.journal}`;
      if (V) result += `, vol. ${V}`;
      if (I) result += `, no. ${I}`;
      if (Y) result += `, ${Y}`;
      if (P) result += `, pp. ${P}`;
      result += ".";
    }
    if (doi) result += ` doi:${ref.doi}.`;
  } else if (style.name === "IEEE") {
    // IEEE: A. Author, "Title," Journal, vol. X, no. X, pp. X, Year.
    result = `${vars.authors}, "${vars.title}," ${vars.journal}`;
    if (V) result += `, vol. ${V}`;
    if (I) result += `, no. ${I}`;
    if (P) result += `, pp. ${P}`;
    if (Y) result += `, ${Y}`;
    result += ".";
    if (doi) result += ` doi:${ref.doi}.`;
  } else if (style.name === "NLM") {
    // NLM: Authors. Title. Journal Abbrev. Year;Volume(Issue):Pages. doi:xxx
    result = `${vars.authors}. ${vars.title}. ${vars.journal}. ${Y}`;
    if (V) {
      result += `;${V}`;
      if (I) result += `(${I})`;
      if (P) result += `:${P}`;
    }
    result += ".";
    if (doi) result += ` doi:${ref.doi}.`;
  } else {
    // GB/T 7714 & others: [N] Authors. Title[J]. Journal, Year, Volume(Issue): Pages.
    const volIssue = V ? (I ? `${V}(${I})` : V) : "";
    const pages = P ? `: ${P}` : "";
    const num = style.formatType === "numeric" && !style.name.startsWith("IEEE") ? `[${index}] ` : "";
    result = `${num}${vars.authors}. ${vars.title}[J]. ${vars.journal}, ${Y}, ${volIssue}${pages}.`;
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
