# Command: New API Module

Scaffold a new API module in `src/api/`.

## Usage

```
/new-api-module <domain>
```

## What to Generate

Create `src/api/<domain>.js` with this skeleton:

```js
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'

// --- READS (React Query hooks) ---

export function use<Domain>List() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['<domain>-list', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('<table>')
        .select('*')
        .eq('user_id', user.id)
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })
}

export function use<Domain>ById(id) {
  return useQuery({
    queryKey: ['<domain>-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('<table>')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// --- MUTATIONS (plain async functions) ---

export async function create<Domain>(payload) {
  const { data, error } = await supabase.from('<table>').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function update<Domain>(id, payload) {
  const { error } = await supabase.from('<table>').update(payload).eq('id', id)
  if (error) throw error
}

export async function delete<Domain>(id) {
  const { error } = await supabase.from('<table>').delete().eq('id', id)
  if (error) throw error
}
```

## After Creating

- Import and use the hook in the relevant page component
- Call `queryClient.invalidateQueries({ queryKey: ['<domain>-list'] })` after mutations
