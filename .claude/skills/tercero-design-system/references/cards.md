# Card Patterns — Tercero Design System

## Base Card (shadcn defaults)

```jsx
// card.jsx base classes
"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm"

// CardHeader: px-6
// CardContent: px-6
// CardFooter: px-6
// CardTitle: leading-none font-semibold
// CardDescription: text-muted-foreground text-sm
// CardAction: col-start-2 row-span-2 flex items-center self-center
```

## Shadow Variants

```jsx
// Default shadcn card (has shadow-sm)
<Card>...</Card>

// No shadow (most common in Tercero)
<Card className="shadow-none">...</Card>

// Elevated (for overlays/hover states)
<Card className="shadow-md">...</Card>
```

## Clickable / Interactive Card

The standard pattern for entity cards (clients, posts, documents, etc.):

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
    {/* Section 1: Identity (logo/avatar + name + badges) */}
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
        {item.logo ? (
          <img src={item.logo} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-semibold text-muted-foreground">
            {item.name?.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-base font-semibold text-foreground truncate">{item.name}</h3>
          <Badge variant="secondary">Tag</Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
      </div>
    </div>

    {/* Section 2: Stats / pipeline (separated by dashed border) */}
    <div className="pt-5 border-t border-dashed border-border/50">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <StatItem label="Active" count={5} colorClass="bg-blue-500" />
        <StatItem label="Pending" count={2} colorClass="bg-orange-500" />
      </div>
    </div>

    {/* Section 3: Metrics grid */}
    <div className="pt-5 border-t border-dashed border-border/50 grid grid-cols-3 gap-4">
      <MetricItem icon={TrendingUp} label="Revenue" value="$4,200" />
      <MetricItem icon={Calendar} label="Posts" value="24" />
      <MetricItem icon={Users} label="Team" value="3" />
    </div>

    {/* Footer: push to bottom with mt-auto */}
    <div className="mt-auto flex items-center justify-between pt-5 border-t border-dashed border-border/50">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="size-3" />
        <span>Next post in 2 days</span>
      </div>
      <Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); /* action */ }}>
        <MoreHorizontal className="size-4" />
      </Button>
    </div>
  </CardContent>
</Card>
```

## Stat Item Pattern (used in pipeline stats)

```jsx
function StatItem({ count, label, colorClass }) {
  if (!count) return null
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('size-2 rounded-full', colorClass)} />
      <span className="text-sm font-semibold">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
```

## Metric Item Pattern (used in stats rows)

```jsx
function MetricItem({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3" />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  )
}
```

## KPI / Stats Card (Dashboard style)

```jsx
<Card className="shadow-none">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
      <div className="size-8 rounded-lg bg-muted flex items-center justify-center">
        <DollarSign className="size-4 text-muted-foreground" />
      </div>
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-semibold">$12,420</div>
    <p className="text-xs text-muted-foreground mt-1">
      <span className="text-emerald-600">+12%</span> from last month
    </p>
  </CardContent>
</Card>
```

## Chart Card

```jsx
<Card className="shadow-none">
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <CardTitle>Revenue & Expenses</CardTitle>
        <CardDescription>Monthly breakdown for 2026</CardDescription>
      </div>
      <Button variant="ghost" size="sm">
        <Download className="size-4 mr-2" />
        Export
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data}>
        {/* ... */}
      </BarChart>
    </ChartContainer>
  </CardContent>
</Card>
```

## Internal / Variant Cards

For "internal account" or special-state cards (dashed border, muted background):

```jsx
<Card
  className={cn(
    'shadow-none border',
    isSpecial
      ? 'bg-muted/30 dark:bg-card dark:border-border border-dashed'
      : 'dark:bg-card/70 dark:border-none',
  )}
>
```

## Card Grid Layouts

```jsx
// Standard auto-fill grid (most feature pages)
<div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(420px,1fr))]">

// Smaller cards (e.g. documents)
<div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">

// Dashboard KPI row (responsive)
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

// Two-column detail layout
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">{/* Main content */}</div>
  <div>{/* Sidebar */}</div>
</div>
```
