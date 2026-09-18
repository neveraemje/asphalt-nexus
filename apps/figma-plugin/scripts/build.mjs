import postcss from "postcss"
import tailwindcss from "@tailwindcss/postcss"
import nextEnv from "@next/env"
import { build } from "esbuild"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const repoRoot = dirname(dirname(pluginRoot))
const distDir = join(pluginRoot, "dist")
const tempDir = join(pluginRoot, ".build")

nextEnv.loadEnvConfig(repoRoot)

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const configuredSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || ""
const supabaseUrl = configuredSupabaseUrl.includes("your-project")
  ? ""
  : configuredSupabaseUrl
const supabaseAnonKey = /your-(anon|publishable)-key/.test(configuredSupabaseAnonKey)
  ? ""
  : configuredSupabaseAnonKey

if (!existsSync(join(repoRoot, "node_modules", "esbuild"))) {
  throw new Error("esbuild is not installed. Run npm install from the repo root first.")
}

rmSync(tempDir, { force: true, recursive: true })
rmSync(distDir, { force: true, recursive: true })
mkdirSync(tempDir, { recursive: true })
mkdirSync(distDir, { recursive: true })

await build({
  bundle: true,
  define: {
    __NEXUS_SUPABASE_ANON_KEY__: JSON.stringify(supabaseAnonKey),
    __NEXUS_SUPABASE_URL__: JSON.stringify(supabaseUrl),
  },
  entryPoints: [join(pluginRoot, "src", "code.ts")],
  format: "iife",
  outfile: join(distDir, "code.js"),
  platform: "browser",
  target: "es2020",
})

await build({
  bundle: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  entryPoints: [join(pluginRoot, "src", "ui.tsx")],
  format: "iife",
  jsx: "automatic",
  outfile: join(tempDir, "ui.js"),
  platform: "browser",
  target: "es2020",
})

const cssResult = await postcss([tailwindcss()]).process(
  readFileSync(join(pluginRoot, "src", "ui.css"), "utf8"),
  {
    from: join(pluginRoot, "src", "ui.css"),
  }
)

const assets = {
  "__ASSET_CP_HOME_LONG__": { fileName: "cp-home-long.png", mimeType: "image/png" },
  "__ASSET_CP_HOME__": { fileName: "cp-home.png", mimeType: "image/png" },
  "__ASSET_FIGMA_LOGO__": { fileName: "figma-logo.svg", mimeType: "image/svg+xml" },
  "__ASSET_GALLERY_PREVIEW__": { fileName: "gallery-preview.png", mimeType: "image/png" },
  "__ASSET_GOFOOD_GROUP_ORDER__": { fileName: "gofood-group-order.png", mimeType: "image/png" },
  "__ASSET_GOFOOD_MERCHANT__": { fileName: "gofood-merchant.png", mimeType: "image/png" },
  "__ASSET_HOME_THUMBNAIL__": { fileName: "home-thumbnail.png", mimeType: "image/png" },
}

const fonts = {
  "__FONT_RUPA_BOLD_ITALIC__": "RupaSansApp-BoldItalic.otf",
  "__FONT_RUPA_BOLD__": "RupaSansApp-Bold.otf",
  "__FONT_RUPA_EXTRABOLD_ITALIC__": "RupaSansApp-ExtraBoldItalic.otf",
  "__FONT_RUPA_EXTRABOLD__": "RupaSansApp-ExtraBold.otf",
  "__FONT_RUPA_EXTRALIGHT_ITALIC__": "RupaSansApp-ExtraLightItalic.otf",
  "__FONT_RUPA_EXTRALIGHT__": "RupaSansApp-ExtraLight.otf",
  "__FONT_RUPA_ITALIC__": "RupaSansApp-Italic.otf",
  "__FONT_RUPA_LIGHT_ITALIC__": "RupaSansApp-LightItalic.otf",
  "__FONT_RUPA_LIGHT__": "RupaSansApp-Light.otf",
  "__FONT_RUPA_MEDIUM_ITALIC__": "RupaSansApp-MediumItalic.otf",
  "__FONT_RUPA_MEDIUM__": "RupaSansApp-Medium.otf",
  "__FONT_RUPA_REGULAR__": "RupaSansApp-Regular.otf",
  "__FONT_RUPA_SEMIBOLD_ITALIC__": "RupaSansApp-SemiBoldItalic.otf",
  "__FONT_RUPA_SEMIBOLD__": "RupaSansApp-SemiBold.otf",
}

// Converts a local asset into an inline data URI for Figma's static iframe.
function dataUri(filePath, mimeType) {
  const bytes = readFileSync(filePath)
  return `data:${mimeType};base64,${bytes.toString("base64")}`
}

let uiScript = readFileSync(join(tempDir, "ui.js"), "utf8")
for (const [token, asset] of Object.entries(assets)) {
  uiScript = uiScript.replaceAll(
    token,
    dataUri(join(pluginRoot, "assets", asset.fileName), asset.mimeType)
  )
}

let uiCss = cssResult.css
for (const [token, fileName] of Object.entries(fonts)) {
  uiCss = uiCss.replaceAll(
    token,
    dataUri(join(pluginRoot, "assets", "fonts", fileName), "font/otf")
  )
}

const html = readFileSync(join(pluginRoot, "src", "ui.html"), "utf8")
  .replace("<!-- __STYLE__ -->", `<style>${uiCss}</style>`)
  .replace("<!-- __SCRIPT__ -->", `<script>${uiScript}</script>`)

writeFileSync(join(distDir, "ui.html"), html)
rmSync(tempDir, { force: true, recursive: true })

console.log("Built Figma plugin to apps/figma-plugin/dist")
