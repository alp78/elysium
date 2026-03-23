import MiniSearch from "minisearch"
import { ContentDetails, HeadingIndex } from "../../plugins/emitters/contentIndex"
import { removeAllChildren } from "./util"
import { FullSlug, resolveRelative } from "../../util/path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchDoc {
  id: number
  slug: FullSlug
  title: string
  content: string
  tags: string[]
  /** content split into paragraphs for block-level proximity */
  blocks: string[]
  /** heading anchors from the content index */
  headings: HeadingIndex[]
}

interface ParsedQuery {
  terms: string[]
  excludeTerms: string[]
  operator: "AND" | "OR"
  tagFilters: string[]
  phraseFilters: string[]
  pathFilter: string | null
}

// ---------------------------------------------------------------------------
// Module-level state (survives SPA navigations)
// ---------------------------------------------------------------------------

let miniSearch: MiniSearch<SearchDoc> | null = null
const docMap = new Map<number, SearchDoc>()

/** Tags the user toggled ON in the tag browser (include) */
const tagInclude = new Set<string>()
/** Tags the user toggled OFF in the tag browser (exclude) */
const tagExclude = new Set<string>()

/** Global search mode toggled by the AND/OR button */
let searchMode: "AND" | "OR" = "AND"
/** Tag-specific AND/OR mode toggled by the tag browser toggle */
let tagMode: "AND" | "OR" = "AND"

// ---------------------------------------------------------------------------
// Index building
// ---------------------------------------------------------------------------

function splitBlocks(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 20)
}

async function buildIndex(data: ContentIndex): Promise<void> {
  if (miniSearch) return // build once; survives SPA navigations

  miniSearch = new MiniSearch<SearchDoc>({
    fields: ["title", "content", "tags"],
    storeFields: ["slug", "title", "tags"],
    searchOptions: {
      boost: { title: 4, tags: 2, content: 1 },
      prefix: true,
      fuzzy: 0.1,
    },
  })

  let id = 0
  const docs: SearchDoc[] = []

  for (const [slug, details] of Object.entries<ContentDetails>(data)) {
    const doc: SearchDoc = {
      id,
      slug: slug as FullSlug,
      title: details.title ?? slug,
      content: details.content ?? "",
      tags: details.tags ?? [],
      blocks: splitBlocks(details.content ?? ""),
      headings: details.headings ?? [],
    }
    docs.push(doc)
    docMap.set(id, doc)
    id++
  }

  await miniSearch.addAllAsync(docs)
}

// ---------------------------------------------------------------------------
// Query parser
// ---------------------------------------------------------------------------

function parseQuery(raw: string): ParsedQuery {
  const result: ParsedQuery = {
    terms: [],
    excludeTerms: [],
    operator: searchMode, // default from the toggle button
    tagFilters: [],
    phraseFilters: [],
    pathFilter: null,
  }

  let text = raw.trim()

  // Explicit OR/AND keywords in the query override the toggle
  if (/\bOR\b/.test(text)) {
    result.operator = "OR"
    text = text.replace(/\bOR\b/g, " ")
  } else if (/\bAND\b/.test(text)) {
    result.operator = "AND"
    text = text.replace(/\bAND\b/g, " ")
  }

  // Quoted phrases: "foo bar"
  text = text.replace(/"([^"]+)"/g, (_, p: string) => {
    result.phraseFilters.push(p.toLowerCase())
    return ""
  })

  // Tag filters typed in the search bar: #tag or tag:#tag
  text = text.replace(/(?:tag:)?#(\S+)/g, (_, t: string) => {
    result.tagFilters.push(t.toLowerCase())
    return ""
  })

  // Path filter: path:folder
  text = text.replace(/path:(\S+)/g, (_, p: string) => {
    result.pathFilter = p.toLowerCase()
    return ""
  })

  // NOT terms: -word
  text = text.replace(/-(\S+)/g, (_, t: string) => {
    result.excludeTerms.push(t.toLowerCase())
    return ""
  })

  // Remaining words are the main search terms
  result.terms = text
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0)

  return result
}

