# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start Vite dev server with HMR
npm run build         # Production build
npm run lint          # Run ESLint
npm run preview       # Preview production build locally
npm test              # Run tests once (vitest run)
npm run test:watch    # Run tests in watch mode
```

Tests use **Vitest** + jsdom. Test files live in `src/tests/`. Run a single file: `npx vitest run src/tests/campaigns/phase1.test.jsx`.

## What This Is

**Tercero** — a React 19 + Supabase SPA for social media agency management. Client-side only (no SSR). The `@` alias maps to `./src`. Plain JavaScript throughout — no TypeScript.

Full architecture reference: **`.claude/CLAUDE.md`** (auto-loaded). Feature planning docs and implementation checklists: **`.claude/features/`**.

## The Most Important Things to Know

### Multi-tenant workspace model
Every team member shares the same `workspaceUserId` (the agency owner's UID). **Never use `user.id` for DB queries** — always use `workspaceUserId` from `useAuth()` or `resolveWorkspace()`. The `get_my_agency_user_id()` SQL function enforces this in RLS policies.

### API layer split
- **Reads** → React Query hooks (`useXxxList()`, `useXxxById()`) in `src/api/`
- **Mutations** → plain async functions (`createXxx`, `updateXxx`, `deleteXxx`) called via `useMutation`
- Never call `supabase` directly inside components — everything goes through `src/api/`

### Feature gating
Use `useSubscription()` from `src/api/useSubscription.js` for all plan/tier checks. Never query `agency_subscriptions` directly. Canonical feature matrix: `documentation/subscription-features.md`.

### Reusable tab pattern
Feature tabs (`CampaignTab`, `DocumentsTab`, etc.) accept an optional `clientId` prop. Without it they show all records (global page); with it they scope to that client (used inside `ClientProfileView`).

### Storage buckets
- `post-media` — post attachments (public URLs)
- `client-documents` — client file storage (signed URLs, private)
- `note-media` — note image/video uploads (signed URLs, private, 50 MB limit)

### Notes editor
Tiptap v2 with custom nodes in `src/components/notes/editor/`. Slash commands via `slash-command.js`. Custom nodes: `TableContainer`, `TableTitle`, `ImageNode` (with drag-to-resize), `VideoNode` (with width presets). Node content persisted as Tiptap JSON in `notes.body`. Auto-save via `dirtyRef` + debounced `scheduleSave` — tag mutations deliberately bypass this.

## Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_APP_URL   # Base URL for invite links
```
