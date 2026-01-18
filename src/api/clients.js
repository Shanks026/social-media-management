import { supabase } from "@/lib/supabase";

/**
 * Fetch all clients for the current authenticated user
 */
export async function fetchClients() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Create a client owned by the current authenticated user
 */
export async function createClient(payload) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("clients")
    .insert({
      ...payload,
      user_id: user.id,
    });

  if (error) throw error;
}

/**
 * Update a client (RLS ensures ownership)
 */
export async function updateClient({ id, ...updates }) {
  const { error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

/**
 * Delete a client (RLS ensures ownership)
 */
export async function deleteClient(id) {
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Fetch a single client by ID (RLS ensures ownership)
 */
export async function fetchClientById(id) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}
