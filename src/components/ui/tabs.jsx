import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

// `variant="underline"` is the Attio-style tab bar used on pages (#152): a
// transparent bar with a hairline under it, text-sm triggers, gap-8, and an
// active underline. Set it on the list; triggers inherit it (or pass it on a
// trigger to override). The default variant is the pill style.
const TabsVariantContext = React.createContext("default")

function Tabs({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props} />
  );
}

function TabsList({
  className,
  variant = "default",
  ...props
}) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(
          variant === "underline"
            ? "bg-transparent text-muted-foreground inline-flex h-auto w-full items-center justify-start gap-8 rounded-none border-b border-border/40 p-0"
            : "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
          className
        )}
        {...props} />
    </TabsVariantContext.Provider>
  );
}

function TabsTrigger({
  className,
  variant,
  ...props
}) {
  const inherited = React.useContext(TabsVariantContext)
  const resolved = variant ?? inherited
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        resolved === "underline"
          ? "relative inline-flex w-fit flex-none items-center justify-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-sm font-medium whitespace-nowrap text-muted-foreground shadow-none transition-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-x-0 data-[state=active]:border-t-0 data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:text-black data-[state=active]:shadow-none dark:data-[state=active]:border-white dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-white [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          : "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props} />
  );
}

function TabsContent({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props} />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
