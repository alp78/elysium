// Replace the U+2705 (WHITE HEAVY CHECK MARK) emoji — which is rendered as an
// uncolorable color-glyph by the OS emoji font — with a CSS-styleable span
// containing U+2714 (HEAVY CHECK MARK) + U+FE0E (text-presentation selector).
// The wrapping span carries a class so CSS can recolor it (see .deep-check
// rule in quartz/styles/custom.scss).

const SOURCE_EMOJI = "\u2705" // ✅
const REPLACEMENT = "\u2714\uFE0E" // ✔︎ (text presentation)
const WRAPPER_CLASS = "deep-check"

// Skip text nodes inside these tags — we don't want to rewrite code blocks,
// already-processed spans, or script/style contents.
const SKIP_TAGS = new Set(["CODE", "PRE", "SCRIPT", "STYLE", "TEXTAREA", "KBD", "SAMP"])

function recolorEmojisIn(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.includes(SOURCE_EMOJI)) {
        return NodeFilter.FILTER_REJECT
      }
      // Skip if any ancestor is a tag we should ignore, or if we've already
      // wrapped this node on a previous pass.
      let parent = node.parentElement
      while (parent) {
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
        if (parent.classList && parent.classList.contains(WRAPPER_CLASS)) {
          return NodeFilter.FILTER_REJECT
        }
        parent = parent.parentElement
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const targets: Text[] = []
  let current = walker.nextNode()
  while (current) {
    targets.push(current as Text)
    current = walker.nextNode()
  }

  for (const textNode of targets) {
    const text = textNode.nodeValue ?? ""
    const parts = text.split(SOURCE_EMOJI)
    if (parts.length < 2) continue

    const frag = document.createDocumentFragment()
    parts.forEach((chunk, i) => {
      if (chunk.length > 0) {
        frag.appendChild(document.createTextNode(chunk))
      }
      if (i < parts.length - 1) {
        const span = document.createElement("span")
        span.className = WRAPPER_CLASS
        span.textContent = REPLACEMENT
        frag.appendChild(span)
      }
    })
    textNode.parentNode?.replaceChild(frag, textNode)
  }
}

document.addEventListener("nav", () => {
  const center = document.querySelector(".center") as HTMLElement | null
  if (!center) return
  recolorEmojisIn(center)
})
