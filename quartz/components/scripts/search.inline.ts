import MiniSearch from "minisearch"
import { miniSearchOptions } from "../../util/search"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, normalizeRelativeURLs, resolveRelative } from "../../util/path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Item {
  id: number
  slug: FullSlug
  title: string
  content: string
  tags: string[]
  [key: string]: any
}

type SearchType = "basic" | "tags"
let searchType: SearchType = "basic"
let currentSearchTerm: string = ""

// ---------------------------------------------------------------------------
// Load pre-built MiniSearch index
// ---------------------------------------------------------------------------

let miniSearch: MiniSearch | null = null
let idToSlug: FullSlug[] = [] // maps MiniSearch doc id → slug

async function loadSearchIndex(): Promise<void> {
  if (miniSearch) return

  // Load the pre-built search index (generated at build time)
  const basePath = document.querySelector<HTMLScriptElement>(
    "script[src*='postscript']",
  )?.src.replace(/postscript\.js.*/, "") ?? "./"

  const indexUrl = `${basePath}static/searchIndex.json`
  const json = await fetch(indexUrl).then((r) => r.text())

  miniSearch = MiniSearch.loadJSON(json, {
    ...miniSearchOptions,
    // extractField is not needed at load time — stored fields are already extracted
  })
}

// ---------------------------------------------------------------------------
// Highlight helpers
// ---------------------------------------------------------------------------

const p = new DOMParser()
const fetchContentCache: Map<FullSlug, Element[]> = new Map()
const contextWindowWords = 30
const numSearchResults = 12
const numTagResults = 5

const tokenizeTerm = (term: string) => {
  const tokens = term.split(/\s+/).filter((t) => t.trim() !== "")
  const tokenLen = tokens.length
  if (tokenLen > 1) {
    for (let i = 1; i < tokenLen; i++) {
      tokens.push(tokens.slice(0, i + 1).join(" "))
    }
  }
  return tokens.sort((a, b) => b.length - a.length)
}

function highlight(searchTerm: string, text: string, trim?: boolean) {
  const tokenizedTerms = tokenizeTerm(searchTerm)
  let tokenizedText = text.split(/\s+/).filter((t) => t !== "")

  let startIndex = 0
  let endIndex = tokenizedText.length - 1
  if (trim) {
    const includesCheck = (tok: string) =>
      tokenizedTerms.some((term) => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        return new RegExp(`\\b${escaped}\\b`, "i").test(tok)
      })
    const occurrencesIndices = tokenizedText.map(includesCheck)

    let bestSum = 0
    let bestIndex = 0
    for (let i = 0; i < Math.max(tokenizedText.length - contextWindowWords, 0); i++) {
      const window = occurrencesIndices.slice(i, i + contextWindowWords)
      const windowSum = window.reduce((total, cur) => total + (cur ? 1 : 0), 0)
      if (windowSum >= bestSum) {
        bestSum = windowSum
        bestIndex = i
      }
    }

    startIndex = Math.max(bestIndex - contextWindowWords, 0)
    endIndex = Math.min(startIndex + 2 * contextWindowWords, tokenizedText.length - 1)
    tokenizedText = tokenizedText.slice(startIndex, endIndex)
  }

  const slice = tokenizedText
    .map((tok) => {
      for (const searchTok of tokenizedTerms) {
        // Word-boundary match: only highlight whole-word occurrences
        const escaped = searchTok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const wbRegex = new RegExp(`\\b(${escaped})\\b`, "gi")
        if (wbRegex.test(tok)) {
          return tok.replace(new RegExp(`\\b(${escaped})\\b`, "gi"), `<span class="highlight">$1</span>`)
        }
      }
      return tok
    })
    .join(" ")

  return `${startIndex === 0 ? "" : "..."}${slice}${
    endIndex === tokenizedText.length - 1 ? "" : "..."
  }`
}

function highlightHTML(searchTerm: string, el: HTMLElement) {
  const parser = new DOMParser()
  const tokenizedTerms = tokenizeTerm(searchTerm)
  const html = parser.parseFromString(el.innerHTML, "text/html")

  const createHighlightSpan = (text: string) => {
    const span = document.createElement("span")
    span.className = "highlight"
    span.textContent = text
    return span
  }

  const highlightTextNodes = (node: Node, term: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.nodeValue ?? ""
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(`\\b${escaped}\\b`, "gi")
      const matches = nodeText.match(regex)
      if (!matches || matches.length === 0) return
      const spanContainer = document.createElement("span")
      let lastIndex = 0
      for (const match of matches) {
        const matchIndex = nodeText.indexOf(match, lastIndex)
        spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex, matchIndex)))
        spanContainer.appendChild(createHighlightSpan(match))
        lastIndex = matchIndex + match.length
      }
      spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex)))
      node.parentNode?.replaceChild(spanContainer, node)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).classList.contains("highlight")) return
      Array.from(node.childNodes).forEach((child) => highlightTextNodes(child, term))
    }
  }

  for (const term of tokenizedTerms) {
    highlightTextNodes(html.body, term)
  }

  return html.body
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

