import type { ContentDetails } from "../../plugins/emitters/contentIndex"
import {
  SimulationNodeDatum,
  SimulationLinkDatum,
  Simulation,
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceRadial,
  zoomIdentity,
  select,
  drag,
  zoom,
} from "d3"
import { Text, Graphics, Application, Container, Circle } from "pixi.js"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, SimpleSlug, getFullSlug, resolveRelative, simplifySlug } from "../../util/path"
import { D3Config } from "../Graph"

// --- Types ---
type NodeData = {
  id: SimpleSlug
  text: string
  tags: string[]
  linkCount: number
} & SimulationNodeDatum

type SimpleLinkData = { source: SimpleSlug; target: SimpleSlug }
type LinkData = { source: NodeData; target: NodeData } & SimulationLinkDatum<NodeData>

// --- Visited tracking ---
const localStorageKey = "graph-visited"
function getVisited(): Set<SimpleSlug> {
  return new Set(JSON.parse(localStorage.getItem(localStorageKey) ?? "[]"))
}
function addToVisited(slug: SimpleSlug) {
  const visited = getVisited()
  visited.add(slug)
  localStorage.setItem(localStorageKey, JSON.stringify([...visited]))
}

// --- Section Colors (Obsidian-matched palette) ---
const SECTION_COLORS: Record<string, number> = {
  "00-Home": 0xffffff,
  "01-Shell": 0xe06c75,
  "02-Programming": 0xe5c07b,
  "03-SQL-Server": 0x61afef,
  "04-DB-Queries": 0x56b6c2,
  "05-GCP": 0x22d3ee,
  "06-Terraform": 0x7b61ff,
  "07-Git": 0xf97316,
  "08-Docker": 0x2496ed,
  "09-GitHub": 0xf472b6,
  "10-dbt": 0xff694a,
  "11-Orchestration": 0x22c55e,
  "12-Observability": 0xa855f7,
  "13-Data": 0x06b6d4,
  "14-Runbooks": 0xef4444,
  "15-Engineering": 0x6b7280,
  "16-AI": 0xec4899,
  "17-Financial": 0xfbbf24,
}

function getSectionColor(id: string): number {
  for (const [prefix, color] of Object.entries(SECTION_COLORS)) {
    if (id.startsWith(prefix)) return color
  }
  return 0x9ca3af
}

// --- Node sizing: clamped log scale, max 3:1 ratio ---
const NODE_MIN_RADIUS = 2
const NODE_MAX_RADIUS = 18
const NODE_SCALE = 3.2

function getNodeRadius(node: { linkCount: number }): number {
  const lc = node.linkCount ?? 0
  if (lc <= 1) return NODE_MIN_RADIUS + 1  // 3px for minimal nodes
  return Math.min(NODE_MAX_RADIUS, NODE_MIN_RADIUS + Math.sqrt(lc) * NODE_SCALE)
}

