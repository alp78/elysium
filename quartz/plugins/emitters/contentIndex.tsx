import { Root, Element, Text } from "hast"
import { GlobalConfiguration } from "../../cfg"
import { getDate } from "../../components/Date"
import { escapeHTML } from "../../util/escape"
import { FilePath, FullSlug, SimpleSlug, joinSegments, simplifySlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { toHtml } from "hast-util-to-html"
import { write } from "./helpers"
import { i18n } from "../../i18n"
import MiniSearch from "minisearch"
import { miniSearchOptions } from "../../util/search"

export type ContentIndexMap = Map<FullSlug, ContentDetails>
export type ContentDetails = {
  slug: FullSlug
  filePath: FilePath
  title: string
  links: SimpleSlug[]
  tags: string[]
  content: string
  richContent?: string
  date?: Date
  description?: string
}

// ---------------------------------------------------------------------------
// Section extraction from HAST tree
// ---------------------------------------------------------------------------

interface Section {
  /** The heading text for this section (empty string for the intro before any heading) */
  heading: string
  /** The heading's id attribute (used as anchor) */
  anchor: string
  /** Depth: 1=h1, 2=h2, ... 6=h6.  0 = intro (before first heading) */
  depth: number
  /** Plain text content of this section (between this heading and the next) */
  text: string
  /** Breadcrumb of ancestor heading texts */
  titles: string[]
}

/** Extract plain text from a HAST node tree */
function getText(node: any): string {
  if (node.type === "text") return (node as Text).value
  if (node.children) return node.children.map(getText).join("")
  return ""
}

/** Get the heading depth from a tag name, or 0 if not an indexed heading.
 *  Only h3 and h4 are indexed for search — h1/h2 are page-level structure,
 *  h5/h6 are too granular. */
function headingDepth(tagName: string): number {
  if (tagName === "h3") return 3
  if (tagName === "h4") return 4
  return 0
}

/**
 * Walk the HAST tree and split into sections at heading boundaries.
 * Every h1–h6 starts a new section. Text between headings becomes the
 * section body. The breadcrumb (`titles`) tracks ancestor headings.
 */
function extractSections(tree: Root): Section[] {
  const sections: Section[] = []

  // Heading stack for breadcrumb: [{depth, text}]
  const headingStack: Array<{ depth: number; text: string }> = []

  // Current section being accumulated
  let currentSection: Section = {
    heading: "",
    anchor: "",
    depth: 0,
    text: "",
    titles: [],
  }

  function flushSection() {
    const trimmed = currentSection.text.trim()
    // Only emit sections that have some text or a heading
    if (trimmed.length > 0 || currentSection.heading) {
      sections.push({ ...currentSection, text: trimmed })
    }
  }

  function walkNode(node: any) {
    if (node.type === "element") {
      const el = node as Element
      const depth = headingDepth(el.tagName)

      // h1/h2: not indexed, but update the breadcrumb stack for context
      const rawMatch = /^h([1-6])$/.exec(el.tagName)
      if (rawMatch && depth === 0) {
        const rawDepth = parseInt(rawMatch[1], 10)
        const headingText = getText(el).trim()
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].depth >= rawDepth) {
          headingStack.pop()
        }
        headingStack.push({ depth: rawDepth, text: headingText })
        return // don't recurse into heading children
      }

      if (depth > 0) {
        // ── h3/h4 heading — flush current section and start new one ──
        flushSection()

        const headingText = getText(el).trim()
        const anchor = (el.properties?.id as string) ?? ""

        // Update heading stack: pop everything at this depth or deeper
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].depth >= depth) {
          headingStack.pop()
        }

        // Build breadcrumb from remaining stack (includes h1/h2 ancestors)
        const titles = headingStack.map((h) => h.text)

        // Push this heading onto the stack
        headingStack.push({ depth, text: headingText })

        // Start new section
        currentSection = {
          heading: headingText,
          anchor,
          depth,
          text: "",
          titles,
        }
        return // Don't recurse into heading children (we already extracted the text)
      }
    }

    // For text nodes, accumulate text
    if (node.type === "text") {
      currentSection.text += (node as Text).value
    }

    // Recurse into children
    if (node.children) {
      for (const child of node.children) {
        walkNode(child)
      }
    }
  }

  walkNode(tree)
  flushSection() // flush the last section

  return sections
}

// ---------------------------------------------------------------------------
// Options & helpers
// ---------------------------------------------------------------------------

interface Options {
  enableSiteMap: boolean
  enableRSS: boolean
  rssLimit?: number
  rssFullHtml: boolean
  rssSlug: string
  includeEmptyFiles: boolean
}

const defaultOptions: Options = {
  enableSiteMap: true,
  enableRSS: true,
  rssLimit: 10,
  rssFullHtml: false,
  rssSlug: "index",
  includeEmptyFiles: true,
}

