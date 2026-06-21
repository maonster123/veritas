interface Author {
  given: string;
  family: string;
  order: number;
}

interface CrossRefWork {
  title?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  "published-print"?: { "date-parts"?: number[][] };
  published?: { "date-parts"?: number[][] };
  publisher?: string;
  URL?: string;
  abstract?: string;
}

export interface ResolvedReference {
  title: string;
  authors: Author[];
  journal: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  year: number | null;
  publisher: string | null;
  url: string | null;
  abstract: string | null;
  rawBibtex: string | null;
}

function pickYear(work: CrossRefWork): number | null {
  const parts =
    work["published-print"]?.["date-parts"]?.[0] ??
    work.published?.["date-parts"]?.[0];
  return parts?.[0] ?? null;
}

function parseAuthors(work: CrossRefWork): Author[] {
  return (work.author ?? []).map((a, i) => {
    // Organizational authors use "name" field (e.g., "American Psychological Association")
    if (a.name && !a.given && !a.family) {
      return { given: "", family: a.name, order: i };
    }
    return {
      given: a.given ?? "",
      family: a.family ?? "",
      order: i,
    };
  });
}

async function fetchCrossRef(doi: string): Promise<ResolvedReference | null> {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "ThesisOutline/0.1 (mailto:dev@localhost)" },
  });
  if (!res.ok) return null;

  const json = await res.json();
  const work: CrossRefWork = json.message;

  return {
    title: work.title?.[0] ?? "Unknown Title",
    authors: parseAuthors(work),
    journal: work["container-title"]?.[0] ?? null,
    volume: work.volume ?? null,
    issue: work.issue ?? null,
    pages: work.page ?? null,
    year: pickYear(work),
    publisher: work.publisher ?? null,
    url: work.URL ?? null,
    abstract: work.abstract ?? null,
    rawBibtex: null,
  };
}

async function fetchDataCite(doi: string): Promise<ResolvedReference | null> {
  const url = `https://api.datacite.org/works/${encodeURIComponent(doi)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.datacite.datacite+json" },
  });
  if (!res.ok) return null;

  const json = await res.json();
  const attrs = json.data?.attributes ?? {};

  return {
    title: attrs.titles?.[0]?.title ?? "Unknown Title",
    authors: (attrs.creators ?? []).map((c: any, i: number) => ({
      given: c.givenName ?? "",
      family: c.familyName ?? "",
      order: i,
    })),
    journal: attrs.container?.title ?? null,
    volume: attrs.container?.volume ?? null,
    issue: attrs.container?.issue ?? null,
    pages: `${attrs.container?.firstPage ?? ""}${attrs.container?.firstPage && attrs.container?.lastPage ? "-" + attrs.container?.lastPage : ""}` || null,
    year: attrs.publicationYear ?? null,
    publisher: attrs.publisher ?? null,
    url: attrs.url ?? null,
    abstract: attrs.descriptions?.[0]?.description ?? null,
    rawBibtex: null,
  };
}

export async function resolveDOI(doi: string): Promise<ResolvedReference> {
  // Normalize DOI: strip "https://doi.org/" prefix if present
  const normalized = doi.replace(/^https?:\/\/doi\.org\//i, "").trim();

  // Try CrossRef first, then DataCite
  const result = (await fetchCrossRef(normalized)) ?? (await fetchDataCite(normalized));

  if (!result) {
    throw new Error(`Could not resolve DOI: ${normalized}`);
  }

  return result;
}
