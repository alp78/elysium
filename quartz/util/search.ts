// ---------------------------------------------------------------------------
// Shared MiniSearch configuration — section-level indexing (VitePress pattern)
// Used by both the build-time index generator and the client-side search.
// This file MUST NOT import any Node.js-only modules (fs, path, etc.)
// ---------------------------------------------------------------------------

const TERM_ALIASES: Record<string, string> = {
  "c#": "csharp",
  "f#": "fsharp",
  "c++": "cplusplus",
  ".net": "dotnet",
}

/** Tokenize text for search — splits on whitespace and camelCase boundaries.
 *  Applies term aliases before tokenizing. */
export function searchTokenize(text: string, _fieldName?: string): string[] {
  const tokens: string[] = []

  // 1. Apply aliases on the original text (case-insensitive)
  let processed = text
  for (const [from, to] of Object.entries(TERM_ALIASES)) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    processed = processed.replace(new RegExp(escaped, "gi"), to)
  }

  // 2. Insert spaces at camelCase boundaries BEFORE lowering
  processed = processed.replace(/([a-z])([A-Z])/g, "$1 $2")

  // 3. Now lower
  const lower = processed.toLowerCase()

  // 4. Split on whitespace
  const rawTokens = lower.split(/\s+/).filter((t) => t.length > 0)

  for (const raw of rawTokens) {
    tokens.push(raw)
  }

  return [...new Set(tokens)]
}

/** Process a single term — apply aliases, discard very short terms. */
export function searchProcessTerm(term: string): string | null {
  const lower = term.toLowerCase()
  if (lower.length < 1) return null
  if (Object.prototype.hasOwnProperty.call(TERM_ALIASES, lower)) {
    return TERM_ALIASES[lower]
  }
  return lower
}

/**
 * Section-level MiniSearch options.
 *
 * Each MiniSearch document represents ONE SECTION of a page (split at headings):
 *   - id:     sequential number
 *   - title:  the current section heading text
 *   - titles: ancestor heading breadcrumb (joined with " > ")
 *   - text:   the body text between this heading and the next
 *   - tags:   page-level tags (space-separated)
 *
 * Boost:  title 4×, text 2×, titles 1× (matches VitePress)
 * Stored: slug (page#anchor), pageTitle, tags — for rendering results
 */
export const miniSearchOptions = {
  fields: ["title", "titles", "tags"] as string[],
  storeFields: ["slug", "pageTitle", "title", "tags"] as string[],
  tokenize: searchTokenize,
  processTerm: searchProcessTerm,
  searchOptions: {
    boost: { title: 4, titles: 1 },
    combineWith: "AND" as const,
  },
}
