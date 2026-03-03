# Component Conventions

Rules for React components in `src/components/` and `src/pages/`.

## File Naming

- Components: `PascalCase.jsx`
- Hooks: `use<Name>.js` or `use<Name>.jsx`
- Utility functions: `camelCase.js`
- All JSX files use `.jsx` extension (not `.tsx` — project is plain JS)

## Import Aliases

Always use the `@/` alias for imports within `src/`:
```js
import { useAuth } from '@/context/AuthContext'  // correct
import { useAuth } from '../../context/AuthContext'  // avoid
```

## Class Merging

Use `cn()` from `@/lib/utils` whenever combining conditional classes:
```js
import { cn } from '@/lib/utils'
<div className={cn('base-class', isActive && 'active-class', className)} />
```

Do not use string interpolation or manual concatenation for Tailwind classes.

## shadcn/ui Usage

- Import components from `@/components/ui/` (never directly from `@radix-ui/*`)
- Use the `asChild` prop when a shadcn component wraps a custom element
- Do not re-implement what shadcn already provides (Dialog, Select, Tabs, etc.)

## Forms

Every form with user input uses `react-hook-form` + `zod`:
```js
const schema = z.object({ ... })
const form = useForm({ resolver: zodResolver(schema), defaultValues: { ... } })
```

Render fields with `<FormField>` → `<FormItem>` → `<FormLabel>` + `<FormControl>` + `<FormMessage>` so validation messages display automatically.

## Loading & Error States

```jsx
if (isLoading) return <SkeletonVariant />
if (error) return <p className="text-destructive">...</p>
```

Do not render partial UI or silently ignore errors. Always show feedback.

## Notifications

```js
import { toast } from 'sonner'
toast.success('Done')
toast.error(err.message || 'Something went wrong')
```

Never use `alert()` or custom notification state — always use `sonner`.

## Theme & Dark Mode

- `next-themes` is configured; use CSS variable tokens (`text-foreground`, `bg-background`, etc.) rather than hard-coded colors
- `mode-toggle.jsx` is already wired up in the header

## Page Layout

Pages render inside `<AppBody>` via `<Outlet>`. Standard padding:
```jsx
<div className="flex flex-col gap-6 p-6">
```

Do not add extra wrappers that re-implement layout already provided by `AppShell`.

## Icons

Use `lucide-react` exclusively:
```js
import { Plus, Trash2, Pencil } from 'lucide-react'
```

Do not mix in other icon libraries.