async function setupSearch(searchElement: Element, currentSlug: FullSlug, data: ContentIndex) {
  await loadSearchIndex()

  // Build id→slug map from contentIndex data (same order as build-time)
  idToSlug = Object.keys(data) as FullSlug[]

  const container = searchElement.querySelector(".search-container") as HTMLElement
  if (!container) return

  const sidebar = container.closest(".sidebar") as HTMLElement | null

  const searchButton = searchElement.querySelector(".search-button") as HTMLButtonElement
  if (!searchButton) return

  const searchBar = searchElement.querySelector(".search-bar") as HTMLInputElement
  if (!searchBar) return

  const searchLayout = searchElement.querySelector(".search-layout") as HTMLElement
  if (!searchLayout) return

  const appendLayout = (el: HTMLElement) => {
    searchLayout.appendChild(el)
  }

  const enablePreview = searchLayout.dataset.preview === "true"
  let preview: HTMLDivElement | undefined = undefined
  let previewInner: HTMLDivElement | undefined = undefined
  const results = document.createElement("div")
  results.className = "results-container"
  appendLayout(results)

  if (enablePreview) {
    preview = document.createElement("div")
    preview.className = "preview-container"
    appendLayout(preview)
  }

  function hideSearch() {
    container.classList.remove("active")
    searchBar.value = ""
    if (sidebar) sidebar.style.zIndex = ""
    removeAllChildren(results)
    if (preview) {
      removeAllChildren(preview)
    }
    searchLayout.classList.remove("display-results")
    searchType = "basic"
    searchButton.focus()
  }

  function showSearch(searchTypeNew: SearchType) {
    searchType = searchTypeNew
    if (sidebar) sidebar.style.zIndex = "1"
    container.classList.add("active")
    searchBar.focus()
  }

  let currentHover: HTMLInputElement | null = null
  async function shortcutHandler(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "k" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const searchBarOpen = container.classList.contains("active")
      searchBarOpen ? hideSearch() : showSearch("basic")
      return
    } else if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault()
      const searchBarOpen = container.classList.contains("active")
      searchBarOpen ? hideSearch() : showSearch("tags")
      searchBar.value = "#"
      return
    }

    if (currentHover) {
      currentHover.classList.remove("focus")
    }

    if (!container.classList.contains("active")) return
    if (e.key === "Enter" && !e.isComposing) {
      if (results.contains(document.activeElement)) {
        const active = document.activeElement as HTMLInputElement
        if (active.classList.contains("no-match")) return
        await displayPreview(active)
        active.click()
      } else {
        const anchor = document.getElementsByClassName("result-card")[0] as HTMLInputElement | null
        if (!anchor || anchor.classList.contains("no-match")) return
        await displayPreview(anchor)
        anchor.click()
      }
    } else if (e.key === "ArrowUp" || (e.shiftKey && e.key === "Tab")) {
      e.preventDefault()
      if (results.contains(document.activeElement)) {
        const currentResult = currentHover
          ? currentHover
          : (document.activeElement as HTMLInputElement | null)
        const prevResult = currentResult?.previousElementSibling as HTMLInputElement | null
        currentResult?.classList.remove("focus")
        prevResult?.focus()
        if (prevResult) currentHover = prevResult
        await displayPreview(prevResult)
      }
    } else if (e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault()
      if (document.activeElement === searchBar || currentHover !== null) {
        const firstResult = currentHover
          ? currentHover
          : (document.getElementsByClassName("result-card")[0] as HTMLInputElement | null)
        const secondResult = firstResult?.nextElementSibling as HTMLInputElement | null
        firstResult?.classList.remove("focus")
        secondResult?.focus()
        if (secondResult) currentHover = secondResult
        await displayPreview(secondResult)
      }
    }
  }

  const formatForDisplay = (term: string, id: number) => {
    const slug = idToSlug[id]
    return {
      id,
      slug,
      title: searchType === "tags" ? data[slug].title : highlight(term, data[slug].title ?? ""),
      content: highlight(term, data[slug].content ?? "", true),
      tags: highlightTags(term.substring(1), data[slug].tags),
    }
  }

  function highlightTags(term: string, tags: string[]) {
    if (!tags || searchType !== "tags") {
      return []
    }

    return tags
      .map((tag) => {
        if (tag.toLowerCase().includes(term.toLowerCase())) {
          return `<li><p class="match-tag">#${tag}</p></li>`
        } else {
          return `<li><p>#${tag}</p></li>`
        }
      })
      .slice(0, numTagResults)
  }

  function resolveUrl(slug: FullSlug): URL {
    return new URL(resolveRelative(currentSlug, slug), location.toString())
  }

  const resultToHTML = ({ slug, title, content, tags }: Item) => {
    const htmlTags = tags.length > 0 ? `<ul class="tags">${tags.join("")}</ul>` : ``
    const itemTile = document.createElement("a")
    itemTile.classList.add("result-card")
    itemTile.id = slug

    // Append ?search=term so the target page can scroll to the match
    const baseUrl = resolveUrl(slug).toString()
    const searchParam = currentSearchTerm.trim()
    itemTile.href = searchParam
      ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}search=${encodeURIComponent(searchParam)}`
      : baseUrl

    itemTile.innerHTML = `
      <h3 class="card-title">${title}</h3>
      ${htmlTags}
      <p class="card-description">${content}</p>
    `
    itemTile.addEventListener("click", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      hideSearch()
    })

    const handler = (event: MouseEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      hideSearch()
    }

    async function onMouseEnter(ev: MouseEvent) {
      if (!ev.target) return
      const target = ev.target as HTMLInputElement
      await displayPreview(target)
    }

    itemTile.addEventListener("mouseenter", onMouseEnter)
    window.addCleanup(() => itemTile.removeEventListener("mouseenter", onMouseEnter))
    itemTile.addEventListener("click", handler)
    window.addCleanup(() => itemTile.removeEventListener("click", handler))

    return itemTile
  }

  async function displayResults(finalResults: Item[]) {
    removeAllChildren(results)
    if (finalResults.length === 0) {
      results.innerHTML = `<a class="result-card no-match">
          <h3>No results.</h3>
          <p>Try another search term?</p>
      </a>`
    } else {
      results.append(...finalResults.map(resultToHTML))
    }

    if (finalResults.length === 0 && preview) {
      removeAllChildren(preview)
    } else {
      const firstChild = results.firstElementChild as HTMLElement
      firstChild.classList.add("focus")
      currentHover = firstChild as HTMLInputElement
      await displayPreview(firstChild)
    }
  }

  async function fetchContent(slug: FullSlug): Promise<Element[]> {
    if (fetchContentCache.has(slug)) {
      return fetchContentCache.get(slug) as Element[]
    }

    const targetUrl = resolveUrl(slug).toString()
    const contents = await fetch(targetUrl)
      .then((res) => res.text())
      .then((contents) => {
        if (contents === undefined) {
          throw new Error(`Could not fetch ${targetUrl}`)
        }
        const html = p.parseFromString(contents ?? "", "text/html")
        normalizeRelativeURLs(html, targetUrl)
        return [...html.getElementsByClassName("popover-hint")]
      })

    fetchContentCache.set(slug, contents)
    return contents
  }

  async function displayPreview(el: HTMLElement | null) {
    if (!searchLayout || !enablePreview || !el || !preview) return
    const slug = el.id as FullSlug
    const innerDiv = await fetchContent(slug).then((contents) =>
      contents.flatMap((el) => [...highlightHTML(currentSearchTerm, el as HTMLElement).children]),
    )
    previewInner = document.createElement("div")
    previewInner.classList.add("preview-inner")
    previewInner.append(...innerDiv)
    preview.replaceChildren(previewInner)

    // scroll to longest highlight
    const highlights = [...preview.getElementsByClassName("highlight")].sort(
      (a, b) => b.innerHTML.length - a.innerHTML.length,
    )
    highlights[0]?.scrollIntoView({ block: "start" })
  }

  // ── Main search handler ─────────────────────────────────────

  async function onType(e: HTMLElementEventMap["input"]) {
    if (!searchLayout || !miniSearch) return
    currentSearchTerm = (e.target as HTMLInputElement).value
    searchLayout.classList.toggle("display-results", currentSearchTerm !== "")
    searchType = currentSearchTerm.startsWith("#") ? "tags" : "basic"

    let searchResults: Array<{ id: number }>

    if (searchType === "tags") {
      currentSearchTerm = currentSearchTerm.substring(1).trim()
      const separatorIndex = currentSearchTerm.indexOf(" ")
      if (separatorIndex !== -1) {
        // Tag + text: "#python datetime" → filter by tag, search text
        const tagFilter = currentSearchTerm.substring(0, separatorIndex).toLowerCase()
        const query = currentSearchTerm.substring(separatorIndex + 1).trim()
        searchResults = miniSearch
          .search(query, {
            combineWith: "AND",
            boost: { title: 3, tags: 2 },
            filter: (result) => {
              const docTags: string[] = result.tags ?? []
              return docTags.some((t: string) => t.toLowerCase() === tagFilter)
            },
          })
          .slice(0, numSearchResults)
        searchType = "basic"
        currentSearchTerm = query
      } else {
        // Pure tag search — prefix allowed here (typing "pyt" should match "python" tag)
        searchResults = miniSearch
          .search(currentSearchTerm, {
            fields: ["tags"],
            prefix: true,
          })
          .slice(0, numSearchResults)
      }
    } else {
      // Basic text search — exact word matching (no prefix, no fuzzy)
      const terms = currentSearchTerm
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0)
        .map((t) => t.toLowerCase())

      if (terms.length === 0) {
        searchResults = []
      } else if (terms.length === 1) {
        // Single term — exact match only
        searchResults = miniSearch
          .search(currentSearchTerm, {
            boost: { title: 3, tags: 2 },
          })
          .slice(0, numSearchResults)
      } else {
        // Multi-term: exact AND results from MiniSearch, then proximity-filter
        const broadResults = miniSearch.search(currentSearchTerm, {
          combineWith: "AND",
          boost: { title: 3, tags: 2 },
        })

        // Proximity filter: all terms must co-occur in the same paragraph
        searchResults = broadResults
          .filter((r) => {
            const slug = idToSlug[r.id]
            const doc = data[slug]
            if (!doc) return false

            // Word-boundary check helper
            const hasWord = (text: string, word: string): boolean => {
              const re = new RegExp(`(?:^|[\\s.,;:!?()\\[\\]{}"'\`/\\-_])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[\\s.,;:!?()\\[\\]{}"'\`/\\-_])`)
              return re.test(text)
            }

            // Check title first — if all terms are in the title, it's a strong match
            const titleLower = (doc.title ?? "").toLowerCase()
            if (terms.every((t) => hasWord(titleLower, t))) return true

            // Split content into paragraphs (double newline) and check co-occurrence
            const paragraphs = (doc.content ?? "")
              .split(/\n{2,}/)
              .map((p) => p.toLowerCase())

            return paragraphs.some((para) => terms.every((t) => hasWord(para, t)))
          })
          .slice(0, numSearchResults)

        // Fallback: if proximity filter eliminated everything, show page-level AND
        if (searchResults.length === 0) {
          searchResults = broadResults.slice(0, numSearchResults)
        }
      }
    }

    const finalResults = searchResults.map((r) => formatForDisplay(currentSearchTerm, r.id))
    await displayResults(finalResults)
  }

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => document.removeEventListener("keydown", shortcutHandler))
  searchButton.addEventListener("click", () => showSearch("basic"))
  window.addCleanup(() => searchButton.removeEventListener("click", () => showSearch("basic")))
  searchBar.addEventListener("input", onType)
  window.addCleanup(() => searchBar.removeEventListener("input", onType))

  registerEscapeHandler(container, hideSearch)
}

