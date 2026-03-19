# Component Inventory — Tercero Design System

All components available in `src/components/ui/`. Always import from `@/components/ui/`.

## shadcn/ui Components

| Component | Import | Notes |
|-----------|--------|-------|
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` | `@/components/ui/accordion` | Collapsible sections |
| `Alert`, `AlertTitle`, `AlertDescription` | `@/components/ui/alert` | Inline alert banners |
| `AlertDialog` + variants | `@/components/ui/alert-dialog` | Blocking confirmation dialogs |
| `AspectRatio` | `@/components/ui/aspect-ratio` | Preserve image ratios |
| `Avatar`, `AvatarImage`, `AvatarFallback` | `@/components/ui/avatar` | User/entity avatars |
| `Badge` | `@/components/ui/badge` | Status chips, tags |
| `Breadcrumb` + variants | `@/components/ui/breadcrumb` | Page breadcrumbs |
| `Button` | `@/components/ui/button` | All button types |
| `Calendar` | `@/components/ui/calendar` | Date picker calendar |
| `Card`, `CardHeader`, `CardContent`, `CardFooter`, `CardTitle`, `CardDescription`, `CardAction` | `@/components/ui/card` | Card containers |
| `Carousel` + variants | `@/components/ui/carousel` | Image/content carousels |
| `ChartContainer`, `ChartTooltip`, `ChartLegend` | `@/components/ui/chart` | Recharts wrapper |
| `Checkbox` | `@/components/ui/checkbox` | Checkboxes |
| `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | `@/components/ui/collapsible` | Collapsible content |
| `Command` + variants | `@/components/ui/command` | Command palette / search |
| `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` | `@/components/ui/dialog` | Modal dialogs |
| `Drawer` + variants | `@/components/ui/drawer` | Bottom drawers (mobile) |
| `DropdownMenu` + variants | `@/components/ui/dropdown-menu` | Dropdown menus |
| `Empty`, `EmptyContent`, `EmptyMedia`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription` | `@/components/ui/empty` | Empty states |
| `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`, `FormDescription` | `@/components/ui/form` | Form scaffolding |
| `HoverCard`, `HoverCardTrigger`, `HoverCardContent` | `@/components/ui/hover-card` | Hover info cards |
| `Input` | `@/components/ui/input` | Text inputs |
| `InputOTP` + variants | `@/components/ui/input-otp` | OTP / PIN inputs |
| `Label` | `@/components/ui/label` | Form labels |
| `Menubar` + variants | `@/components/ui/menubar` | Menubar navigation |
| `NavigationMenu` + variants | `@/components/ui/navigation-menu` | Nav menus |
| `Pagination` + variants | `@/components/ui/pagination` | Page pagination |
| `Popover`, `PopoverTrigger`, `PopoverContent` | `@/components/ui/popover` | Anchored popovers |
| `Progress` | `@/components/ui/progress` | Progress bars |
| `RadioGroup`, `RadioGroupItem` | `@/components/ui/radio-group` | Radio buttons |
| `Resizable` + variants | `@/components/ui/resizable` | Resizable panels |
| `ScrollArea`, `ScrollBar` | `@/components/ui/scroll-area` | Scrollable containers |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `SelectGroup`, `SelectLabel` | `@/components/ui/select` | Dropdown selects |
| `Separator` | `@/components/ui/separator` | Horizontal/vertical dividers |
| `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetFooter` | `@/components/ui/sheet` | Side panels |
| `Sidebar` + variants | `@/components/ui/sidebar` | App sidebar |
| `Skeleton` | `@/components/ui/skeleton` | Loading placeholders |
| `Slider` | `@/components/ui/slider` | Range sliders |
| `Switch` | `@/components/ui/switch` | Toggle switches |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`, `TableFooter` | `@/components/ui/table` | Data tables |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `@/components/ui/tabs` | Tab navigation |
| `Textarea` | `@/components/ui/textarea` | Multiline inputs |
| `Toggle`, `ToggleGroup`, `ToggleGroupItem` | `@/components/ui/toggle` / `toggle-group` | Toggle buttons |
| `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` | `@/components/ui/tooltip` | Hover tooltips |

## Custom Tercero Components

| Component | Path | Purpose |
|-----------|------|---------|
| `StatusBadge` | `@/components/misc/StatusBadge` | Post/item status with semantic colors |
| `PlatformBadge` | `@/components/misc/PlatformBadge` | Social platform chips |
| `CustomTable` | `@/components/misc/CustomTable` | Column-defined data table with loading/empty |
| `TierBadge` | `@/components/misc/TierBadge` | Client subscription tier |
| `IndustryBadge` | `@/components/misc/IndustryBadge` | Client industry chip |
| `PlatformStack` | `@/components/misc/PlatformStack` | Stacked platform icon row |
| `AppShell` | `@/components/AppShell` | Main layout shell (sidebar + header) |
| `AppSidebar` | `@/components/AppSidebar` | Navigation sidebar |

## Utility Functions

```jsx
import { cn } from '@/lib/utils'           // Class merging
import { formatDate } from '@/lib/helper'  // "2 Jan, 2026"
import { formatFileSize } from '@/lib/helper' // "2.3 MB"
import { getUrgencyStatus } from '@/lib/client-helpers' // Urgency color/label
import { resolveWorkspace } from '@/lib/workspace' // For mutations needing workspaceUserId
```

## Icon Usage

Always import from `lucide-react`:

```jsx
import { Plus, Trash2, Pencil, MoreHorizontal, Search, Filter,
         Download, Upload, Eye, Lock, Check, X, ChevronDown,
         ChevronRight, Calendar, Clock, Users, Building2,
         TrendingUp, FileText, Newspaper, LayoutGrid,
         TableProperties, Settings, Bell, LogOut } from 'lucide-react'
```

Standard icon sizes:
- `size-3` (12px) — micro icons in labels
- `size-4` (16px) — icons inside buttons (standard)
- `size-5` (20px) — standalone icons
- `size-6` (24px) — empty state icons, section icons
- `size-8` (32px) — feature hero icons
