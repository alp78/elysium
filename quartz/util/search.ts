// ---------------------------------------------------------------------------
// Shared MiniSearch configuration
// Used by both the build-time index generator and the client-side search.
// This file MUST NOT import any Node.js-only modules (fs, path, etc.)
// ---------------------------------------------------------------------------

const TERM_ALIASES: Record<string, string> = {
  "c#": "csharp",
  "f#": "fsharp",
  "c++": "cplusplus",
  ".net": "dotnet",
}

/** Tokenize text for search indexing — splits on whitespace, technical separators,
 *  and camelCase boundaries. */
export function searchTokenize(text: string): string[] {
  const tokens: string[] = []

  // 1. Apply aliases on the original text (case-insensitive)
  let processed = text
  for (const [from, to] of Object.entries(TERM_ALIASES)) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    processed = processed.replace(new RegExp(escaped, "gi"), to)
  }

  // 2. Insert spaces at camelCase boundaries BEFORE lowering
  //    "DataFrame" → "Data Frame", "getElementById" → "get Element By Id"
  processed = processed.replace(/([a-z])([A-Z])/g, "$1 $2")

  // 3. Now lower
  const lower = processed.toLowerCase()

  // 4. Split on whitespace
  const rawTokens = lower.split(/\s+/).filter((t) => t.length > 0)

  for (const raw of rawTokens) {
    tokens.push(raw)

    // No sub-splitting. Compound terms like "io-redirection", "file_io",
    // "t-sql" stay as single tokens. Only whitespace and camelCase split.
  }

  return [...new Set(tokens)]
}

/** Process a single term — apply aliases. */
export function searchProcessTerm(term: string): string | null {
  const lower = term.toLowerCase()
  if (lower.length < 1) return null
  if (Object.prototype.hasOwnProperty.call(TERM_ALIASES, lower)) {
    return TERM_ALIASES[lower]
  }
  return lower
}

/** The MiniSearch options object shared between build-time and client-side.
 *  Must be passed to both `new MiniSearch(opts)` and `MiniSearch.loadJSON(json, opts)`. */
export const miniSearchOptions = {
  fields: ["title", "content", "tags"] as string[],
  storeFields: ["title", "slug", "tags"] as string[],
  tokenize: searchTokenize,
  processTerm: searchProcessTerm,
  searchOptions: {
    boost: { title: 3, tags: 2 },
  },
}