// ---------------------------------------------------------------------------
// Nav hook
// ---------------------------------------------------------------------------

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  const data = await fetchData
  const searchElement = document.getElementsByClassName("search")
  for (const element of searchElement) {
    await setupSearch(element, currentSlug, data)
  }

  // Scroll to search term if arriving from a search result click
  const url = new URL(window.location.href)
  const searchParam = url.searchParams.get("search")
  if (searchParam) {
    // Clean the URL (remove ?search= without triggering navigation)
    url.searchParams.delete("search")
    history.replaceState({}, "", url.toString())

    // Wait for page to render, then find and scroll to the first text match
    requestAnimationFrame(() => {
      const terms = searchParam.toLowerCase().split(/\s+/).filter((t) => t.length > 0)
      if (terms.length === 0) return

      // Walk all text nodes in the article body to find the first occurrence
      const article = document.querySelector(".center") ?? document.body
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT)
      let targetNode: Text | null = null
      let bestNode: Text | null = null
      let bestCount = 0

      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const text = node.textContent?.toLowerCase() ?? ""
        // Count how many search terms appear in this text node
        const count = terms.filter((t) => {
          const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          return new RegExp(`\\b${escaped}\\b`).test(text)
        }).length
        if (count > bestCount) {
          bestCount = count
          bestNode = node
        }
        if (count === terms.length) {
          targetNode = node
          break
        }
      }

      const scrollTarget = targetNode ?? bestNode
      if (scrollTarget?.parentElement) {
        scrollTarget.parentElement.scrollIntoView({ behavior: "smooth", block: "center" })
        // Briefly highlight the element
        const el = scrollTarget.parentElement
        el.style.outline = "2px solid var(--secondary)"
        el.style.outlineOffset = "4px"
        el.style.borderRadius = "4px"
        setTimeout(() => {
          el.style.outline = ""
          el.style.outlineOffset = ""
          el.style.borderRadius = ""
        }, 3000)
      }
    })
  }
})
