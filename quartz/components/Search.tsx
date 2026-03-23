import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/search.scss"
// @ts-ignore
import script from "./scripts/search.inline"
import { classNames } from "../util/lang"

export default ((_userOpts?: Record<string, unknown>) => {
  const Search: QuartzComponent = ({ displayClass, allFiles }: QuartzComponentProps) => {
    // Collect all unique tags from all content files at build time
    const allTags = [
      ...new Set(allFiles.flatMap((f) => f.frontmatter?.tags ?? [])),
    ].sort()

    return (
      <div class={classNames(displayClass, "search")}>
        {/* ── Search input ── */}
        <div class="search-input-wrap">
          <svg
            class="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            autocomplete="off"
            class="search-bar"
            name="search"
            type="text"
            spellcheck={false}
            aria-label="Search notes"
            placeholder='Search… (use OR, "phrase", -exclude, #tag)'
          />
          <button
            class="search-mode-toggle"
            type="button"
            data-mode="AND"
            title="Toggle AND / OR mode"
            aria-label="Search mode: AND"
          >
            AND
          </button>
        </div>

        {/* ── Active filter chips (populated by JS) ── */}
        <div class="search-filter-bar" aria-live="polite"></div>

        {/* ── Results panel (shown when active) ── */}
        <div class="search-results" role="list" aria-live="polite"></div>

        {/* ── Tag browser ── */}
        <details class="tag-browser">
          <summary class="tag-browser-summary">
            <svg
              class="tag-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            <span class="tag-browser-label">Tags</span>
            <span class="tag-count-badge">{allTags.length}</span>
            <button
              class="tag-mode-toggle"
              type="button"
              data-mode="AND"
              title="Toggle AND / OR for tag filtering"
              aria-label="Tag filter mode: AND"
            >
              AND
            </button>
          </summary>
          <div class="tag-list">
            {allTags.map((tag) => (
              <button
                class="tag-pill"
                data-tag={tag}
                type="button"
                title="Click: include · Again: exclude · Again: clear"
              >
                #{tag}
              </button>
            ))}
          </div>
        </details>
      </div>
    )
  }

  Search.afterDOMLoaded = script
  Search.css = style

  return Search
}) satisfies QuartzComponentConstructor
