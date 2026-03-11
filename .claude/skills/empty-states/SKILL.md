---
name: empty-states
description: >
  Implement consistent empty states across all sections of the Tercero application.
  Use this skill whenever a list, table, tab, card widget, or page has no data to display.
  Triggers on: "empty state", "no data", "nothing to show", "update empty state",
  "add empty state", any section with a list that could have zero items, or when
  a component renders nothing when data is absent.
---

# Empty States in Tercero

## The Two Patterns

There are exactly two empty state patterns in Tercero. Choose based on context:

| Pattern | When to use | Component |
|---|---|---|
| **Compact inline** | Small card widgets on the dashboard | Raw `div` with dashed circle icon |
| **Full section** | Full page lists, tabs within pages, large content areas | `<Empty>` component |

---

## Pattern 1 — Compact Inline (Dashboard Cards)

Use this inside small dashboard widget cards where vertical space is limited.

```jsx
<div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
  <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
    <CalendarIcon className="h-4 w-4" />
  </div>
  <p className="text-sm text-muted-foreground">No upcoming meetings</p>
</div>
```

Rules:
- Dashed circle container (`border border-dashed rounded-full`), `h-10 w-10`
- Icon is `h-4 w-4` inside the circle, `text-muted-foreground`
- Single short label, `text-sm text-muted-foreground`
- No CTA button — the card header already has a `+` button
- `py-8` vertical padding, `flex-1` to fill available card height

---

## Pattern 2 — Full Section (Pages & Tabs)

Use the `<Empty>` component from `@/components/ui/empty` for all full page and tab empty states.

```jsx
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { Plus, SomeIcon } from 'lucide-react'

<Empty className="py-20 border border-dashed rounded-2xl bg-muted/5 animate-in fade-in zoom-in-95 duration-500">
  <EmptyContent>
    <EmptyMedia variant="icon">
      <SomeIcon className="size-6 text-muted-foreground/60" />
    </EmptyMedia>
    <EmptyHeader>
      <EmptyTitle className="font-light text-xl">No Items Yet</EmptyTitle>
      <EmptyDescription className="font-light">
        Helpful sentence explaining what this section is for and how to get started.
      </EmptyDescription>
    </EmptyHeader>
    <Button
      onClick={handleCreate}
      variant="outline"
      className="mt-2 rounded-full px-6 font-medium"
    >
      <Plus className="size-4 mr-2" />
      Create your first item
    </Button>
  </EmptyContent>
</Empty>
```

Rules:
- No animation on the `<Empty>` container — it inherits the page load animation
- `EmptyMedia variant="icon"` — icon is `size-6 text-muted-foreground/60`
- `EmptyTitle` — use `font-light text-xl` for consistency
- `EmptyDescription` — use `font-light`, keep to 1–2 sentences
- Primary CTA button: `variant="outline" size="sm"` — default shape, no `rounded-full`
- "Clear filters" CTA: `variant="link"` with `className="text-primary font-medium"` — never `variant="outline"`
- When filters are active, change the icon to `Search` and swap the CTA to "Clear all filters"

### Filtered vs. unfiltered state

Always show **two versions** of the empty state: one when the list is truly empty, one when filters return no results:

```jsx
const isEmpty = data.length === 0
const isFiltered = Boolean(searchQuery || activeFilter !== 'all')

<Empty ...>
  <EmptyContent>
    <EmptyMedia variant="icon">
      {isFiltered
        ? <Search className="size-6 text-muted-foreground/60" />
        : <SomeIcon className="size-6 text-muted-foreground/60" />}
    </EmptyMedia>
    <EmptyHeader>
      <EmptyTitle className="font-light text-xl">
        {isFiltered ? 'No results found' : 'No items yet'}
      </EmptyTitle>
      <EmptyDescription className="font-light">
        {isFiltered
          ? "No items match your current filters. Try adjusting your search."
          : "You haven't added anything yet. Get started below."}
      </EmptyDescription>
    </EmptyHeader>
    {isFiltered ? (
      <Button variant="link" onClick={clearFilters} className="text-primary font-medium">
        Clear all filters
      </Button>
    ) : (
      <Button onClick={handleCreate} variant="outline" className="mt-2 rounded-full px-6 font-medium">
        <Plus className="size-4 mr-2" />
        Create your first item
      </Button>
    )}
  </EmptyContent>
</Empty>
```

