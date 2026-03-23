import { ContentDetails, HeadingIndex } from "../../plugins/emitters/contentIndex"
import { removeAllChildren } from "./util"
import { FullSlug, resolveRelative } from "../../util/path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchDoc {
  slug: FullSlug
  title: string
  content: string
  contentLower: string
  titleLower: string
  tags: string[]
  blocks: string[]
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
// State
// ---------------------------------------------------------------------------

let allDocs: SearchDoc[] = []
let built = false

const tagInclude = new Set<string>()
const tagExclude = new Set<string>()

let searchMode: "AND" | "OR" = "AND"
let tagMode: "AND" | "OR" = "AND"

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function buildDocs(data: ContentIndex): void {
  if (built) return
  built = true
  allDocs = []
  for (const [slug, d] of Object.entries<ContentDetails>(data)) {
    const content = d.content ?? ""
    const title = d.title ?? slug
    allDocs.push({
      slug: slug as FullSlug,
      title,
      content,
      contentLower: content.toLowerCase(),
      titleLower: title.toLowerCase(),
      tags: d.tags ?? [],
      blocks: content
        .split(/\n{2,}/)
        .map((b) => b.replace(/\s+/g, " ").trim().toLowerCase())
        .filter((b) => b.length > 15),
      headings: d.headings ?? [],
    })
  }
}

// ---------------------------------------------------------------------------
// Query parser
// ---------------------------------------------------------------------------

function parseQuery(raw: string): ParsedQuery {
  const result: ParsedQuery = {
    terms: [],
    excludeTerms: [],
    operator: searchMode,
    tagFilters: [],
    phraseFilters: [],
    pathFilter: null,
  }

  let text = raw.trim()
  if (!text) return result

  if (/\bOR\b/.test(text)) {
    result.operator = "OR"
    text = text.replace(/\bOR\b/g, " ")
  } else if (/\bAND\b/.test(text)) {
    result.operator = "AND"
    text = text.replace(/\bAND\b/g, " ")
  }

  text = text.replace(/"([^"]+)"/g, (_, p: string) => {
    result.phraseFilters.push(p.toLowerCase())
    return ""
  })

  text = text.replace(/(?:tag:)?#(\S+)/g, (_, t: string) => {
    result.tagFilters.push(t.toLowerCase())
    return ""
  })

  text = text.replace(/path:(\S+)/g, (_, p: string) => {
    result.pathFilter = p.toLowerCase()
    return ""
  })

  text = text.replace(/-(\S+)/g, (_, t: string) => {
    result.excludeTerms.push(t.toLowerCase())
    return ""
  })

  result.terms = text
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0)

  return result
}

// ---------------------------------------------------------------------------
// Search — plain brute force, no library
// ---------------------------------------------------------------------------

function docHasTerm(d: SearchDoc, t: string): boolean {
  return d.titleLower.includes(t) || d.contentLower.includes(t)
}

