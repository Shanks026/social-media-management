import { supabase } from "@/lib/supabase";

export async function fetchDraftPostsByClient(clientId) {
    const { data, error } = await supabase
        .from("post_versions")
        .select(`
      id,
      post_id,
      content,
      media_urls,
      platform,
      status,
      created_at,
      posts!post_versions_post_id_fkey!inner (
        client_id
      )
    `)
        .eq("status", "DRAFT")
        .eq("posts.client_id", clientId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}


export async function createDraftPost({
    clientId,
    content,
    mediaUrls,
    platform,
}) {
    const { error } = await supabase.rpc("create_post_draft", {
        p_client_id: clientId,
        p_content: content,
        p_media_urls: mediaUrls,
        p_platform: platform,
    });

    if (error) throw error;
}
