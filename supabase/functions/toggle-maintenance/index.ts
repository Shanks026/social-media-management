import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-admin-secret, content-type, authorization',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const adminSecret = Deno.env.get('MAINTENANCE_ADMIN_SECRET')
    const incoming = req.headers.get('x-admin-secret')

    if (!adminSecret || incoming !== adminSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { is_active, message } = await req.json()

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error } = await adminClient
      .from('app_config')
      .upsert(
        {
          key: 'maintenance_mode',
          value: {
            is_active: !!is_active,
            message: message || "The application is currently undergoing maintenance. We'll be back shortly.",
            started_at: is_active ? new Date().toISOString() : null,
          },
        },
        { onConflict: 'key' }
      )

    if (error) throw error

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