function runSearch(query: string): SearchDoc[] {
  const parsed = parseQuery(query)

  const allTagInc = new Set([...tagInclude, ...parsed.tagFilters])
  const allTagExc = new Set([...tagExclude])
  const hasText = parsed.terms.length > 0 || parsed.phraseFilters.length > 0

  // Start from ALL docs
  let docs = allDocs

  // ── Text filter ──────────────────────────────────────────
  if (hasText) {
    if (parsed.operator === "AND") {
      if (parsed.terms.length >= 2) {
        // ALL terms must appear in the SAME block (paragraph).
        // This is the core AND behaviour — same-block proximity.
        docs = docs.filter((d) =>
          d.blocks.some((b) => parsed.terms.every((t) => b.includes(t))),
        )
      } else if (parsed.terms.length === 1) {
        // Single term: just check it exists anywhere
        docs = docs.filter((d) => docHasTerm(d, parsed.terms[0]))
      }
    } else {
      // OR: at least one term must be present anywhere in the doc
      if (parsed.terms.length > 0) {
        docs = docs.filter((d) => parsed.terms.some((t) => docHasTerm(d, t)))
      }
    }
  } else if (allTagInc.size === 0 && allTagExc.size === 0) {
    return []
  }

  // ── Phrase filter ────────────────────────────────────────
  for (const phrase of parsed.phraseFilters) {
    docs = docs.filter((d) => d.contentLower.includes(phrase) || d.titleLower.includes(phrase))
  }

  // ── Tag include ──────────────────────────────────────────
  if (allTagInc.size > 0) {
    const tags = [...allTagInc]
    if (tagMode === "AND") {
      docs = docs.filter((d) => tags.every((t) => d.tags.some((dt) => dt.toLowerCase().includes(t))))
    } else {
      docs = docs.filter((d) => tags.some((t) => d.tags.some((dt) => dt.toLowerCase().includes(t))))
    }
  }

  // ── Tag exclude ──────────────────────────────────────────
  if (allTagExc.size > 0) {
    const tags = [...allTagExc]
    docs = docs.filter((d) => !tags.some((t) => d.tags.some((dt) => dt.toLowerCase().includes(t))))
  }

  // ── Path filter ──────────────────────────────────────────
  if (parsed.pathFilter) {
    const pf = parsed.pathFilter
    docs = docs.filter((d) => d.slug.toLowerCase().includes(pf))
  }

  // ── NOT terms ────────────────────────────────────────────
  for (const t of parsed.excludeTerms) {
    docs = docs.filter((d) => !docHasTerm(d, t))
  }

  // ── Sort by relevance ────────────────────────────────────
  if (hasText) {
    const allTerms = [...parsed.terms, ...parsed.phraseFilters]
    docs.sort((a, b) => {
      let sa = 0
      let sb = 0
      for (const t of allTerms) {
        if (a.titleLower.includes(t)) sa += 50
        if (b.titleLower.includes(t)) sb += 50
        // count content hits (cap at 5)
        let ia = 0, ca = 0
        while (ca < 5 && (ia = a.contentLower.indexOf(t, ia)) !== -1) { ca++; ia += t.length }
        let ib = 0, cb = 0
        while (cb < 5 && (ib = b.contentLower.indexOf(t, ib)) !== -1) { cb++; ib += t.length }
        sa += ca
        sb += cb
      }
      return sb - sa
    })
  }

  return docs.slice(0, 50)
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlight(text: string, terms: string[]): string {
  let r = escHtml(text)
  for (const t of terms.filter((t) => t.length > 1)) {
    r = r.replace(new RegExp(`(${escRe(escHtml(t))})`, "gi"), "<mark>$1</mark>")
  }
  return r
}

function getSnippet(doc: SearchDoc, terms: string[], maxLen = 150): string {
  if (terms.length === 0) return escHtml(doc.content.slice(0, maxLen))

  let best = doc.blocks[0] ?? doc.content.slice(0, 400)
  let bestScore = 0
  for (const b of doc.blocks) {
    const score = terms.reduce((s, t) => s + (b.includes(t) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; best = b }
  }

  let start = 0
  for (const t of terms) {
    const i = best.indexOf(t)
    if (i !== -1) { start = Math.max(0, i - 40); break }
  }

  const prefix = start > 0 ? "…" : ""
  let snippet = prefix + best.slice(start, start + maxLen)
  if (best.length > start + maxLen) snippet += "…"
  return highlight(snippet, terms)
}

function slugToFolder(slug: FullSlug): string {
  const parts = slug.split("/")
  if (parts.length === 1) return "Notes"
  return parts[0].replace(/^\d+-/, "").replace(/-/g, " ")
}

function findAnchor(doc: SearchDoc, terms: string[]): string {
  if (terms.length === 0 || doc.headings.length === 0) return ""

  let bestBlockIdx = 0
  let bestScore = 0
  for (let i = 0; i < doc.blocks.length; i++) {
    const score = terms.reduce((s, t) => s + (doc.blocks[i].includes(t) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; bestBlockIdx = i }
  }
  if (bestScore === 0) return ""

  const blockSnippet = doc.blocks[bestBlockIdx].slice(0, 60)
  const contentNorm = doc.contentLower.replace(/\s+/g, " ")
  const blockOffset = contentNorm.indexOf(blockSnippet)
  if (blockOffset === -1) return ""

  let bestHeading: HeadingIndex | null = null
  for (const h of doc.headings) {
    const hText = h.text.toLowerCase().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const hPos = contentNorm.indexOf(hText)
    if (hPos !== -1 && hPos <= blockOffset) bestHeading = h
  }

  return bestHeading ? `#${bestHeading.id}` : ""
}

// ---------------------------------------------------------------------------
// Render results
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
    el.textContent = query.trim() || tagInclude.size > 0 ? "No results found" : "Start typing…"
    container.appendChild(el)
    return
  }

  const parsed = parseQuery(query)
  const terms = [...parsed.terms, ...parsed.phraseFilters]
  const hasText = terms.length > 0
  const useTagGroups = !hasText && tagMode === "OR" && tagInclude.size > 1

  // Group results
  const groups = new Map<string, SearchDoc[]>()
  if (useTagGroups) {
    for (const doc of docs) {
      for (const activeTag of tagInclude) {
        if (doc.tags.some((dt) => dt.toLowerCase().includes(activeTag))) {
          const label = `#${activeTag}`
          if (!groups.has(label)) groups.set(label, [])
          const arr = groups.get(label)!
          if (!arr.some((d) => d.slug === doc.slug)) arr.push(doc)
        }
      }
    }
  } else {
    for (const doc of docs) {
      const folder = slugToFolder(doc.slug)
      if (!groups.has(folder)) groups.set(folder, [])
      groups.get(folder)!.push(doc)
    }
  }

  // Render groups
  for (const [groupName, group] of groups) {
    const groupEl = document.createElement("div")
    groupEl.className = "result-group"

    const header = document.createElement("div")
    header.className = "result-group-header"
    header.textContent = groupName
    groupEl.appendChild(header)

    for (const doc of group) {
      const anchor = hasText ? findAnchor(doc, terms) : ""
      const a = document.createElement("a")
      a.className = "result-item"
      a.href = resolveRelative(currentSlug, doc.slug) + anchor

      const snippet = getSnippet(doc, terms)
      const tagsHtml = doc.tags
        .slice(0, 5)
        .map((t) => `<span class="result-tag${tagInclude.has(t) ? " active-tag" : ""}">#${escHtml(t)}</span>`)
        .join("")

      a.innerHTML = `
        <span class="result-title">${highlight(doc.title, terms)}</span>
        ${snippet ? `<span class="result-snippet">${snippet}</span>` : ""}
        ${tagsHtml ? `<span class="result-tags">${tagsHtml}</span>` : ""}
      `
      a.addEventListener("click", () => container.classList.remove("active"))
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
  const tagStates = new Map<string, 0 | 1 | 2>()

  function sync(): void {
    tagInclude.clear()
    tagExclude.clear()
    for (const [tag, state] of tagStates) {
      if (state === 1) tagInclude.add(tag)
      else if (state === 2) tagExclude.add(tag)
    }
  }

  function renderChips(): void {
    removeAllChildren(filterBarEl)
    let any = false
    for (const [tag, state] of tagStates) {
      if (state === 0) continue
      any = true
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
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        tagStates.set(tag, 0)
        updatePill(tag, 0)
        sync(); renderChips(); onFilterChange()
      })
      chip.appendChild(btn)
      filterBarEl.appendChild(chip)
    }
    filterBarEl.classList.toggle("has-filters", any)
  }

  function updatePill(tag: string, state: 0 | 1 | 2): void {
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
    const cur = tagStates.get(tag) ?? 0
    const next = ((cur + 1) % 3) as 0 | 1 | 2
    tagStates.set(tag, next)
    updatePill(tag, next)
    sync(); renderChips(); onFilterChange()
  })

  function syncTagToggle(): void {
    tagModeToggle.dataset.mode = tagMode
    tagModeToggle.textContent = tagMode
  }
  syncTagToggle()

  tagModeToggle.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    tagMode = tagMode === "AND" ? "OR" : "AND"
    syncTagToggle()
    onFilterChange()
  })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

