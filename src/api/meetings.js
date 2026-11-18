// Meetings API (ADR 0007): plain async functions, read hooks, and a hook per
// mutation that owns the cache invalidation. Meeting visibility is per user
// (RLS: private meetings show only to their creator); the cache is cleared on
// sign-out, so workspace-keyed entries never leak between users.
import { supabase } from '@/lib/supabase'
import { startOfDay, endOfDay } from 'date-fns'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useApiMutation } from '@/api/mutation'
import { meetingKeys } from '@/api/queryKeys'

export { meetingKeys }

// Every meeting view (Meetings page, calendar, dashboard, client overview,
// week timelines, campaign tab, reminders) sits under meetingKeys.all.
const invalidateMeetings = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: meetingKeys.all })

/**
 * Fetch meetings. Automatically restricted to user's clients via RLS.
 */
export async function fetchMeetings({ startDate, endDate, clientId }) {
  let query = supabase
    .from('meetings')
    .select('id, client_id, title, datetime, notes, meeting_link, completed_at, created_at, visibility, creator_id, clients!inner(name)')

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
 * Fetch the next few future meetings for a specific client.
 */
export async function fetchUpcomingMeetings(clientId, limit = 3) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*, clients!inner(name)')
    .eq('client_id', clientId)
    .is('completed_at', null)
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
    .is('completed_at', null)
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
 * Fetch all meetings linked to a specific campaign.
 */
export async function fetchCampaignMeetings(campaignId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*, clients!inner(name)')
    .eq('campaign_id', campaignId)
    .order('datetime', { ascending: true })

  if (error) throw error

  return data.map(m => ({
    ...m,
    client_name: m.clients?.name
  }))
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

/**
 * Mark a meeting as completed.
 */
export async function markMeetingCompleted(id) {
  const { error } = await supabase
    .from('meetings')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

/**
 * Unmark a meeting as completed.
 */
export async function unmarkMeetingCompleted(id) {
  const { error } = await supabase
    .from('meetings')
    .update({ completed_at: null })
    .eq('id', id)

  if (error) throw error
}

/**
 * Meetings between two dates, with or without a client (week timelines).
 * Unlike fetchMeetings this keeps meetings with no client.
 */
export async function fetchMeetingsBetween({ from, to, clientId = null }) {
  let query = supabase
    .from('meetings')
    .select('*')
    .gte('datetime', from.toISOString())
    .lte('datetime', to.toISOString())
    .order('datetime', { ascending: true })
  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

/** Every open meeting from now on, any client (the dashboard list). */
export async function fetchOpenUpcomingMeetings() {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .is('completed_at', null)
    .gte('datetime', new Date().toISOString())
    .order('datetime', { ascending: true })
  if (error) throw error
  return data
}

// ─── Read hooks ───────────────────────────────────────────────────────────────

/** Meetings, optionally for one client (Meetings page, calendar, client tab). */
export function useMeetings({ clientId = null } = {}, options = {}) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    ...options,
    queryKey: meetingKeys.range(workspaceUserId, { clientId }),
    queryFn: () => fetchMeetings(clientId ? { clientId } : {}),
    enabled: !!workspaceUserId && (options.enabled ?? true),
  })
}

export function useMeetingsBetween({ from, to, clientId = null }, options = {}) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    ...options,
    queryKey: meetingKeys.range(workspaceUserId, {
      clientId,
      from: from.toISOString(),
      to: to.toISOString(),
    }),
    queryFn: () => fetchMeetingsBetween({ from, to, clientId }),
    enabled: !!workspaceUserId && (options.enabled ?? true),
  })
}

export function useUpcomingMeetings(clientId, limit = 3) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: meetingKeys.upcoming(workspaceUserId, clientId, limit),
    queryFn: () => fetchUpcomingMeetings(clientId, limit),
    enabled: !!workspaceUserId && !!clientId,
  })
}

export function useOpenUpcomingMeetings(options = {}) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    ...options,
    queryKey: meetingKeys.upcoming(workspaceUserId, 'all', null),
    queryFn: fetchOpenUpcomingMeetings,
    enabled: !!workspaceUserId,
  })
}

/** Today's open meetings, refreshed every 5 minutes (the reminder toasts). */
export function useTodayMeetings() {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: meetingKeys.today(workspaceUserId),
    queryFn: fetchTodayMeetings,
    enabled: !!workspaceUserId,
    refetchInterval: 5 * 60 * 1000,
  })
}

export function useCampaignMeetings(campaignId) {
  return useQuery({
    queryKey: meetingKeys.byCampaign(campaignId),
    queryFn: () => fetchCampaignMeetings(campaignId),
    enabled: !!campaignId,
  })
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

/** Variables: `{ id, payload }`. With an id it updates, else it creates. */
export function useSaveMeeting(options) {
  return useApiMutation(
    ({ id, payload }) => (id ? updateMeeting(id, payload) : createMeeting(payload)),
    invalidateMeetings,
    options,
  )
}

export function useDeleteMeeting(options) {
  return useApiMutation(deleteMeeting, invalidateMeetings, options)
}

/**
 * Mark a meeting done (or not). Optimistic: every cached meeting list shows
 * the change at once (the kanban drop) and rolls back if the write fails.
 * Variables: `{ id, completed }`.
 */
export function useSetMeetingCompleted({ onSuccess, onError, ...options } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: ({ id, completed }) =>
      completed ? markMeetingCompleted(id) : unmarkMeetingCompleted(id),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: meetingKeys.all })
      const previous = queryClient.getQueriesData({ queryKey: meetingKeys.all })
      const completed_at = completed ? new Date().toISOString() : null
      queryClient.setQueriesData({ queryKey: meetingKeys.all }, (old) =>
        Array.isArray(old) ? old.map((m) => (m.id === id ? { ...m, completed_at } : m)) : old,
      )
      return { previous }
    },
    onError: (err, variables, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data)
      return onError?.(err, variables, context)
    },
    onSuccess,
    onSettled: () => invalidateMeetings(queryClient),
  })
}