// --- Main render function ---
async function renderGraph(graph: HTMLElement, fullSlug: FullSlug) {
  const slug = simplifySlug(fullSlug)
  removeAllChildren(graph)

  const {
    drag: enableDrag,
    zoom: enableZoom,
    depth,
    scale,
    repelForce,
    centerForce,
    linkDistance,
    fontSize,
    opacityScale,
    removeTags,
    showTags,
  } = JSON.parse(graph.dataset["cfg"]!) as D3Config

  const data: Map<SimpleSlug, ContentDetails> = new Map(
    Object.entries<ContentDetails>(await fetchData).map(([k, v]) => [
      simplifySlug(k as FullSlug),
      v,
    ]),
  )

  // Build links and tags
  const links: SimpleLinkData[] = []
  const tags: SimpleSlug[] = []
  const validLinks = new Set(data.keys())

  for (const [source, details] of data.entries()) {
    for (const dest of details.links ?? []) {
      if (validLinks.has(dest)) links.push({ source, target: dest })
    }
    if (showTags) {
      const localTags = details.tags
        .filter((tag) => !removeTags.includes(tag))
        .map((tag) => simplifySlug(("tags/" + tag) as FullSlug))
      tags.push(...localTags.filter((tag) => !tags.includes(tag)))
      for (const tag of localTags) links.push({ source, target: tag })
    }
  }

  // Neighbourhood filter
  const neighbourhood = new Set<SimpleSlug>()
  if (depth >= 0) {
    const wl: (SimpleSlug | "__S")[] = [slug, "__S"]
    let d = depth
    while (d >= 0 && wl.length > 0) {
      const cur = wl.shift()!
      if (cur === "__S") {
        d--
        wl.push("__S")
      } else {
        neighbourhood.add(cur)
        wl.push(
          ...links.filter((l) => l.source === cur).map((l) => l.target),
          ...links.filter((l) => l.target === cur).map((l) => l.source),
        )
      }
    }
  } else {
    validLinks.forEach((id) => neighbourhood.add(id))
    if (showTags) tags.forEach((tag) => neighbourhood.add(tag))
  }

  // Precompute link counts
  const linkCounts = new Map<string, number>()
  for (const l of links) {
    if (neighbourhood.has(l.source) && neighbourhood.has(l.target)) {
      linkCounts.set(l.source, (linkCounts.get(l.source) ?? 0) + 1)
      linkCounts.set(l.target, (linkCounts.get(l.target) ?? 0) + 1)
    }
  }

  const nodes: NodeData[] = [...neighbourhood].map((url) => ({
    id: url,
    text: url.startsWith("tags/") ? "#" + url.substring(5) : (data.get(url)?.title ?? url),
    tags: data.get(url)?.tags ?? [],
    linkCount: linkCounts.get(url) ?? 0,
  }))

  const graphLinks: LinkData[] = links
    .filter((l) => neighbourhood.has(l.source) && neighbourhood.has(l.target))
    .map((l) => ({
      source: nodes.find((n) => n.id === l.source)!,
      target: nodes.find((n) => n.id === l.target)!,
    }))

  const width = graph.offsetWidth
  const height = Math.max(graph.offsetHeight, 250)

  // ========== PHYSICS (Obsidian-matched) ==========
  const simulation: Simulation<NodeData, LinkData> = forceSimulation<NodeData>(nodes)
    .force(
      "charge",
      forceManyBody<NodeData>()
        .strength(-200)
        .distanceMin(20)
        .distanceMax(500)
        .theta(0.9),
    )
    .force(
      "link",
      forceLink<NodeData, LinkData>(graphLinks)
        .distance(90)
        .strength(0.3),
    )
    .force("center", forceCenter(width / 2, height / 2).strength(0.015))
    .force(
      "collide",
      forceCollide<NodeData>()
        .radius((d) => getNodeRadius(d) + 25)
        .strength(1.0)
        .iterations(4),
    )
    .force(
      "radial",
      forceRadial(Math.min(width, height) * 0.35, width / 2, height / 2).strength(0.03),
    )
    .velocityDecay(0.35)
    .alphaDecay(0.005)
    .alphaMin(0.001)
    .alpha(1)

  // Pre-settle: run 150 physics ticks silently before rendering
  for (let i = 0; i < 150; i++) simulation.tick()
  simulation.alpha(0.15)  // gentle remaining settling the user will see

  // ========== CSS Vars ==========
  const cssVars = [
    "--secondary", "--tertiary", "--gray", "--light",
    "--lightgray", "--dark", "--darkgray", "--bodyFont",
  ] as const
  const css = cssVars.reduce(
    (acc, key) => {
      acc[key] = getComputedStyle(document.documentElement).getPropertyValue(key)
      return acc
    },
    {} as Record<(typeof cssVars)[number], string>,
  )

  const isDark = document.documentElement.getAttribute("saved-theme") === "dark"

  // ========== PixiJS Setup ==========
  const app = new Application()
  await app.init({
    width,
    height,
    antialias: true,
    autoStart: false,
    autoDensity: true,
    backgroundAlpha: 0,
    preference: "webgpu",
    resolution: window.devicePixelRatio,
    eventMode: "static",
  })
  graph.appendChild(app.canvas)

  const stage = app.stage
  stage.interactive = false

  // Containers: edges behind, nodes on top, labels on top of nodes
  const edgeGfx = new Graphics({ interactive: false, eventMode: "none" })
  const nodeContainer = new Container<Graphics>({ zIndex: 2, isRenderGroup: true })
  const labelContainer = new Container<Text>({ zIndex: 3, isRenderGroup: true })
  stage.addChild(edgeGfx, nodeContainer, labelContainer)

  // ========== Create Nodes (flat circles, NO glow) ==========
  type NodeRender = {
    sim: NodeData
    gfx: Graphics
    label: Text
    baseColor: number
    targetAlpha: number
    targetScale: number
  }

  const nodeRenders: NodeRender[] = []
  const nodeMap = new Map<string, NodeRender>()

  for (const n of nodes) {
    const isTag = n.id.startsWith("tags/")
    const isCurrent = n.id === slug
    const baseColor = isCurrent ? 0xffffff : isTag ? 0x6b7280 : getSectionColor(n.id)
    const r = getNodeRadius(n) * (isCurrent ? 1.3 : 1) * (isTag ? 0.6 : 1)

    const gfx = new Graphics({
      interactive: true,
      label: n.id,
      eventMode: "static",
      hitArea: new Circle(0, 0, Math.max(r + 4, 8)),
      cursor: "pointer",
    })
    gfx.circle(0, 0, r).fill({ color: baseColor })
    if (isTag) gfx.stroke({ width: 1, color: 0x9ca3af })
    nodeContainer.addChild(gfx)

    const label = new Text({
      text: n.text,
      alpha: 0,
      anchor: { x: 0.5, y: -0.6 },
      style: {
        fontSize: 13,
        fill: isDark ? 0xb0bec5 : 0x37474f,
        fontFamily: css["--bodyFont"],
        fontWeight: "400",
      },
      resolution: window.devicePixelRatio * 3,
    })
    label.interactive = false
    label.eventMode = "none"
    label.scale.set(1 / scale)
    labelContainer.addChild(label)

    const nr: NodeRender = {
      sim: n,
      gfx,
      label,
      baseColor,
      targetAlpha: 1,
      targetScale: 1,
    }
    nodeRenders.push(nr)
    nodeMap.set(n.id, nr)
  }

  // ========== Hover Logic ==========
  let hoveredId: string | null = null
  let dragging = false
  let dragStartTime = 0

  function setHover(nodeId: string | null) {
    hoveredId = nodeId
    if (!nodeId) {
      for (const nr of nodeRenders) {
        nr.targetAlpha = 1
        nr.targetScale = 1
      }
    } else {
      const connected = new Set<string>([nodeId])
      for (const l of graphLinks) {
        if (l.source.id === nodeId) connected.add(l.target.id)
        if (l.target.id === nodeId) connected.add(l.source.id)
      }
      for (const nr of nodeRenders) {
        nr.targetAlpha = connected.has(nr.sim.id) ? 1 : 0.08
        nr.targetScale = nr.sim.id === nodeId ? 1.2 : 1
      }
    }
  }

  // Attach hover events
  for (const nr of nodeRenders) {
    let savedLabelAlpha = 0
    nr.gfx
      .on("pointerover", () => {
        savedLabelAlpha = nr.label.alpha
        setHover(nr.sim.id)
        nr.label.alpha = 1
      })
      .on("pointerleave", () => {
        setHover(null)
        nr.label.alpha = savedLabelAlpha
      })
  }

  // ========== Drag ==========
  let currentTransform = zoomIdentity
  if (enableDrag) {
    select<HTMLCanvasElement, NodeData | undefined>(app.canvas).call(
      drag<HTMLCanvasElement, NodeData | undefined>()
        .container(() => app.canvas)
        .subject(() => nodes.find((n) => n.id === hoveredId))
        .on("start", function (event) {
          if (!event.active) simulation.alphaTarget(0.03).restart()
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
          event.subject.__initDrag = { x: event.subject.x, y: event.subject.y }
          dragStartTime = Date.now()
          dragging = true
        })
        .on("drag", function (event) {
          const init = event.subject.__initDrag
          event.subject.fx = init.x + (event.x - init.x) / currentTransform.k
          event.subject.fy = init.y + (event.y - init.y) / currentTransform.k
        })
        .on("end", function (event) {
          if (!event.active) simulation.alphaTarget(0)
          event.subject.fx = null
          event.subject.fy = null
          dragging = false
          if (Date.now() - dragStartTime < 500) {
            const targ = resolveRelative(fullSlug, event.subject.id)
            window.spaNavigate(new URL(targ, window.location.toString()))
          }
        }),
    )
  } else {
    for (const nr of nodeRenders) {
      nr.gfx.on("click", () => {
        const targ = resolveRelative(fullSlug, nr.sim.id)
        window.spaNavigate(new URL(targ, window.location.toString()))
      })
    }
  }

  // ========== Zoom ==========
  if (enableZoom) {
    select<HTMLCanvasElement, NodeData>(app.canvas).call(
      zoom<HTMLCanvasElement, NodeData>()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.1, 15])
        .on("zoom", ({ transform }) => {
          currentTransform = transform
          stage.scale.set(transform.k)
          stage.position.set(transform.x, transform.y)
          updateLabels(transform.k)
        }),
    )
  }

  // ========== Label visibility with collision avoidance ==========
  function updateLabels(zoomK: number) {
    const sorted = [...nodeRenders].sort((a, b) => b.sim.linkCount - a.sim.linkCount)
    const placed: Array<{ x: number; y: number; w: number; h: number }> = []
    const minScreenR = 12

    for (const nr of sorted) {
      if (hoveredId === nr.sim.id) {
        nr.label.visible = true
        nr.label.alpha = 1
        continue
      }

      const screenR = getNodeRadius(nr.sim) * zoomK
      if (screenR < minScreenR) {
        nr.label.visible = false
        continue
      }

      // Check collision with placed labels
      const lx = (nr.sim.x ?? 0)
      const ly = (nr.sim.y ?? 0) + getNodeRadius(nr.sim) + 4
      const lw = (nr.label.width / zoomK) * (1 / scale)
      const lh = (nr.label.height / zoomK) * (1 / scale)
      const bounds = { x: lx - lw / 2, y: ly, w: lw, h: lh }

      const collides = placed.some(
        (b) =>
          bounds.x < b.x + b.w &&
          bounds.x + bounds.w > b.x &&
          bounds.y < b.y + b.h &&
          bounds.y + bounds.h > b.y,
      )

      if (collides) {
        nr.label.visible = false
      } else {
        nr.label.visible = true
        const fadeProgress = Math.min(1, (screenR - minScreenR) / 6)
        nr.label.alpha = fadeProgress * 0.9
        placed.push(bounds)
      }
    }
  }

  // ========== Animation Loop ==========
  let stopAnimation = false
  const LERP = 0.12
  const edgeColor = isDark ? 0x4a5568 : 0x94a3b8
  const edgeAlpha = isDark ? 0.40 : 0.25

  function animate() {
    if (stopAnimation) return

    // Update node positions + smooth alpha/scale
    for (const nr of nodeRenders) {
      const { x, y } = nr.sim
      if (!x || !y) continue
      nr.gfx.position.set(x, y)
      nr.label.position.set(x, y)

      // Smooth alpha lerp
      const da = nr.targetAlpha - nr.gfx.alpha
      if (Math.abs(da) > 0.01) nr.gfx.alpha += da * LERP

      // Smooth scale lerp
      const ds = nr.targetScale - nr.gfx.scale.x
      if (Math.abs(ds) > 0.01) {
        const s = nr.gfx.scale.x + ds * LERP
        nr.gfx.scale.set(s)
      }
    }

    // Draw ALL edges — two-pass when hovering for starburst effect
    edgeGfx.clear()

    if (hoveredId) {
      // PASS 1: Non-connected edges (nearly invisible)
      const dimColor = isDark ? 0x2a2e3a : 0xd0d5dd
      for (const l of graphLinks) {
        const s = l.source
        const t = l.target
        if (!s.x || !s.y || !t.x || !t.y) continue
        if (s.id === hoveredId || t.id === hoveredId) continue
        edgeGfx.moveTo(s.x, s.y)
        edgeGfx.lineTo(t.x, t.y)
        edgeGfx.stroke({ width: 0.5, color: dimColor, alpha: 0.04 })
      }
      // PASS 2: Connected edges (bright starburst)
      const brightColor = isDark ? 0xa0c4ff : 0x3b82f6
      for (const l of graphLinks) {
        const s = l.source
        const t = l.target
        if (!s.x || !s.y || !t.x || !t.y) continue
        if (s.id !== hoveredId && t.id !== hoveredId) continue
        edgeGfx.moveTo(s.x, s.y)
        edgeGfx.lineTo(t.x, t.y)
        edgeGfx.stroke({ width: 1.8, color: brightColor, alpha: 0.75 })
      }
    } else {
      // DEFAULT: No hover — all edges uniform
      for (const l of graphLinks) {
        const s = l.source
        const t = l.target
        if (!s.x || !s.y || !t.x || !t.y) continue
        edgeGfx.moveTo(s.x, s.y)
        edgeGfx.lineTo(t.x, t.y)
        edgeGfx.stroke({ width: 1.0, color: edgeColor, alpha: edgeAlpha })
      }
    }

    app.renderer.render(stage)
    requestAnimationFrame(animate)
  }

  // Center the stage initially (nodes position around 0,0; stage offset = center)
  stage.position.set(0, 0)

  requestAnimationFrame(animate)
  return () => {
    stopAnimation = true
    app.destroy()
  }
}

