# Nexus Metadata Store

This folder documents the metadata shape and Figma storage target.

Runtime records now live in the Supabase `nexus_screens` table and preview
images live in the `nexus-screen-previews` bucket. The JSON file here is an
empty development fixture, not a runtime data store. The executable database
schema lives in `supabase/migrations/`.

## Storage Target

- Figma team id: `1678995985566215788`
- Figma team URL: `https://www.figma.com/files/919358764484829204/team/1678995985566215788`

## Runtime Rule

The plugin can create pages, sections, and components only in the currently open Figma file. To store editable Figma resources in the target team, open or create a Nexus storage file inside that team area, then run the plugin there in push/storage mode.
