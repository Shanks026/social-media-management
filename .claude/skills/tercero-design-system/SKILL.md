---
name: tercero-design-system
description: Comprehensive design system reference for Tercero and admin-tercero. Use this skill whenever building new UI components, pages, or features for the Tercero application or the admin-tercero internal CRM — including when implementing layouts, choosing typography, applying spacing, building cards, modals, tables, forms, empty states, or any visual pattern. Triggers on: "build a page", "create a component", "add a card", "design a modal", "add a table", "build a form", "add an empty state", "what's the pattern for", "how do we style", "create the admin", "admin-tercero", or any request involving new UI work in Tercero or admin-tercero. Always use this skill before writing any visual code — the design system must be followed precisely to maintain consistency.
---

# Tercero Design System

This is the authoritative design reference for **Tercero** (the main SaaS app at `d:/Tertiary`) and **admin-tercero** (the internal CRM). Follow these patterns exactly when building any UI.

---

## Tech Stack

- **React 19** + React Router 7
- **Tailwind CSS 4** — utility-first, CSS variable tokens
- **shadcn/ui** (new-york style, neutral base) — import all UI components from `@/components/ui/`
- **lucide-react** — icons only (no other icon libraries)
- **Google Sans** — primary font (loaded in index.html via Google Fonts)
- `cn()` from `@/lib/utils` — always use for conditional class merging

---

## Quick Reference