// ---------------------------------------------------------------------------
// Proximity helper
// ---------------------------------------------------------------------------

/** Returns true if at least one block contains ALL of the given terms. */
function blockHasAllTerms(blocks: string[], terms: string[]): boolean {
  if (terms.length <= 1) return true
  return blocks.some((b) => {
    const lower = b.toLowerCase()
    return terms.every((t) => lower.includes(t))
  })
}

// ---------------------------------------------------------------------------
// Deep-link: find the nearest heading anchor above the best matching block
// ---------------------------------------------------------------------------

/**
 * Given a document and search terms, return the heading anchor (#id) closest
 * to the best matching block.  Returns "" for tag-only searches or when no
 * heading can be resolved.
 */
function findAnchor(doc: SearchDoc, terms: string[]): string {
  if (terms.length === 0 || doc.headings.length === 0) return ""

  // Find the best matching block (highest term-hit count)
  let bestBlockIdx = 0
  let bestScore = 0
  for (let i = 0; i < doc.blocks.length; i++) {
    const lower = doc.blocks[i].toLowerCase()
    const score = terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestBlockIdx = i
    }
  }
  if (bestScore === 0) return ""

  // Approximate the character offset of this block in the original content
  const blockText = doc.blocks[bestBlockIdx]
  const blockOffset = doc.content.indexOf(blockText)
  if (blockOffset === -1) return ""

  // Walk headings: find the last heading whose text appears BEFORE blockOffset
  let bestHeading: HeadingIndex | null = null
  for (const h of doc.headings) {
    const hPos = doc.content.indexOf(h.text)
    if (hPos !== -1 && hPos <= blockOffset) {
      bestHeading = h
    }
  }

  return bestHeading ? `#${bestHeading.id}` : ""
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

async function runSearch(query: string): Promise<SearchDoc[]> {
  if (!miniSearch) return []

  const parsed = parseQuery(query)

  // Merge inline-typed tag filters with browser-selected ones
  const allTagInc = new Set([...tagInclude, ...parsed.tagFilters])
  const allTagExc = new Set([...tagExclude])

  const hasText = parsed.terms.length > 0 || parsed.phraseFilters.length > 0

  let docs: SearchDoc[]

  if (hasText) {
    // Build the term list: main terms + phrase fragments
    const queryTerms = [
      ...parsed.terms,
      ...parsed.phraseFilters.flatMap((p) => p.split(" ")),
    ]

    const results = miniSearch.search(queryTerms.join(" "), {
      combineWith: parsed.operator === "OR" ? "OR" : "AND",
      prefix: true,
      fuzzy: 0.1,
      boost: { title: 4, tags: 2 },
    })

    docs = results.map((r) => docMap.get(r.id as number)!).filter(Boolean)
  } else if (allTagInc.size > 0) {
    // Tag-only filter: start from all docs
    docs = [...docMap.values()]
  } else {
    return []
  }

  // AND enforcement: every term must appear somewhere in the document.
  if (parsed.operator === "AND" && parsed.terms.length >= 2) {
    docs = docs.filter((d) => {
      const haystack = `${d.title} ${d.content} ${d.tags.join(" ")}`.toLowerCase()
      return parsed.terms.every((t) => haystack.includes(t))
    })
  }

  // Exact phrase filter (substring must appear in title or content)
  for (const phrase of parsed.phraseFilters) {
    docs = docs.filter(
      (d) =>
        d.content.toLowerCase().includes(phrase) ||
        d.title.toLowerCase().includes(phrase),
    )
  }

  // Block-proximity: AND query with 2+ terms → both must live in the same paragraph
  if (parsed.operator === "AND" && parsed.terms.length >= 2) {
    docs = docs.filter((d) => blockHasAllTerms(d.blocks, parsed.terms))
  }

  // Tag include (respects tagMode AND/OR)
  if (allTagInc.size > 0) {
    if (tagMode === "AND") {
      // ALL selected tags must be present
      docs = docs.filter((d) =>
        [...allTagInc].every((t) => d.tags.some((dt) => dt.toLowerCase().includes(t))),
      )
    } else {
      // ANY selected tag must be present
      docs = docs.filter((d) =>
        [...allTagInc].some((t) => d.tags.some((dt) => dt.toLowerCase().includes(t))),
      )
    }
  }

  // Tag exclude
  if (allTagExc.size > 0) {
    docs = docs.filter(
      (d) => ![...allTagExc].some((t) => d.tags.some((dt) => dt.toLowerCase().includes(t))),
    )
  }

  // Path filter
  if (parsed.pathFilter) {
    docs = docs.filter((d) => d.slug.toLowerCase().includes(parsed.pathFilter!))
  }

  // NOT terms
  if (parsed.excludeTerms.length > 0) {
    docs = docs.filter((d) => {
      const lower = `${d.title} ${d.content}`.toLowerCase()
      return !parsed.excludeTerms.some((t) => lower.includes(t))
    })
  }

  return docs.slice(0, 40)
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function escHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlight(text: string, terms: string[]): string {
  let result = escHtml(text)
  for (const term of terms.filter((t) => t.length > 1)) {
    const re = new RegExp(`(${escRe(escHtml(term))})`, "gi")
    result = result.replace(re, "<mark>$1</mark>")
  }
  return result
}

/** Pick the block with the most term hits and trim around the first match. */
function getSnippet(doc: SearchDoc, terms: string[], maxLen = 150): string {
  if (terms.length === 0) {
    return escHtml((doc.blocks[0] ?? doc.content).slice(0, maxLen))
  }

  let best = doc.blocks[0] ?? doc.content.slice(0, 400)
  let bestScore = 0
  for (const b of doc.blocks) {
    const lower = b.toLowerCase()
    const score = terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      best = b
    }
  }

  const lower = best.toLowerCase()
  let start = 0
  for (const t of terms) {
    const i = lower.indexOf(t)
    if (i !== -1) {
      start = Math.max(0, i - 40)
      break
    }
  }

  const prefix = start > 0 ? "…" : ""
  let snippet = prefix + best.slice(start, start + maxLen)
  if (best.length > start + maxLen) snippet += "…"

  return highlight(snippet, terms)
}