---

## Section-by-Section Reference

### Clients (`/clients`)

- **Icon:** `UserStar` (lucide-react)
- **Title (empty):** `"Ready to scale your agency?"`
- **Description (empty):** `"Onboard your first partner to start managing their content strategy and workflow."`
- **CTA:** `"Onboard Your First Client"` → open create client dialog / navigate to `/clients/create`
- **Title (filtered):** `"No clients match your criteria"`
- **Description (filtered):** `"Adjust your filters or search terms to find specific client profiles."`
- **CTA (filtered):** `"Clear all filters"` (ghost/link)

### Posts (`/posts`)

- **Icon:** `LayoutGrid`
- **Title (empty):** `"No posts yet"`
- **Description (empty):** `"Create your first draft to start building content for your clients."`
- **CTA:** `"New Post"` → open `DraftPostForm` dialog or navigate to draft creation
- **Title (filtered):** `"No posts found"`
- **Description (filtered):** `"No posts match your current filters. Try adjusting your search or filter criteria."`
- **CTA (filtered):** `"Clear filters"` (ghost/link)

### Calendar (`/calendar`)

- **Icon:** `CalendarDays`
- **Title:** `"Nothing scheduled"`
- **Description:** `"No posts are scheduled for this period. Draft a post and pick a date to fill your calendar."`
- **CTA:** `"Schedule a Post"` → open `DraftPostForm` dialog (no filtered variant needed — calendar has date navigation not filters)

### Campaigns (`/campaigns` and `CampaignTab`)

- **Icon:** `Megaphone`
- **Title (empty):** `"No campaigns yet"`
- **Description (empty):** `"Group posts into campaigns to manage initiatives, track budgets, and share review links with clients."`
- **CTA:** `"Create your first campaign"` → open create campaign dialog
- **Title (filtered):** `"No campaigns found"`
- **Description (filtered):** `"We couldn't find any campaigns matching your current filters."`
- **CTA (filtered):** `"Clear all filters"` (link)

### Proposals (`/proposals` and `ProposalTab`)

- **Icon:** `FileText`
- **Title (empty):** `"No proposals yet"`
- **Description (empty):** `"Send your first proposal to a client to outline project scope, pricing, and deliverables."`
- **CTA:** `"Create your first proposal"` → open create proposal dialog
- **Title (filtered/tab):** `"No proposals found"`
- **Description (filtered/tab):** `"No proposals match your current filters."`

### Documents (`/documents` and `DocumentsTab`)

- **Icon (empty):** `FolderOpen`
- **Icon (filtered):** `Search`
- **Title (empty):** `"No documents yet"`
- **Description (empty):** `"Upload a contract, brief, or brand asset to keep everything in one place."`
- **CTA:** None — the upload button lives in the page toolbar, not the empty state
- **Title (filtered):** `"No documents match your filters"`
- **Description (filtered):** `"Adjust your filters to find what you're looking for."`
- **CTA (filtered):** `"Clear all filters"` (ghost)

### Meetings (`/operations/meetings`)

- **Icon:** `Calendar`
- **Title (empty):** `"No meetings scheduled"`
- **Description (empty):** `"Schedule a meeting to stay on top of client calls, check-ins, and reviews."`
- **CTA:** `"Schedule a Meeting"` → open `CreateMeetingDialog`
- **Title (filtered):** `"No meetings found"`
- **Description (filtered):** `"Schedule a new meeting or adjust your filters."`

### Notes (`/operations/notes`)

