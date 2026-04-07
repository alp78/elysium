import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Elysium", // ← your vault name
    pageTitleSuffix: " — Data Engineering", // ← appears in browser tab
    enableSPA: true,
    enablePopovers: true,
    analytics: null, // ← remove plausible unless you have an account
    locale: "en-US",
    baseUrl: "alp78.github.io/elysium", // ← your GitHub Pages URL or custom domain
    ignorePatterns: [
      "_workspace", // ← internal planning docs
      "_archive", // ← archived out-of-scope content
      "_scripts", // ← build scripts
      "_quartz-config", // ← quartz config copies
      "_attachments", // ← attachment files
      "Templates", // ← obsidian templates
      ".obsidian", // ← keep this one
    ],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Inter", // ← matches your vault
        body: "Inter", // ← clean screen font
        code: "JetBrains Mono", // ← matches your vault
      },
      colors: {
        lightMode: {
          light: "#f5f7fb", // page background
          lightgray: "#e9eef5", // subtle neutral layer
          gray: "#607080", // muted text
          darkgray: "#233241", // body text
          dark: "#101a26", // headings
          secondary: "#245e91", // links and accents
          tertiary: "#163f67", // hover state
          highlight: "rgba(36, 94, 145, 0.10)",
          textHighlight: "#e0af6833",
          surface: "#ffffff",
          surfaceElevated: "#fbfcfe",
          surfaceSubtle: "#f1f5fa",
          border: "#d6e0eb",
          borderStrong: "#b8c6d7",
        },
        darkMode: {
          light: "#0f141b", // page background
          lightgray: "#1b2631", // subtle neutral layer
          gray: "#8c99a8", // muted text
          darkgray: "#d8e1ec", // body text
          dark: "#f4f7fb", // headings
          secondary: "#7cb0dc", // links and accents
          tertiary: "#a4c8e7", // hover state
          highlight: "rgba(124, 176, 220, 0.16)",
          textHighlight: "#e0af6833",
          surface: "#131b24",
          surfaceElevated: "#18232e",
          surfaceSubtle: "#101821",
          border: "#2a3948",
          borderStrong: "#3c5266",
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
          dark: "tokyo-night", // ← match your theme
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