function slugToFolder(slug: FullSlug): string {
  const parts = slug.split("/")
  if (parts.length === 1) return "Notes"
  // "02-Programming-Languages" → "Programming Languages"
  return parts[0].replace(/^\d+-/, "").replace(/-/g, " ")
}

// ---------------------------------------------------------------------------
// Results rendering
// ---------------------------------------------------------------------------

function renderResults(
  docs: SearchDoc[],
  query: string,
  currentSlug: FullSlug,
  container: HTMLElement,
): void {
  removeAllChildren(container)

  if (docs.length === 0) {
    const el = document.createElement("div")
    el.className = "search-empty"
    el.textContent =
      query.trim() || tagInclude.size > 0 ? "No results found" : "Start typing to search…"
    container.appendChild(el)
    return
  }

  const parsed = parseQuery(query)
  const terms = [
    ...parsed.terms,
    ...parsed.phraseFilters.flatMap((p) => p.split(" ")),
  ]

  const hasText = terms.length > 0

  // Decide grouping strategy:
  // - If tag-only search in OR mode → group by matched tag
  // - Otherwise → group by folder
  const useTagGroups = !hasText && tagMode === "OR" && tagInclude.size > 1

  if (useTagGroups) {
    // Group by matching tag
    const groups = new Map<string, SearchDoc[]>()
    for (const doc of docs) {
      for (const activeTag of tagInclude) {
        if (doc.tags.some((dt) => dt.toLowerCase().includes(activeTag))) {
          const label = `#${activeTag}`
          if (!groups.has(label)) groups.set(label, [])
          // avoid duplicates within a group
          const arr = groups.get(label)!
          if (!arr.some((d) => d.slug === doc.slug)) {
            arr.push(doc)
          }
        }
      }
    }
    renderGrouped(groups, terms, hasText, currentSlug, container)
  } else {
    // Group by folder
    const groups = new Map<string, SearchDoc[]>()
    for (const doc of docs) {
      const folder = slugToFolder(doc.slug)
      if (!groups.has(folder)) groups.set(folder, [])
      groups.get(folder)!.push(doc)
    }
    renderGrouped(groups, terms, hasText, currentSlug, container)
  }
}

