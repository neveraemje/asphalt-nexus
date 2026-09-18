# Asphalt Nexus Figma Plugin

This app is the Figma runtime for Asphalt Nexus. It is separate from the Next.js website because Figma plugins run inside the Figma editor, not inside a Next server.

## Structure

```text
apps/figma-plugin/
  manifest.json       Figma plugin manifest
  src/code.ts         Figma sandbox/controller code
  src/ui.tsx          React plugin iframe UI
  src/ui.css          Tailwind entrypoint and design tokens
  src/ui.html         HTML shell used by the build script
  assets/             Local screen assets inlined at build time
  dist/               Generated plugin files loaded by Figma
```

## Editable Storage

The configured editable storage file is:

```text
Storage
https://www.figma.com/design/vWUo18fZOLZqCHtTG7fqb2/Storage?node-id=0-1&t=54e6bBS005U4u6sk-1
```

Push exports the selected Figma node as a preview image, uploads it to the
`nexus-screen-previews` Supabase bucket, writes its metadata to
`nexus_screens`, and saves a direct Figma URL for the selected node.

When Push runs inside this storage file, the plugin also creates an editable component copy immediately using this structure:

```text
Page: Feature name
  Section: Team name
    Component: Team name / Screen name
```

When Push runs outside this storage file, the record is saved as
`pending_storage`. The website and every installed copy of the plugin read the
same Supabase records.

Pull opens the saved Figma URL for the pushed screen. This is the reliable link-based flow while editable cross-file copy remains unavailable in the Figma plugin API.

## Commands

```bash
npm run figma:check
npm run figma:build
```

The build reads `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the repo root `.env.local` and embeds
those public settings into `dist/code.js`.

After `npm run figma:build`, import `apps/figma-plugin/manifest.json` in Figma via Plugins > Development > Import plugin from manifest.