// ========== Lifecycle ==========
let localGraphCleanups: (() => void)[] = []
let globalGraphCleanups: (() => void)[] = []
function cleanupLocal() {
  for (const c of localGraphCleanups) c()
  localGraphCleanups = []
}
function cleanupGlobal() {
  for (const c of globalGraphCleanups) c()
  globalGraphCleanups = []
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const slug = e.detail.url
  addToVisited(simplifySlug(slug))

  async function renderLocal() {
    cleanupLocal()
    const containers = document.getElementsByClassName("graph-container")
    for (const c of containers) {
      localGraphCleanups.push(await renderGraph(c as HTMLElement, slug))
    }
  }

  await renderLocal()
  const onTheme = () => void renderLocal()
  document.addEventListener("themechange", onTheme)
  window.addCleanup(() => document.removeEventListener("themechange", onTheme))

  const globalContainers = [...document.getElementsByClassName("global-graph-outer")] as HTMLElement[]

  async function renderGlobal() {
    const s = getFullSlug(window)
    for (const container of globalContainers) {
      container.classList.add("active")
      const sidebar = container.closest(".sidebar") as HTMLElement
      if (sidebar) sidebar.style.zIndex = "1"
      const gc = container.querySelector(".global-graph-container") as HTMLElement
      registerEscapeHandler(container, hideGlobal)
      if (gc) globalGraphCleanups.push(await renderGraph(gc, s))
    }
  }

  function hideGlobal() {
    cleanupGlobal()
    for (const c of globalContainers) {
      c.classList.remove("active")
      const sidebar = c.closest(".sidebar") as HTMLElement
      if (sidebar) sidebar.style.zIndex = ""
    }
  }

  async function shortcut(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const open = globalContainers.some((c) => c.classList.contains("active"))
      open ? hideGlobal() : renderGlobal()
    }
  }

  const icons = document.getElementsByClassName("global-graph-icon")
  Array.from(icons).forEach((icon) => {
    icon.addEventListener("click", renderGlobal)
    window.addCleanup(() => icon.removeEventListener("click", renderGlobal))
  })

  document.addEventListener("keydown", shortcut)
  window.addCleanup(() => {
    document.removeEventListener("keydown", shortcut)
    cleanupLocal()
    cleanupGlobal()
  })
})