async function setupSearch(
  searchEl: Element,
  currentSlug: FullSlug,
  data: ContentIndex,
): Promise<void> {
  buildDocs(data)

  const bar = searchEl.querySelector<HTMLInputElement>(".search-bar")!
  const resultsPanel = searchEl.querySelector<HTMLElement>(".search-results")!
  const filterBarEl = searchEl.querySelector<HTMLElement>(".search-filter-bar")!
  const tagListEl = searchEl.querySelector<HTMLElement>(".tag-list")!
  const modeToggle = searchEl.querySelector<HTMLButtonElement>(".search-mode-toggle")!
  const tagModeToggle = searchEl.querySelector<HTMLButtonElement>(".tag-mode-toggle")!

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function syncToggle(): void {
    modeToggle.dataset.mode = searchMode
    modeToggle.textContent = searchMode
  }
  syncToggle()

  function refresh(): void {
    const query = bar.value
    const hasInput = query.trim().length > 0 || tagInclude.size > 0 || tagExclude.size > 0

    if (!hasInput) {
      removeAllChildren(resultsPanel)
      resultsPanel.classList.remove("active")
      return
    }

    const docs = runSearch(query)
    resultsPanel.classList.add("active")
    renderResults(docs, query, currentSlug, resultsPanel)
  }

  const onToggleClick = (): void => {
    searchMode = searchMode === "AND" ? "OR" : "AND"
    syncToggle()
    refresh()
  }
  modeToggle.addEventListener("click", onToggleClick)
  window.addCleanup(() => modeToggle.removeEventListener("click", onToggleClick))

  const onInput = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(refresh, 150)
  }
  bar.addEventListener("input", onInput)
  window.addCleanup(() => bar.removeEventListener("input", onInput))

  setupTagBrowser(tagListEl, filterBarEl, tagModeToggle, refresh)

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

  const onOutsideClick = (e: MouseEvent): void => {
    if (!searchEl.contains(e.target as Node)) {
      resultsPanel.classList.remove("active")
    }
  }
  document.addEventListener("click", onOutsideClick)
  window.addCleanup(() => document.removeEventListener("click", onOutsideClick))
}

// ---------------------------------------------------------------------------
// Nav hook
// ---------------------------------------------------------------------------

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  const data = await fetchData
  for (const el of document.getElementsByClassName("search")) {
    await setupSearch(el, currentSlug, data as ContentIndex)
  }
})