- **Icon:** `StickyNote`
- **Title (empty):** `"No notes yet"`
- **Description (empty):** `"Capture important reminders, action items, or client instructions here."`
- **CTA:** `"New Note"` → open `CreateNoteDialog`
- **Title (filtered):** `"No notes found"`
- **Description (filtered):** `"No notes match your current filters."`

### Finance — Invoices (`/finance/invoices`)

- **Icon:** `Receipt`
- **Title (empty):** `"No invoices yet"`
- **Description (empty):** `"Generate your first invoice and start tracking client billing."`
- **CTA:** `"New Invoice"` → open create invoice dialog
- **Title (filtered):** `"No invoices found"`
- **Description (filtered):** `"No invoices match your current filters."`

### Finance — Expenses / Ledger (`/finance/ledger`)

- **Icon:** `TrendingDown`
- **Title (empty):** `"No expenses recorded"`
- **Description (empty):** `"Log your agency's spending to keep finances accurate."`
- **CTA:** `"Add Expense"` → open create expense dialog

### Finance — Subscriptions (`/finance/subscriptions`)

- **Icon:** `CreditCard`
- **Title (empty):** `"No subscriptions tracked"`
- **Description (empty):** `"Track recurring software or service costs your agency pays for clients."`
- **CTA:** `"Add Subscription"` → open create subscription dialog

### Team Members (`/settings` → Team tab)

- **Icon:** `Users`
- **Title (empty):** `"Just you for now"`
- **Description (empty):** `"Invite a teammate to collaborate on client accounts and share the workload."`
- **CTA:** `"Copy Invite Link"` → copy the invite link to clipboard (same as the existing invite button in the header)
- Note: No filtered variant — team list has no search/filter

### Dashboard — Meetings Widget (compact inline)

- **Icon:** `CalendarIcon` (h-4 w-4)
- **Label:** `"No upcoming meetings"`
- **Pattern:** Compact inline (Pattern 1)

### Dashboard — Notes Widget (compact inline)

- **Icon:** `FileText` (h-4 w-4)
- **Label:** `"No pending notes"`
- **Pattern:** Compact inline (Pattern 1)

---

## Import Reference

```jsx
// Empty state components
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from '@/components/ui/empty'

// Icons — use only these per section
import {
  UserStar,        // clients
  LayoutGrid,      // posts
  CalendarDays,    // calendar page
  CalendarIcon,    // meetings widget + meetings page
  Megaphone,       // campaigns
  FileText,        // proposals, notes widget
  StickyNote,      // notes page
  FolderOpen,      // documents (empty)
  Search,          // documents (filtered) + any filtered state
  Receipt,         // invoices
  TrendingDown,    // expenses
  CreditCard,      // subscriptions
  Users,           // team
  Plus,            // all CTA buttons
} from 'lucide-react'
```

---

## What NOT to do

```jsx
// ❌ Don't use alert() or custom notification state
// ❌ Don't use a different component (e.g. custom EmptyState.jsx) — use <Empty> from ui/
// ❌ Don't omit animate-in on full section empty states
// ❌ Don't use variant="default" or variant="solid" on CTA buttons — use "outline" or "link"
// ❌ Don't show the same text for filtered vs. unfiltered empty states
// ❌ Don't put a CTA in a filtered empty state that creates a new item — use "Clear filters"
// ❌ Don't use emoji or decorative text in empty state copy
// ❌ Don't hardcode colors — use token classes (text-muted-foreground, bg-muted/5, etc.)
```

---

## Checklist when implementing an empty state

- [ ] Identified correct pattern (compact inline vs. full section)
- [ ] Correct icon from the per-section reference above
- [ ] Two versions: truly empty vs. filtered (for sections with search/filter)
- [ ] CTA present when section supports creation and list is truly empty
- [ ] Filtered CTA is "Clear filters" only, never "Create item"
- [ ] `animate-in fade-in zoom-in-95 duration-500` on `<Empty>` container
- [ ] Copy matches tone: concise, benefit-focused, no filler words
- [ ] No hard-coded colors — Tailwind token classes only
