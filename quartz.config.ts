import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Elysium",                    // ← your vault name
    pageTitleSuffix: " — Data Engineering",  // ← appears in browser tab
    enableSPA: true,
    enablePopovers: true,
    analytics: null,                         // ← remove plausible unless you have an account
    locale: "en-US",
    baseUrl: "alp78.github.io/elysium", // ← your GitHub Pages URL or custom domain
    ignorePatterns: [
      "_workspace",        // ← internal planning docs
      "_archive",          // ← archived out-of-scope content
      "_scripts",          // ← build scripts
      "_quartz-config",    // ← quartz config copies
      "_attachments",      // ← attachment files
      "Templates",         // ← obsidian templates
      ".obsidian",         // ← keep this one
    ],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Inter",              // ← matches your vault
        body: "Inter",                // ← clean screen font
        code: "JetBrains Mono",       // ← matches your vault
      },
      colors: {
        lightMode: {
          light: "#f0f0f2",           // warm off-white background
          lightgray: "#e0dfe4",       // sidebar/borders — less harsh
          gray: "#9a96a6",            // muted text
          darkgray: "#3b3950",        // body text — deep purple-gray
          dark: "#1e1b2e",            // headings — near-black purple
          secondary: "#5a4fcf",       // links — muted indigo (not blue)
          tertiary: "#7c6dd8",        // hover — lighter indigo
          highlight: "rgba(90, 79, 207, 0.08)",  // subtle indigo tint
          textHighlight: "#e0af6833",
        },
        darkMode: {
          light: "#13141d",           // Tokyo Night background (darker surround)
          lightgray: "#1a1b26",       // borders/dividers
          gray: "#565f89",            // muted text
          darkgray: "#a9b1d6",        // body text
          dark: "#c0caf5",            // headings
          secondary: "#7aa2f7",       // links — Tokyo Night blue
          tertiary: "#bb9af7",        // hover — Tokyo Night purple
          highlight: "rgba(122, 162, 247, 0.08)",
          textHighlight: "#e0af6833",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "tokyo-night",         // ← match your theme
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Plugin.CustomOgImages(),     // ← comment out to speed up builds
    ],
  },
}


export default config
