# Command: New Page

Scaffold a new feature page in `src/pages/`.

## Usage

```
/new-page <FeatureName>
```

## What to Generate

### 1. Page component — `src/pages/<featureName>/<FeatureName>Page.jsx`

```jsx
import { use<FeatureName>List } from '@/api/<featureName>'

export default function <FeatureName>Page() {
  const { data, isLoading, error } = use<FeatureName>List()

  if (isLoading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-destructive">Failed to load.</div>

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold"><FeatureName></h1>
      {/* content */}
    </div>
  )
}
```

### 2. Route entry — `src/App.jsx`

Add inside the `<AppShell>` protected layout:
```jsx
import <FeatureName>Page from '@/pages/<featureName>/<FeatureName>Page'
// ...
<Route path="/<feature-name>" element={<<FeatureName>Page />} />
```

### 3. Sidebar nav item (if needed) — `src/components/sidebar/nav-main.jsx` or `nav-secondary.jsx`

```js
{ title: '<FeatureName>', url: '/<feature-name>', icon: SomeIcon }
```

## Page with Tabs Pattern

If the feature needs sub-tabs (like Finance), create a layout wrapper:

```jsx
// <FeatureName>Layout.jsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function <FeatureName>Layout() {
  return (
    <Tabs defaultValue="overview" className="p-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="detail">Detail</TabsTrigger>
      </TabsList>
      <TabsContent value="overview"><OverviewTab /></TabsContent>
      <TabsContent value="detail"><DetailTab /></TabsContent>
    </Tabs>
  )
}
```