function renderGrouped(
  groups: Map<string, SearchDoc[]>,
  terms: string[],
  hasText: boolean,
  currentSlug: FullSlug,
  container: HTMLElement,
): void {
  for (const [groupName, group] of groups) {
    const groupEl = document.createElement("div")
    groupEl.className = "result-group"

    const header = document.createElement("div")
    header.className = "result-group-header"
    header.textContent = groupName
    groupEl.appendChild(header)

    for (const doc of group) {
      const anchor = hasText ? findAnchor(doc, terms) : ""
      const baseUrl = resolveRelative(currentSlug, doc.slug)

      const a = document.createElement("a")
      a.className = "result-item"
      a.href = baseUrl + anchor

      const snippet = getSnippet(doc, terms)
      const tagsHtml = doc.tags
        .slice(0, 5)
        .map((t) => {
          const active = tagInclude.has(t)
          return `<span class="result-tag${active ? " active-tag" : ""}">#${escHtml(t)}</span>`
        })
        .join("")

      a.innerHTML = `
        <span class="result-title">${highlight(doc.title, terms)}</span>
        ${snippet ? `<span class="result-snippet">${snippet}</span>` : ""}
        ${tagsHtml ? `<span class="result-tags">${tagsHtml}</span>` : ""}
      `

      a.addEventListener("click", () => {
        container.classList.remove("active")
      })

      groupEl.appendChild(a)
    }

    container.appendChild(groupEl)
  }
}

// ---------------------------------------------------------------------------
// Tag browser
// ---------------------------------------------------------------------------

function setupTagBrowser(
  tagListEl: HTMLElement,
  filterBarEl: HTMLElement,
  tagModeToggle: HTMLButtonElement,
  onFilterChange: () => void,
): void {
  // Per-tag state: 0 = neutral, 1 = include (green), 2 = exclude (red)
  const tagStates = new Map<string, 0 | 1 | 2>()

  function syncGlobalSets(): void {
    tagInclude.clear()
    tagExclude.clear()
    for (const [tag, state] of tagStates) {
      if (state === 1) tagInclude.add(tag)
      else if (state === 2) tagExclude.add(tag)
    }
  }

  function renderFilterBar(): void {
    removeAllChildren(filterBarEl)
    let hasAny = false
    for (const [tag, state] of tagStates) {
      if (state === 0) continue
      hasAny = true

      const chip = document.createElement("span")
      chip.className = `filter-chip ${state === 1 ? "chip-include" : "chip-exclude"}`

      const label = document.createElement("span")
      label.className = "chip-label"
      label.textContent = `${state === 1 ? "+" : "−"}#${tag}`
      chip.appendChild(label)

      const btn = document.createElement("button")
      btn.className = "chip-remove"
      btn.type = "button"
      btn.textContent = "×"
      btn.setAttribute("aria-label", `Remove ${tag} filter`)
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        tagStates.set(tag, 0)
        updatePillAppearance(tag, 0)
        syncGlobalSets()
        renderFilterBar()
        onFilterChange()
      })
      chip.appendChild(btn)
      filterBarEl.appendChild(chip)
    }
    filterBarEl.classList.toggle("has-filters", hasAny)
  }

  function updatePillAppearance(tag: string, state: 0 | 1 | 2): void {
    const pill = tagListEl.querySelector<HTMLElement>(`[data-tag="${tag}"]`)
    if (!pill) return
    pill.classList.remove("tag-include", "tag-exclude")
    if (state === 1) pill.classList.add("tag-include")
    else if (state === 2) pill.classList.add("tag-exclude")
  }

  tagListEl.addEventListener("click", (e) => {
    const pill = (e.target as Element).closest<HTMLElement>(".tag-pill")
    if (!pill) return
    const tag = pill.dataset.tag!
    const current = tagStates.get(tag) ?? 0
    // Cycle: neutral → include → exclude → neutral
    const next = ((current + 1) % 3) as 0 | 1 | 2
    tagStates.set(tag, next)
    updatePillAppearance(tag, next)
    syncGlobalSets()
    renderFilterBar()
    onFilterChange()
  })

  // Tag mode AND/OR toggle
  function syncTagToggle(): void {
    tagModeToggle.dataset.mode = tagMode
    tagModeToggle.textContent = tagMode
    tagModeToggle.setAttribute("aria-label", `Tag filter mode: ${tagMode}`)
  }
  syncTagToggle()

  tagModeToggle.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation() // don't toggle the <details>
    tagMode = tagMode === "AND" ? "OR" : "AND"
    syncTagToggle()
    onFilterChange()
  })
}

