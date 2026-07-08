import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { memberId } = await req.json()
    if (!memberId) {
      return new Response(JSON.stringify({ error: 'memberId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Caller-scoped client — used for the RPC so auth.uid() inside it
    // resolves to the real caller (the RPC does its own ownership check via
    // is_workspace_owner()). The RPC itself is SECURITY DEFINER, so it can
    // still reassign/delete rows across tables despite RLS.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Admin client (service role) — only used to delete the auth.users row,
    // which requires the Admin API rather than a SQL function.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Reassigns this member's authorship (posts, tasks, chat messages, etc.)
    // to the workspace owner, unassigns their tasks, and deletes the
    // agency_members row — all atomically. Returns whether this person
    // belongs to any other workspace, since we must never delete their auth
    // account if so (it would break their access there too).
    const { data: rpcRows, error: rpcError } = await callerClient.rpc('hard_delete_team_member', {
      p_member_id: memberId,
    })

    if (rpcError) {
      const status = /forbidden|owner/i.test(rpcError.message)
        ? 403
        : /not found/i.test(rpcError.message)
          ? 404
          : 500
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = rpcRows?.[0]
    if (!result?.member_user_id) {
      throw new Error('Member deletion did not return a user id')
    }

    // Only delete the auth account if this workspace is their only one.
    let authDeleted = false
    let authDeleteWarning = null
    if (!result.other_workspaces) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(result.member_user_id)
      if (authDeleteError) {
        // The membership + data cleanup already succeeded (committed inside
        // the RPC), so don't fail the whole request — just report that the
        // login itself couldn't be removed.
        authDeleteWarning = authDeleteError.message
      } else {
        authDeleted = true
      }
    }

    return new Response(
      JSON.stringify({ success: true, authDeleted, authDeleteWarning }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