| Element | Pattern |
|---------|---------|
| Page container | `p-8 max-w-[1400px] mx-auto space-y-6` |
| Page title | `text-3xl font-light tracking-tight` |
| Page subtitle | `text-sm text-muted-foreground font-light` |
| Count indicator | `text-muted-foreground/50 ml-2 font-extralight` |
| Section heading | `text-2xl font-medium` |
| Card title | `text-base font-semibold` |
| Card grid | `grid gap-6 grid-cols-[repeat(auto-fill,minmax(420px,1fr))]` |
| Muted label | `text-xs text-muted-foreground` |
| Tab style | underline variant — see [Tabs section](#tabs) |
| Empty state | `<Empty>` component — see [Empty States section](#empty-states) |
| Icon size standard | `size-4` (16px) in buttons, `size-5` (20px) standalone |

---

## Typography

**Font:** Google Sans (primary), system-ui fallback.

```jsx
// Page title — always font-light
<h1 className="text-3xl font-light tracking-tight">
  Clients{' '}
  <span className="text-muted-foreground/50 ml-2 font-extralight">{count}</span>
</h1>

// Page subtitle
<p className="text-sm text-muted-foreground font-light">
  Manage all posts across your organization
</p>

// Section heading
<h2 className="text-2xl font-medium tracking-tight">Section Name</h2>

// Card/dialog title
<h3 className="text-base font-semibold text-foreground truncate">Card Title</h3>

// Body text
<p className="text-sm text-foreground">Normal body text</p>

// Muted secondary text
<p className="text-sm text-muted-foreground">Secondary information</p>

// Micro label
<span className="text-xs text-muted-foreground">Label or meta info</span>

// Truncating text in constrained containers
<p className="text-sm font-medium truncate">{title}</p>
<p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
```

**Weight scale:**
- `font-extralight` — count/stat decorators only
- `font-light` — page H1 titles
- `font-normal` — body text (default)
- `font-medium` — labels, nav items, tab triggers, secondary headings
- `font-semibold` — card titles, emphasis, dialog titles

---

## Colors

All colors use CSS custom properties (oklch). Never hardcode hex values for structural colors — use Tailwind tokens.

```
--foreground        → text-foreground (primary text)
--muted-foreground  → text-muted-foreground (secondary/disabled text)
--background        → bg-background (page background)
--card              → bg-card (card surface)
--muted             → bg-muted (subtle backgrounds, hover states)
--border            → border-border (borders)
--primary           → bg-primary / text-primary (actions)
--destructive       → bg-destructive / text-destructive (danger)
--accent            → bg-accent (hover accent)
```

**Semantic status colors** (always use bg-*/text-* pattern with dark mode variants):

```jsx
// Status colors used throughout the app
DRAFT:     'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400'
PENDING:   'bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400'
SCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-400'
PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400'
REVISIONS: 'bg-pink-100 text-pink-800 dark:bg-pink-500/10 dark:text-pink-400'
ARCHIVED:  'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400'
ERROR:     'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400'
```

**Chart colors** (for data visualization):
- `--chart-1`: orange
- `--chart-2`: blue
- `--chart-3`: purple
- `--chart-4`: yellow
- `--chart-5`: red

---

## Page Layout

```jsx
// Standard page wrapper
<div className="p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">

  {/* Header row */}
  <div className="flex items-center justify-between">
    <div className="space-y-1">
      <h1 className="text-3xl font-light tracking-tight">
        Page Title
        <span className="text-muted-foreground/50 ml-2 font-extralight">{count}</span>
      </h1>
      <p className="text-sm text-muted-foreground font-light">Page description</p>
    </div>
    <div className="flex items-center gap-3">
      {/* Primary action button */}
      <Button className="gap-2 h-9">
        <Plus size={16} />
        New Item
      </Button>
    </div>
  </div>

  {/* Tabs (if feature has tabs) */}
  {/* ... see Tabs section */}

  {/* Filter/search row */}
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div className="relative w-full sm:max-w-sm">
      {/* Search input */}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      {/* Filter controls */}
    </div>
  </div>

  {/* Content: card grid or table */}
  <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(420px,1fr))]">
    {items.map(item => <ItemCard key={item.id} {...item} />)}
  </div>
</div>
```

**Alternative (when extra bottom padding needed):**
```jsx
<div className="px-8 pt-8 pb-20 space-y-8 max-w-[1400px] mx-auto">
```

**Page fade-in animation:** always add `animate-in fade-in duration-500` on the page wrapper.

---

## Cards

See `references/cards.md` for full examples.

**Base card:**
```jsx
<Card className="shadow-none">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>Title</CardTitle>
      <CardAction><Button variant="ghost" size="icon-sm">...</Button></CardAction>
    </div>
    <CardDescription>Optional subtitle</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

**Interactive (clickable) card:**
```jsx
<Card
  onClick={() => onOpen(item)}
  className={cn(
    'group cursor-pointer shadow-none transition-all duration-200 border',
    'hover:bg-accent/30 dark:hover:bg-card',
    'dark:bg-card/70 dark:border-none',
  )}
>
  <CardContent className="p-7 flex flex-col gap-5 h-full">
    {/* ... */}
  </CardContent>
</Card>
```

**Card section dividers** (use dashed borders for sub-sections within a card):
```jsx
<div className="pt-5 border-t border-dashed border-border/50">
```

**Logo/avatar in cards:**
```jsx
<div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
  {logo ? (
    <img src={logo} alt="" className="w-full h-full object-cover" />
  ) : (
    <span className="text-lg font-semibold text-muted-foreground">
      {name?.charAt(0).toUpperCase()}
    </span>
  )}
</div>
```

---

## Tabs

The standard tab style across Tercero is the **underline variant** — not the default pill/box style.

```jsx
<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
  <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-8 border-b border-border/40">
    {TABS.map((tab) => (
      <TabsTrigger
        key={tab.key}
        value={tab.key}
        className={cn(
          'relative rounded-none bg-transparent px-0 pb-3 pt-0',
          'text-[13px] font-medium transition-none shadow-none',
          'border-b-2 border-transparent text-muted-foreground',
          'flex-none w-fit gap-2',
          'data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent',
          'data-[state=active]:text-black dark:data-[state=active]:text-white',
          'data-[state=active]:border-black dark:data-[state=active]:border-white',
          'data-[state=active]:shadow-none data-[state=active]:border-x-0 data-[state=active]:border-t-0',
          'focus-visible:ring-0',
        )}
      >
        {tab.icon && <tab.icon className="size-4" />}
        {tab.label}
        {tab.count > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-[20px] text-center">
            {tab.count}
          </Badge>
        )}
      </TabsTrigger>
    ))}
  </TabsList>

  <TabsContent
    value="tab-key"
    className="mt-2 focus-visible:ring-0 outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:duration-300"
  >
    {/* Tab content */}
  </TabsContent>
</Tabs>
```

---

## Dialogs / Modals

```jsx
// Standard form dialog
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Optional description line.</DialogDescription>
    </DialogHeader>

    {/* Form or content */}
    <div className="space-y-4">
      {/* ... */}
    </div>

    <DialogFooter>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleSubmit}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Delete confirmation dialog