function generateSiteMap(cfg: GlobalConfiguration, idx: ContentIndexMap): string {
  const base = cfg.baseUrl ?? ""
  const createURLEntry = (slug: SimpleSlug, content: ContentDetails): string => `<url>
    <loc>https://${joinSegments(base, encodeURI(slug))}</loc>
    ${content.date && `<lastmod>${content.date.toISOString()}</lastmod>`}
  </url>`
  const urls = Array.from(idx)
    .map(([slug, content]) => createURLEntry(simplifySlug(slug), content))
    .join("")
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`
}

function generateRSSFeed(cfg: GlobalConfiguration, idx: ContentIndexMap, limit?: number): string {
  const base = cfg.baseUrl ?? ""

  const createURLEntry = (slug: SimpleSlug, content: ContentDetails): string => `<item>
    <title>${escapeHTML(content.title)}</title>
    <link>https://${joinSegments(base, encodeURI(slug))}</link>
    <guid>https://${joinSegments(base, encodeURI(slug))}</guid>
    <description><![CDATA[ ${content.richContent ?? content.description} ]]></description>
    <pubDate>${content.date?.toUTCString()}</pubDate>
  </item>`

  const items = Array.from(idx)
    .sort(([_, f1], [__, f2]) => {
      if (f1.date && f2.date) {
        return f2.date.getTime() - f1.date.getTime()
      } else if (f1.date && !f2.date) {
        return -1
      } else if (!f1.date && f2.date) {
        return 1
      }

      return f1.title.localeCompare(f2.title)
    })
    .map(([slug, content]) => createURLEntry(simplifySlug(slug), content))
    .slice(0, limit ?? idx.size)
    .join("")

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
    <channel>
      <title>${escapeHTML(cfg.pageTitle)}</title>
      <link>https://${base}</link>
      <description>${!!limit ? i18n(cfg.locale).pages.rss.lastFewNotes({ count: limit }) : i18n(cfg.locale).pages.rss.recentNotes} on ${escapeHTML(
        cfg.pageTitle,
      )}</description>
      <generator>Quartz -- quartz.jzhao.xyz</generator>
      ${items}
    </channel>
  </rss>`
}

// ---------------------------------------------------------------------------
// Emitter plugin
// ---------------------------------------------------------------------------

export const ContentIndex: QuartzEmitterPlugin<Partial<Options>> = (opts) => {
  opts = { ...defaultOptions, ...opts }
  return {
    name: "ContentIndex",
    async *emit(ctx, content) {
      const cfg = ctx.cfg.configuration
      const linkIndex: ContentIndexMap = new Map()
      for (const [tree, file] of content) {
        const slug = file.data.slug!
        const date = getDate(ctx.cfg.configuration, file.data) ?? new Date()
        if (opts?.includeEmptyFiles || (file.data.text && file.data.text !== "")) {
          linkIndex.set(slug, {
            slug,
            filePath: file.data.relativePath!,
            title: file.data.frontmatter?.title!,
            links: file.data.links ?? [],
            tags: file.data.frontmatter?.tags ?? [],
            content: file.data.text ?? "",
            richContent: opts?.rssFullHtml
              ? escapeHTML(toHtml(tree as Root, { allowDangerousHtml: true }))
              : undefined,
            date: date,
            description: file.data.description ?? "",
          })
        }
      }

      if (opts?.enableSiteMap) {
        yield write({
          ctx,
          content: generateSiteMap(cfg, linkIndex),
          slug: "sitemap" as FullSlug,
          ext: ".xml",
        })
      }

      if (opts?.enableRSS) {
        yield write({
          ctx,
          content: generateRSSFeed(cfg, linkIndex, opts.rssLimit),
          slug: (opts?.rssSlug ?? "index") as FullSlug,
          ext: ".xml",
        })
      }

      // ── Content index (used by graph, explorer, etc.) ──
      const fp = joinSegments("static", "contentIndex") as FullSlug
      const simplifiedIndex = Object.fromEntries(
        Array.from(linkIndex).map(([slug, content]) => {
          delete content.description
          delete content.date
          return [slug, content]
        }),
      )

      yield write({
        ctx,
        content: JSON.stringify(simplifiedIndex),
        slug: fp,
        ext: ".json",
      })

      // ── Pre-built MiniSearch index — section-level ─────────────
      // Search is restricted to headings and tags only.
      // Each page is split at heading boundaries (h1–h6). Each section
      // becomes one MiniSearch document with:
      //   title:     section heading text (boosted 4×)
      //   titles:    ancestor heading breadcrumb (boosted 1×)
      //   tags:      page-level tags
      //   slug:      "page-slug#anchor" for direct linking
      //   pageTitle: page title for display

      const ms = new MiniSearch({
        ...miniSearchOptions,
      })

      let docId = 0
      for (const [tree, file] of content) {
        const slug = file.data.slug!
        const pageTitle = file.data.frontmatter?.title ?? slug
        const tags = (file.data.frontmatter?.tags ?? []).join(" ")
        const sections = extractSections(tree as Root)

        for (const section of sections) {
          const sectionSlug = section.anchor
            ? `${slug}#${section.anchor}`
            : slug

          const titlesWithPage = [pageTitle, ...section.titles].filter(Boolean).join(" > ")

          ms.add({
            id: docId++,
            slug: sectionSlug,
            pageTitle,
            title: section.heading || pageTitle,
            titles: titlesWithPage,
            tags,
          })
        }
      }

      const searchFp = joinSegments("static", "searchIndex") as FullSlug
      yield write({
        ctx,
        content: JSON.stringify(ms),
        slug: searchFp,
        ext: ".json",
      })
    },
    externalResources: (ctx) => {
      if (opts?.enableRSS) {
        return {
          additionalHead: [
            <link
              rel="alternate"
              type="application/rss+xml"
              title="RSS Feed"
              href={`https://${ctx.cfg.configuration.baseUrl}/index.xml`}
            />,
          ],
        }
      }
    },
  }
}
