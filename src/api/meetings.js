import { supabase } from '@/lib/supabase'
import { startOfDay, endOfDay } from 'date-fns'

/**
 * Fetch meetings. Automatically restricted to user's clients via RLS.
 */
export async function fetchMeetings({ startDate, endDate, clientId }) {
  let query = supabase
    .from('meetings')
    .select('id, client_id, title, datetime, notes, created_at, clients!inner(name)')

  if (startDate && endDate) {
    query = query.gte('datetime', startDate).lte('datetime', endDate)
  }

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query

  if (error) throw error

  // Flatten the client name for easier consumption
  return data.map(m => ({
    ...m,
    client_name: m.clients?.name
  }))
}

/**
 * Fetch the nearest future meeting for a specific client.
 */
export async function fetchUpcomingMeeting(clientId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*, clients!inner(name)')
    .eq('client_id', clientId)
    .gte('datetime', new Date().toISOString())
    .order('datetime', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    client_name: data.clients?.name
  }
}

/**
 * Fetch the next few future meetings for a specific client.
 */
export async function fetchUpcomingMeetings(clientId, limit = 3) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*, clients!inner(name)')
    .eq('client_id', clientId)
    .gte('datetime', new Date().toISOString())
    .order('datetime', { ascending: true })
    .limit(limit)

  if (error) throw error

  return data.map(m => ({
    ...m,
    client_name: m.clients?.name
  }))
}

/**
 * Fetch all meetings for today (for the reminder system).
 */
export async function fetchTodayMeetings() {
  const now = new Date()
  const start = startOfDay(now).toISOString()
  const end = endOfDay(now).toISOString()

  const { data, error } = await supabase
    .from('meetings')
    .select('*, clients!inner(name)')
    .gte('datetime', start)
    .lte('datetime', end)
    .order('datetime', { ascending: true })

  if (error) throw error

  return data.map(m => ({
    ...m,
    client_name: m.clients?.name
  }))
}

/**
 * Create a new meeting.
 */
export async function createMeeting(payload) {
  const { data, error } = await supabase
    .from('meetings')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete a meeting.
 */
export async function deleteMeeting(id) {
  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Update a meeting.
 */
export async function updateMeeting(id, payload) {
  const { data, error } = await supabase
    .from('meetings')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