<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
  <DialogContent onClick={(e) => e.stopPropagation()}>
    <DialogHeader>
      <DialogTitle>Confirm Deletion</DialogTitle>
      <DialogDescription>
        Remove <span className="font-bold">{item.name}</span>? This cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleDelete}>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Large form dialog (tall content)
<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
```

---

## Buttons

```jsx
// Primary action (page-level)
<Button className="gap-2 h-9">
  <Plus size={16} />
  New Item
</Button>

// Outline secondary
<Button variant="outline" size="sm">
  <Download className="size-4 mr-2" />
  Export
</Button>

// Ghost icon button (table/card actions)
<Button variant="ghost" size="icon" className="size-8">
  <MoreHorizontal size={16} />
</Button>

// Destructive
<Button variant="destructive">Delete</Button>

// Link-style (reset/clear actions)
<Button variant="link" className="text-primary font-medium">Clear filters</Button>

// Disabled/locked state with icon
<Button disabled className="gap-2">
  <Lock className="h-4 w-4" />
  Upgrade Required
</Button>
```

**Sizes:** `xs` (h-6), `sm` (h-8), default (h-9), `lg` (h-10)
**Icon sizes:** `icon-xs` (size-6), `icon-sm` (size-8), `icon` (size-9), `icon-lg` (size-10)

---

## Badges

```jsx
// Count badge (on tabs)
<Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-[20px] text-center">
  {count}
</Badge>

// Status badge — use <StatusBadge status={...} /> component
import { StatusBadge } from '@/components/misc/StatusBadge'
<StatusBadge status="DRAFT" />

// Platform badge — use <PlatformBadge platform={...} /> component
import { PlatformBadge } from '@/components/misc/PlatformBadge'
<PlatformBadge platform="instagram" />

// Small metadata badge
<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
  Internal
</Badge>
```

---

## Forms

All forms use **React Hook Form + Zod**. Always use the `<Form>` / `<FormField>` / `<FormItem>` pattern — never raw `<input>` elements.

```jsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
})

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { name: '', email: '' },
})

return (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="Enter name..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Two-column form row */}
      <div className="grid grid-cols-2 gap-4">
        <FormField name="field1" ... />
        <FormField name="field2" ... />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  </Form>
)
```

**Select field:**
```jsx
<FormField name="status" render={({ field }) => (
  <FormItem>
    <FormLabel>Status</FormLabel>
    <Select onValueChange={field.onChange} defaultValue={field.value}>
      <FormControl>
        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
      </FormControl>
      <SelectContent>
        <SelectItem value="active">Active</SelectItem>
      </SelectContent>
    </Select>
    <FormMessage />
  </FormItem>
)} />
```

---

## Tables

Use the `<CustomTable>` component (`src/components/misc/CustomTable.jsx`) for all data tables.

```jsx
import CustomTable from '@/components/misc/CustomTable'

const columns = [
  {
    header: 'Name',
    width: '200px',
    render: (item) => (
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <User className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.email}</p>
        </div>
      </div>
    ),
  },
  {
    header: 'Status',
    width: '140px',
    render: (item) => <StatusBadge status={item.status} />,
  },
  {
    header: 'Actions',
    width: '80px',
    cellClassName: 'text-right',
    render: (item) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(item)}>Edit</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item)}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

<CustomTable
  columns={columns}
  data={items}
  isLoading={isLoading}
  onRowClick={(item) => navigate(`/items/${item.id}`)}
