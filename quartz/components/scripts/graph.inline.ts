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
import { Text, Graphics, Application, Container, Circle, Sprite, Texture } from "pixi.js"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, SimpleSlug, getFullSlug, resolveRelative, simplifySlug } from "../../util/path"
import { D3Config } from "../Graph"

type NodeData = {
  id: SimpleSlug
  text: string
  tags: string[]
  linkCount: number
} & SimulationNodeDatum

type SimpleLinkData = {
  source: SimpleSlug
  target: SimpleSlug
}

type LinkData = {
  source: NodeData
  target: NodeData
} & SimulationLinkDatum<NodeData>

type NodeRender = {
  sim: NodeData
  container: Container
  core: Graphics
  glow: Sprite
  label: Text
  color: string
  defaultAlpha: number
  targetAlpha: number
  targetScale: number
}

type LinkRender = {
  sim: LinkData
  gfx: Graphics
  defaultAlpha: number
  targetAlpha: number
}

const localStorageKey = "graph-visited"
function getVisited(): Set<SimpleSlug> {
  return new Set(JSON.parse(localStorage.getItem(localStorageKey) ?? "[]"))
}
function addToVisited(slug: SimpleSlug) {
  const visited = getVisited()
  visited.add(slug)
  localStorage.setItem(localStorageKey, JSON.stringify([...visited]))
}

// Section color palette — high contrast, dark-mode optimized
const SECTION_COLORS: Record<string, string> = {
  "00-Home": "#ffffff",
  "01-Shell": "#e06c75",
  "02-Programming": "#e5c07b",
  "03-SQL-Server": "#61afef",
  "04-DB-Queries": "#56b6c2",
  "05-GCP": "#4CAF50",
  "06-Terraform": "#7b61ff",
  "07-Git": "#f97316",
  "08-Docker": "#2496ed",
  "09-GitHub-Actions": "#8b5cf6",
  "10-dbt": "#ff694a",
  "11-Orchestration": "#22c55e",
  "12-Observability": "#a855f7",
  "13-Data-Architecture": "#06b6d4",
  "14-Runbooks": "#ef4444",
  "15-Engineering": "#14b8a6",
  "16-AI": "#ec4899",
  "17-Financial": "#f59e0b",
}

function getSectionColor(id: string): string {
  for (const [prefix, color] of Object.entries(SECTION_COLORS)) {
    if (id.startsWith(prefix)) return color
  }
  return "#6b7280"
}

function getNodeRadius(linkCount: number): number {
  if (linkCount <= 1) return 3
  if (linkCount <= 5) return 4
  return 4 + Math.sqrt(linkCount - 5) * 1.2
}

// Create a glow texture (radial gradient)
function createGlowTexture(color: string, size: number): Texture {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, color + "50")
  grad.addColorStop(0.4, color + "20")
  grad.addColorStop(1, color + "00")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return Texture.from(canvas)
}

