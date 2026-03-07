# Tercero — Common Data Patterns

Reference for Claude Code when building new features. These are the established
patterns in the codebase — follow them exactly.

---

## RLS Policy Template

Every new table owned by a user follows this pattern:

```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own [records]"
  ON [table_name] FOR ALL
  USING (user_id = auth.uid());
```

For tables that have a public read path (like the post review token pattern),
add a second policy:

```sql
CREATE POLICY "Public read via token"
  ON [table_name] FOR SELECT
  USING (true);  -- filtered by token in application layer
```

---

## Standard Table Columns

Every new table should include:

```sql
id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

Client-scoped tables also include:

```sql
client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
```

---

## React Query Patterns

### Query Keys

```javascript
// List query — filters as the third element
['feature', 'list', { clientId, status, category }]

// Detail query
['feature', 'detail', id]

// Nested list (e.g. documents inside a collection)
['feature', 'list', { collectionId }]
```

### Hook Pattern

```javascript
// Read hook
export function useFeatureItems({ clientId, status } = {}) {
  return useQuery({
    queryKey: ['feature', 'list', { clientId, status }],
    queryFn: async () => {
      let query = supabase
        .from('feature_table')
        .select('*')
        .eq('user_id', (await supabase.auth.getUser()).data.user.id)
        .order('created_at', { ascending: false });

      if (clientId) query = query.eq('client_id', clientId);
      if (status)   query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
    retry: 1,
  });
}

// Mutation hook
export function useCreateFeatureItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('feature_table')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature', 'list'] });
    },
  });
}
```

---

## Storage Patterns

### Private bucket (documents, sensitive files)

```javascript
// Upload
const storagePath = `${userId}/${clientId}/${recordId}/${filename}`;
const { error } = await supabase.storage
  .from('bucket-name')
  .upload(storagePath, file);

// Signed URL for download/preview (60 min expiry)
const { data } = await supabase.storage
  .from('bucket-name')
  .createSignedUrl(storagePath, 3600);
return data.signedUrl;

// Delete
await supabase.storage
  .from('bucket-name')
  .remove([storagePath]);
```

### Public bucket (post media, logos)

```javascript
// Upload
const { data } = await supabase.storage
  .from('post-media')
  .upload(storagePath, file, { upsert: true });

// Public URL (no expiry)
const { data: { publicUrl } } = supabase.storage
  .from('post-media')
  .getPublicUrl(storagePath);
```

---

## Storage Usage Tracking

When a feature uses file storage, update `current_storage_used` on `agency_subscriptions`:

```javascript
// On upload success — use an RPC to avoid race conditions
await supabase.rpc('increment_storage_used', {
  p_user_id: userId,
  p_bytes: fileSizeBytes,
});

// On delete success
await supabase.rpc('decrement_storage_used', {
  p_user_id: userId,
  p_bytes: fileSizeBytes,
});
```

The `decrement_storage_used` RPC must use `GREATEST(0, current_storage_used - p_bytes)`
to prevent negative values.

---

## Public Token Pattern

Used for unauthenticated access (post review, future: document sharing, proposals).

```sql
-- Add to table
review_token UUID DEFAULT gen_random_uuid() UNIQUE,

-- RPC for public access (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_[record]_by_token(p_token UUID)
RETURNS [table_name] AS $$
  SELECT * FROM [table_name] WHERE review_token = p_token LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
```

```javascript
// In PublicPage.jsx — no auth required
const { data } = await supabase.rpc('get_[record]_by_token', {
  p_token: token
});
```

---

## Internal Account Pattern

Every agency has one client with `is_internal = true`. This is the agency's own workspace.

```javascript
// Get the internal account client ID
const { data: internalClient } = await supabase
  .from('clients')
  .select('id')
  .eq('user_id', userId)
  .eq('is_internal', true)
  .single();

const internalClientId = internalClient.id;
```

When a feature has a "global" page with an upload that needs a default client,
default to the internal account client ID.

---

## Client Detail Tab Pattern

When adding a new tab to the Client Detail page:

```jsx
// In ClientDetails.jsx — add to TabsList
<TabsTrigger value="[feature]">[Feature Name]</TabsTrigger>

// Add to tab content area
<TabsContent value="[feature]">
  <FeatureTab clientId={clientId} />
</TabsContent>
```

The `FeatureTab` component accepts `clientId` as a prop and filters its data
accordingly. Never special-case the internal account — treat it identically.

---

## Global Page + Client Tab Pattern (Operations features)

New operations features follow the Meetings/Notes architecture:

```
src/
├── api/
│   └── [feature].js              — All Supabase calls
├── pages/
│   └── [feature]/
│       └── [Feature]Page.jsx     — Global page (/[feature] route)
└── components/
    └── [feature]/
        ├── [Feature]Tab.jsx      — Reused in both global page and client detail tab
        ├── [Feature]Card.jsx     — Single item card
        └── [Feature]Dialog.jsx   — Create/edit dialog
```

The `[Feature]Tab` component accepts an optional `clientId` prop:
- With `clientId` → filters to that client (used in Client Detail tab)
- Without `clientId` → shows all records (used in global page, combined with a client dropdown filter)

---

## Sidebar Navigation Groups

```
Dashboard       → /dashboard
Clients         → /clients
Content
  Posts         → /posts
  Calendar      → /calendar
Operations
  Meetings      → /operations/meetings
  Notes         → /operations/notes
  Documents     → /documents
Finance
  Overview      → /finance/overview
  Invoices      → /finance/invoices
  Subscriptions → /finance/subscriptions  (Velocity+ only)
  Ledger        → /finance/ledger
```

New operations features go in the Operations group.
New finance features go in the Finance group.
Major new standalone features may warrant their own group — confirm with user.

---

## Confirmation Dialogs

Destructive actions always use `AlertDialog`:

```jsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete [Item]?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-destructive">
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Toast Notifications

```javascript
import { toast } from 'sonner';

// Success
toast.success('[Item] saved');

// Error
toast.error('Failed to save [item]');

// With description
toast.success('Document uploaded', { description: filename });
```

---

## Date Formatting

```javascript
import { formatDate } from '@/lib/helper';

// Always use formatDate for display — outputs "2 Jan, 2026"
formatDate(record.created_at)
```

---

## File Size Formatting

```javascript
// In src/lib/helper.js (added during Documents feature)
export function formatFileSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```