/>
```

---

## Empty States

Always use the `<Empty>` component family — never render nothing or a plain "No data" string.

```jsx
import { Empty, EmptyContent, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

// Standard empty state
<Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
  <EmptyContent>
    <EmptyMedia variant="icon">
      <FileText className="size-6 text-muted-foreground/60" />
    </EmptyMedia>
    <EmptyHeader>
      <EmptyTitle className="font-normal text-xl">No items yet</EmptyTitle>
      <EmptyDescription className="font-light">
        Create your first item to get started.
      </EmptyDescription>
    </EmptyHeader>
    <Button variant="outline" size="sm" onClick={onCreate}>
      <Plus className="size-4 mr-2" />
      New Item
    </Button>
  </EmptyContent>
</Empty>

// Filter-context empty state (always provide both variants)
<Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
  <EmptyContent>
    <EmptyMedia variant="icon">
      {hasFilters
        ? <Search className="size-6 text-muted-foreground/60" />
        : <FileText className="size-6 text-muted-foreground/60" />}
    </EmptyMedia>
    <EmptyHeader>
      <EmptyTitle className="font-normal text-xl">
        {hasFilters ? 'No results found' : 'No items yet'}
      </EmptyTitle>
      <EmptyDescription className="font-light">
        {hasFilters
          ? 'Try adjusting your filters or search terms.'
          : 'Create your first item to get started.'}
      </EmptyDescription>
    </EmptyHeader>
    {hasFilters ? (
      <Button variant="link" onClick={resetFilters} className="text-primary font-medium">
        Clear filters
      </Button>
    ) : (
      <Button variant="outline" size="sm" onClick={onCreate}>
        <Plus className="size-4 mr-2" />
        New Item
      </Button>
    )}
  </EmptyContent>
</Empty>
```

---

## Loading States

```jsx
// Card grid skeleton
{isLoading && (
  <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(420px,1fr))]">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="rounded-xl border overflow-hidden bg-card/50">
        <Skeleton className="h-32 w-full" />
        <div className="p-6 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
)}

// Page-level loading (simple)
if (isLoading) return (
  <div className="p-8 animate-pulse text-muted-foreground text-sm">
    Loading...
  </div>
)

// Full-screen loader (only for app-level)
<div className="flex h-screen w-full items-center justify-center bg-background">
  <span className="text-sm font-medium tracking-wide text-muted-foreground">
    Loading...
  </span>
</div>
```

---

## Notifications

Always use `sonner` — never `alert()` or custom state:

```jsx
import { toast } from 'sonner'

toast.success('Item created successfully')
toast.error(error.message || 'Something went wrong')
toast.loading('Saving...') // returns id
toast.dismiss(toastId)
```

---

## Spacing Reference

| Scale | Value | Common use |
|-------|-------|------------|
| `gap-2` | 8px | Icon + text in buttons |
| `gap-3` | 12px | Toolbar button groups |
| `gap-4` | 16px | Form fields, filter rows |
| `gap-5` | 20px | Card internal sections |
| `gap-6` | 24px | Card grid columns |
| `gap-8` | 32px | Tab triggers spacing |
| `p-6` | 24px | Card padding (via shadcn default) |
| `p-7` | 28px | Interactive card content |
| `p-8` | 32px | Page container |
| `space-y-4` | 16px stacked | Form field stacks |
| `space-y-6` | 24px stacked | Page sections |
| `space-y-8` | 32px stacked | Page top-level sections |

---

## Available shadcn/ui Components

All in `@/components/ui/`. Refer to `references/components.md` for full list.

Key components: `Button`, `Badge`, `Card`+variants, `Dialog`+variants, `Form`+variants, `Input`, `Textarea`, `Select`+variants, `Tabs`+variants, `Table`+variants, `Skeleton`, `Tooltip`, `DropdownMenu`+variants, `Popover`, `Calendar`, `Checkbox`, `Switch`, `Avatar`, `Separator`, `Sheet`, `Alert`, `Progress`, `Empty`+variants, `ScrollArea`, `Command`

---

## Reference Files

For detailed patterns and more examples:

- `references/cards.md` — card variants, client card anatomy, metric cards
- `references/components.md` — full component inventory and import paths
- `references/admin-tercero.md` — specific guidance for building admin-tercero

---

## Rules

1. Always import from `@/components/ui/` — never from `@radix-ui/*` directly
2. Always use `cn()` for conditional classes
3. Always use `lucide-react` icons — no other icon libraries
4. Always use `react-hook-form` + `zod` for forms
5. Always use `sonner` for notifications
6. Always provide empty states for lists that can be empty
7. Always provide skeleton loading states that match the content shape
8. Dark mode: use CSS token classes (`text-foreground`, `bg-muted`, etc.) — never hardcode colors for structural elements
9. Semantic status colors use the `bg-*/10 dark:` pattern for dark mode
10. Page max-width: always `max-w-[1400px] mx-auto`