async function renderGraph(graph: HTMLElement, fullSlug: FullSlug) {
  const slug = simplifySlug(fullSlug)
  getVisited() // track visits
  removeAllChildren(graph)

  let {
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
    focusOnHover: _focusOnHover,
    enableRadial,
  } = JSON.parse(graph.dataset["cfg"]!) as D3Config
  void _focusOnHover

  const data: Map<SimpleSlug, ContentDetails> = new Map(
    Object.entries<ContentDetails>(await fetchData).map(([k, v]) => [
      simplifySlug(k as FullSlug),
      v,
    ]),
  )
  const links: SimpleLinkData[] = []
  const tags: SimpleSlug[] = []
  const validLinks = new Set(data.keys())

  for (const [source, details] of data.entries()) {
    const outgoing = details.links ?? []
    for (const dest of outgoing) {
      if (validLinks.has(dest)) {
        links.push({ source, target: dest })
      }
    }
    if (showTags) {
      const localTags = details.tags
        .filter((tag) => !removeTags.includes(tag))
        .map((tag) => simplifySlug(("tags/" + tag) as FullSlug))
      tags.push(...localTags.filter((tag) => !tags.includes(tag)))
      for (const tag of localTags) {
        links.push({ source, target: tag })
      }
    }
  }

  // Build neighbourhood
  const neighbourhood = new Set<SimpleSlug>()
  const wl: (SimpleSlug | "__SENTINEL")[] = [slug, "__SENTINEL"]
  if (depth >= 0) {
    let d = depth
    while (d >= 0 && wl.length > 0) {
      const cur = wl.shift()!
      if (cur === "__SENTINEL") {
        d--
        wl.push("__SENTINEL")
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

  const nodes: NodeData[] = [...neighbourhood].map((url) => {
    const text = url.startsWith("tags/") ? "#" + url.substring(5) : (data.get(url)?.title ?? url)
    return { id: url, text, tags: data.get(url)?.tags ?? [], linkCount: linkCounts.get(url) ?? 0 }
  })

  const graphLinks: LinkData[] = links
    .filter((l) => neighbourhood.has(l.source) && neighbourhood.has(l.target))
    .map((l) => ({
      source: nodes.find((n) => n.id === l.source)!,
      target: nodes.find((n) => n.id === l.target)!,
    }))

  const width = graph.offsetWidth
  const height = Math.max(graph.offsetHeight, 250)

  // --- PHYSICS (Obsidian-like) ---
  const simulation: Simulation<NodeData, LinkData> = forceSimulation<NodeData>(nodes)
    .force(
      "charge",
      forceManyBody()
        .strength((d: any) => -30 - Math.sqrt(d.linkCount || 0) * 12 * repelForce)
        .distanceMin(8)
        .distanceMax(width * 0.35)
        .theta(0.8),
    )
    .force("center", forceCenter().strength(centerForce * 0.15))
    .force(
      "link",
      forceLink(graphLinks)
        .distance((l: any) => {
          const avg = ((l.source.linkCount || 0) + (l.target.linkCount || 0)) / 2
          return linkDistance + Math.sqrt(avg) * 5
        })
        .strength(0.7),
    )
    .force(
      "collide",
      forceCollide<NodeData>((d) => getNodeRadius(d.linkCount) + 2)
        .strength(0.7)
        .iterations(2),
    )
    .velocityDecay(0.4)
    .alphaDecay(0.008)
    .alphaMin(0.001)
    .alpha(1)

  const graphRadius = (Math.min(width, height) / 2) * 0.8
  if (enableRadial) simulation.force("radial", forceRadial(graphRadius).strength(0.15))

  // --- CSS vars ---
  const cssVars = ["--secondary", "--tertiary", "--gray", "--light", "--lightgray", "--dark", "--darkgray", "--bodyFont"] as const
  const css = cssVars.reduce(
    (acc, key) => {
      acc[key] = getComputedStyle(document.documentElement).getPropertyValue(key)
      return acc
    },
    {} as Record<(typeof cssVars)[number], string>,
  )

  // --- Color function ---
  function getColor(d: NodeData): string {
    if (d.id === slug) return css["--secondary"]
    if (d.id.startsWith("tags/")) return "#6b7280"
    return getSectionColor(d.id)
  }

  // --- PixiJS setup ---
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
  const linkContainer = new Container({ zIndex: 1, isRenderGroup: true })
  const glowContainer = new Container({ zIndex: 2, isRenderGroup: true })
  const nodeContainer = new Container({ zIndex: 3, isRenderGroup: true })
  const labelContainer = new Container<Text>({ zIndex: 4, isRenderGroup: true })
  stage.addChild(linkContainer, glowContainer, nodeContainer, labelContainer)

  // --- Create nodes ---
  const nodeRenders: NodeRender[] = []
  const nodeMap = new Map<string, NodeRender>()

  // Cache glow textures per section
  const glowCache = new Map<string, Texture>()

  for (const n of nodes) {
    const col = getColor(n)
    const r = getNodeRadius(n.linkCount)

    // Glow
    let glowTex = glowCache.get(col)
    if (!glowTex) {
      glowTex = createGlowTexture(col, 128)
      glowCache.set(col, glowTex)
    }
    const glow = new Sprite(glowTex)
    glow.anchor.set(0.5)
    glow.width = r * 6
    glow.height = r * 6
    glow.alpha = 0.3
    glowContainer.addChild(glow)

    // Core circle
    const isTag = n.id.startsWith("tags/")
    const core = new Graphics({
      interactive: true,
      label: n.id,
      eventMode: "static",
      hitArea: new Circle(0, 0, Math.max(r, 6)),
      cursor: "pointer",
    })
      .circle(0, 0, r)
      .fill({ color: col })
    if (isTag) core.stroke({ width: 1, color: css["--tertiary"] })
    nodeContainer.addChild(core)

    // Label
    const label = new Text({
      text: n.text,
      alpha: 0,
      anchor: { x: 0.5, y: -0.8 },
      style: {
        fontSize: fontSize * 12,
        fill: css["--dark"],
        fontFamily: css["--bodyFont"],
        fontWeight: "500",
        dropShadow: {
          color: css["--light"],
          blur: 4,
          distance: 0,
          alpha: 0.8,
        },
      },
      resolution: window.devicePixelRatio * 3,
    })
    label.interactive = false
    label.eventMode = "none"
    label.scale.set(1 / scale)
    labelContainer.addChild(label)

    const container = new Container()
    const nr: NodeRender = {
      sim: n,
      container,
      core,
      glow,
      label,
      color: col,
      defaultAlpha: 1,
      targetAlpha: 1,
      targetScale: 1,
    }
    nodeRenders.push(nr)
    nodeMap.set(n.id, nr)
  }

  // --- Create edges ---
  const linkRenders: LinkRender[] = []
  for (const l of graphLinks) {
    const gfx = new Graphics({ interactive: false, eventMode: "none" })
    linkContainer.addChild(gfx)
    const avgDeg = (l.source.linkCount + l.target.linkCount) / 2
    const baseAlpha = Math.min(0.15 + avgDeg * 0.02, 0.5)
    linkRenders.push({ sim: l, gfx, defaultAlpha: baseAlpha, targetAlpha: baseAlpha })
  }

  // --- Hover logic ---
  let hoveredId: string | null = null
  let dragging = false
  let dragStartTime = 0

  function onHover(nodeId: string | null) {
    hoveredId = nodeId
    if (!nodeId) {
      // Reset all
      for (const nr of nodeRenders) {
        nr.targetAlpha = 1
        nr.targetScale = 1
      }
      for (const lr of linkRenders) {
        lr.targetAlpha = lr.defaultAlpha
      }
    } else {
      // Find connected
      const connected = new Set<string>([nodeId])
      for (const lr of linkRenders) {
        if (lr.sim.source.id === nodeId) connected.add(lr.sim.target.id)
        if (lr.sim.target.id === nodeId) connected.add(lr.sim.source.id)
      }
      // Dim everything except connected
      for (const nr of nodeRenders) {
        nr.targetAlpha = connected.has(nr.sim.id) ? 1 : 0.06
        nr.targetScale = nr.sim.id === nodeId ? 1.4 : 1
      }
      for (const lr of linkRenders) {
        const isConn = lr.sim.source.id === nodeId || lr.sim.target.id === nodeId
        lr.targetAlpha = isConn ? 0.8 : 0.02
      }
    }
  }

  // Attach hover events
  for (const nr of nodeRenders) {
    let oldLabelAlpha = 0
    nr.core
      .on("pointerover", () => {
        oldLabelAlpha = nr.label.alpha
        onHover(nr.sim.id)
        nr.label.alpha = 1
      })
      .on("pointerleave", () => {
        onHover(null)
        nr.label.alpha = oldLabelAlpha
      })
  }

  // --- Drag ---
  let currentTransform = zoomIdentity
  if (enableDrag) {
    select<HTMLCanvasElement, NodeData | undefined>(app.canvas).call(
      drag<HTMLCanvasElement, NodeData | undefined>()
        .container(() => app.canvas)
        .subject(() => nodes.find((n) => n.id === hoveredId))
        .on("start", function (event) {
          if (!event.active) simulation.alphaTarget(0.05).restart()
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
          event.subject.__initialDragPos = { x: event.subject.x, y: event.subject.y }
          dragStartTime = Date.now()
          dragging = true
        })
        .on("drag", function (event) {
          const init = event.subject.__initialDragPos
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
      nr.core.on("click", () => {
        const targ = resolveRelative(fullSlug, nr.sim.id)
        window.spaNavigate(new URL(targ, window.location.toString()))
      })
    }
  }

  // --- Zoom ---
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

          // Label visibility with collision avoidance
          const zoomScale = transform.k * opacityScale
          const baseOpacity = Math.max((zoomScale - 0.5) / 2, 0)

          const sorted = [...nodeRenders].sort((a, b) => b.sim.linkCount - a.sim.linkCount)
          const minDist = 55 / transform.k
          const shown: { x: number; y: number }[] = []

          for (const nr of sorted) {
            if (hoveredId === nr.sim.id) {
              nr.label.alpha = 1
              shown.push({ x: nr.sim.x ?? 0, y: nr.sim.y ?? 0 })
              continue
            }
            const sx = nr.sim.x ?? 0
            const sy = nr.sim.y ?? 0
            const overlap = shown.some(
              (p) => Math.abs(sx - p.x) < minDist && Math.abs(sy - p.y) < minDist * 0.4,
            )
            if (overlap || baseOpacity === 0) {
              nr.label.alpha = 0
            } else {
              nr.label.alpha = baseOpacity
              shown.push({ x: sx, y: sy })
            }
          }
        }),
    )
  }

  // --- Animation loop ---
  let stopAnimation = false
  const LERP_SPEED = 0.12

  function animate() {
    if (stopAnimation) return

    for (const nr of nodeRenders) {
      const { x, y } = nr.sim
      if (!x || !y) continue
      const px = x + width / 2
      const py = y + height / 2
      nr.core.position.set(px, py)
      nr.glow.position.set(px, py)
      nr.label.position.set(px, py)

      // Smooth alpha lerp
      nr.core.alpha += (nr.targetAlpha - nr.core.alpha) * LERP_SPEED
      nr.glow.alpha += (nr.targetAlpha * 0.3 - nr.glow.alpha) * LERP_SPEED

      // Smooth scale lerp
      const s = nr.core.scale.x + (nr.targetScale - nr.core.scale.x) * LERP_SPEED
      nr.core.scale.set(s)
      nr.glow.scale.set(s)
    }

    // Draw edges as curved lines
    for (const lr of linkRenders) {
      const { source, target } = lr.sim
      if (!source.x || !source.y || !target.x || !target.y) continue
      const sx = source.x + width / 2
      const sy = source.y + height / 2
      const tx = target.x + width / 2
      const ty = target.y + height / 2

      // Slight curve
      const dx = tx - sx
      const dy = ty - sy
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const cx = (sx + tx) / 2 - (dy / len) * 4
      const cy = (sy + ty) / 2 + (dx / len) * 4

      // Smooth alpha
      lr.gfx.alpha += (lr.targetAlpha - lr.gfx.alpha) * LERP_SPEED

      const srcColor = nodeMap.get(source.id)?.color ?? css["--lightgray"]
      lr.gfx.clear()
      lr.gfx.moveTo(sx, sy)
      lr.gfx.quadraticCurveTo(cx, cy, tx, ty)
      lr.gfx.stroke({ width: 0.6, color: srcColor, alpha: 0.35 })
    }

    app.renderer.render(stage)
    requestAnimationFrame(animate)
  }

  requestAnimationFrame(animate)
  return () => {
    stopAnimation = true
    app.destroy()
  }
}

// --- Lifecycle ---
let localGraphCleanups: (() => void)[] = []
let globalGraphCleanups: (() => void)[] = []

function cleanupLocalGraphs() {
  for (const c of localGraphCleanups) c()
  localGraphCleanups = []
}
function cleanupGlobalGraphs() {
  for (const c of globalGraphCleanups) c()
  globalGraphCleanups = []
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const slug = e.detail.url
  addToVisited(simplifySlug(slug))

  async function renderLocalGraph() {
    cleanupLocalGraphs()
    const containers = document.getElementsByClassName("graph-container")
    for (const container of containers) {
      localGraphCleanups.push(await renderGraph(container as HTMLElement, slug))
    }
  }

  await renderLocalGraph()
  const handleThemeChange = () => void renderLocalGraph()
  document.addEventListener("themechange", handleThemeChange)
  window.addCleanup(() => document.removeEventListener("themechange", handleThemeChange))

  const containers = [...document.getElementsByClassName("global-graph-outer")] as HTMLElement[]

  async function renderGlobalGraph() {
    const slug = getFullSlug(window)
    for (const container of containers) {
      container.classList.add("active")
      const sidebar = container.closest(".sidebar") as HTMLElement
      if (sidebar) sidebar.style.zIndex = "1"
      const gc = container.querySelector(".global-graph-container") as HTMLElement
      registerEscapeHandler(container, hideGlobalGraph)
      if (gc) globalGraphCleanups.push(await renderGraph(gc, slug))
    }
  }

  function hideGlobalGraph() {
    cleanupGlobalGraphs()
    for (const container of containers) {
      container.classList.remove("active")
      const sidebar = container.closest(".sidebar") as HTMLElement
      if (sidebar) sidebar.style.zIndex = ""
    }
  }

  async function shortcutHandler(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const open = containers.some((c) => c.classList.contains("active"))
      open ? hideGlobalGraph() : renderGlobalGraph()
    }
  }

  const icons = document.getElementsByClassName("global-graph-icon")
  Array.from(icons).forEach((icon) => {
    icon.addEventListener("click", renderGlobalGraph)
    window.addCleanup(() => icon.removeEventListener("click", renderGlobalGraph))
  })

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => {
    document.removeEventListener("keydown", shortcutHandler)
    cleanupLocalGraphs()
    cleanupGlobalGraphs()
  })
})