// ---------------------------------------------------------------------------
// Main setup (called on each SPA navigation)
// ---------------------------------------------------------------------------

async function setupSearch(
  searchEl: Element,
  currentSlug: FullSlug,
  data: ContentIndex,
): Promise<void> {
  await buildIndex(data)

  const bar = searchEl.querySelector<HTMLInputElement>(".search-bar")!
  const resultsPanel = searchEl.querySelector<HTMLElement>(".search-results")!
  const filterBarEl = searchEl.querySelector<HTMLElement>(".search-filter-bar")!
  const tagListEl = searchEl.querySelector<HTMLElement>(".tag-list")!
  const modeToggle = searchEl.querySelector<HTMLButtonElement>(".search-mode-toggle")!
  const tagModeToggle = searchEl.querySelector<HTMLButtonElement>(".tag-mode-toggle")!

  let currentQuery = ""

  // AND / OR toggle button for text search
  function syncToggleAppearance(): void {
    modeToggle.dataset.mode = searchMode
    modeToggle.textContent = searchMode
    modeToggle.setAttribute("aria-label", `Search mode: ${searchMode}`)
  }
  syncToggleAppearance()

  const onToggleClick = (): void => {
    searchMode = searchMode === "AND" ? "OR" : "AND"
    syncToggleAppearance()
    refresh()
  }
  modeToggle.addEventListener("click", onToggleClick)
  window.addCleanup(() => modeToggle.removeEventListener("click", onToggleClick))

  async function refresh(): Promise<void> {
    const hasInput =
      currentQuery.trim().length > 0 || tagInclude.size > 0 || tagExclude.size > 0

    if (!hasInput) {
      removeAllChildren(resultsPanel)
      resultsPanel.classList.remove("active")
      return
    }

    const docs = await runSearch(currentQuery)
    resultsPanel.classList.add("active")
    renderResults(docs, currentQuery, currentSlug, resultsPanel)
  }

  // Input handler
  const onInput = (e: Event): void => {
    currentQuery = (e.target as HTMLInputElement).value
    refresh()
  }
  bar.addEventListener("input", onInput)
  window.addCleanup(() => bar.removeEventListener("input", onInput))

  // Tag browser (now also receives the tag mode toggle)
  setupTagBrowser(tagListEl, filterBarEl, tagModeToggle, refresh)

  // Keyboard shortcut: Ctrl/⌘+K → focus search bar
  const onKeydown = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k" && !e.shiftKey) {
      e.preventDefault()
      bar.focus()
      bar.select()
    }
    if (e.key === "Escape") {
      resultsPanel.classList.remove("active")
      bar.blur()
    }
  }
  document.addEventListener("keydown", onKeydown)
  window.addCleanup(() => document.removeEventListener("keydown", onKeydown))

  // Close results when clicking outside the search panel
  const onOutsideClick = (e: MouseEvent): void => {
    if (!searchEl.contains(e.target as Node)) {
      resultsPanel.classList.remove("active")
    }
  }
  document.addEventListener("click", onOutsideClick)
  window.addCleanup(() => document.removeEventListener("click", onOutsideClick))
}

// ---------------------------------------------------------------------------
// Quartz SPA nav hook
// ---------------------------------------------------------------------------

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  const data = await fetchData
  for (const el of document.getElementsByClassName("search")) {
    await setupSearch(el, currentSlug, data as ContentIndex)
  }
})
