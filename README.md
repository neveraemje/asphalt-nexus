# Asphalt Nexus

Gojek source-of-truth screen gallery built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui.

## Repo Structure

```text
app/                 Website routes
components/          Website components and shadcn/ui primitives
data/nexus/          Repo-local metadata schema and storage target config
lib/                 Website data, utilities, and integrations
public/              Website static assets
apps/figma-plugin/   Figma plugin runtime, manifest, and build output
supabase/             Database migration and intentional reset script
```

## Website

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

The website and Figma plugin read the same `nexus_screens` records from
Supabase. Copy `.env.example` to `.env.local`, add the project's publishable
key, and run the migration in `supabase/migrations/` before starting either app.

## Scripts

```bash
npm run lint
npm run build
npm run build:web
npm run figma:check
npm run figma:build
```

## Figma Plugin

The plugin UI is a React + TypeScript app compiled with Tailwind CSS and local shadcn-style primitives. Build the plugin, then import `apps/figma-plugin/manifest.json` in Figma via Plugins > Development > Import plugin from manifest.

The plugin stores pushed metadata and preview images in Supabase. Figma
`clientStorage` is cleared once and is no longer used as the catalog. Rebuild
the plugin whenever the Supabase environment values change.

To intentionally remove every Nexus database record and preview, run
`supabase/clear-nexus-data.sql` in the Supabase SQL editor.
