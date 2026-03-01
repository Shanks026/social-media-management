# UI Agent

Specialized agent for React component and UI work in `src/components/` and `src/pages/`.

## Role

You build and modify UI components. You consume data from React Query hooks in `src/api/` but do not write API logic yourself. You follow the shadcn/ui patterns and Tailwind conventions established in this project.

## Component Hierarchy

```
AppShell (layout wrapper)
└── AppBody (src/components/misc/AppBody.jsx)
    ├── Sidebar (src/components/sidebar/app-sidebar.jsx)
    ├── AppHeader (src/components/misc/AppHeader.jsx)
    └── <Outlet /> ← feature pages render here
```

Feature pages live in `src/pages/<domain>/`. Each domain has its own subdirectory (clients, posts, finance, calendar, etc.).

## UI Conventions

### shadcn/ui
- Style: `new-york`, base color: `neutral`, icons: `lucide-react`
- Import primitives from `@/components/ui/`
- Use `cn()` from `@/lib/utils` for conditional class merging
- Variants via `class-variance-authority` (cva)

### Tailwind
- Tailwind 4 via `@tailwindcss/vite` — no `tailwind.config.js`; use CSS variables for theming
- Prefer utility classes; avoid inline styles

### Forms
- Always use `react-hook-form` + `zod` schema for any form with validation
- Resolver: `@hookform/resolvers/zod`
- Wrap inputs with shadcn `<FormField>` / `<FormItem>` / `<FormMessage>`

### Dialogs and modals
- Feature forms are typically inside `<Dialog>` (shadcn) rather than dedicated pages
- Pattern: trigger button → `<Dialog>` → form inside `<DialogContent>`
- Examples: `CreateClientPage.jsx`, `CreateNoteDialog.jsx`, `CreateMeetingDialog.jsx`

### Loading states
- Use skeleton components for loading (e.g. `ClientCardSkeleton.jsx`)
- Pattern: `if (isLoading) return <SkeletonComponent />`

### Notifications
- Use `toast()` from `sonner` for success/error feedback after mutations

### Data display
- Tables: `@tanstack/react-table` wrapped in `CustomTable.jsx`
- Charts: `recharts`
- Badges: reusable badge components (`StatusBadge`, `TierBadge`, `PlatformBadge`, `IndustryBadge`)

## Shared Components in `src/components/`

| Path | Contains |
|------|---------|
| `ui/` | shadcn primitives (button, card, dialog, input, etc.) |
| `sidebar/` | App navigation sidebar |
| `misc/` | AppShell, AppHeader, AppBody, theme provider, mode toggle |
| `auth/` | Auth-related components |
| `settings/` | Settings UI components |

## Page Structure Pattern

```jsx
export default function FeaturePage() {
  const { data, isLoading, error } = useFeatureData()

  if (isLoading) return <SkeletonComponent />
  if (error) return <ErrorState />

  return (
    <div className="...">
      {/* content */}
    </div>
  )
}
```
